"use strict";

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = require("mongoose");
const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const verifyService = require("#modules/4.02-studyLoad/_verify/documentVerify.service");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const ids = {
  m: new mongoose.Types.ObjectId(),
  d: new mongoose.Types.ObjectId(),
  p: new mongoose.Types.ObjectId(),
  r: new mongoose.Types.ObjectId(),
};
const USERS = [
  { _id: ids.m, firstName: "Nilufar", lastName: "Rahimova" },
  { _id: ids.d, firstName: "Dilshod", lastName: "Rahmonov" },
  { _id: ids.p, firstName: "Parda", lastName: "Karimov" },
  { _id: ids.r, firstName: "Rustam", lastName: "Aliyev" },
];
const OUB = { _id: ids.m, role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } };
const DEKAN = { _id: ids.d, role: { title: ROLES.DEKAN } };
const PROREKTOR = { _id: ids.p, role: { title: ROLES.PROREKTOR } };
const REKTOR = { _id: ids.r, role: { title: ROLES.REKTOR, scopeLevel: "global" } };

const makeDoc = () => {
  const doc = new WorkingScheduleModel({
    status: "draft",
    approvalHistory: ["methodical", "dean", "prorektor", "rektor"].map((step) => ({ step, status: "pending" })),
  });
  doc.save = jest.fn().mockResolvedValue(doc);
  return doc;
};

const act = async (method, doc, user, body = {}) => {
  jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  await Controller[method]({ params: { id: String(doc._id) }, body, scope: {}, user }, res, next);
  return { res, next, body: res.json.mock.calls[0]?.[0] };
};

const stubLookupDb = (doc) => {
  for (const entry of verifyService.REGISTRY) {
    jest.spyOn(entry.Model, "findOne").mockImplementation((filter) => {
      const hit =
        entry.Model === WorkingScheduleModel && filter["verify.token"] === doc.verify?.token;
      const q = { populate: () => q, lean: async () => (hit ? doc.toObject() : null) };
      return q;
    });
    if (entry.Model === WorkingScheduleModel) {
      jest.spyOn(entry, "buildTitle").mockResolvedValue("Ishchi o'quv reja");
    }
  }
};

beforeEach(() => {
  jest.spyOn(WorkingPlanModel, "find").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
  });
  jest.spyOn(UserModel, "find").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(USERS) }),
  });
});
afterEach(() => jest.restoreAllMocks());

const approveAll = async (doc) => {
  await act("approve", doc, OUB);
  for (const u of [DEKAN, PROREKTOR, REKTOR]) {
    const { next } = await act("approve", doc, u);
    expect(next).not.toHaveBeenCalled();
  }
  expect(doc.status).toBe("approved");
};

describe("ADR-041 — ishchi reja: revoke → reopen → yangi token", () => {
  test("rektor bekor qiladi → reopen → submit → YANGI token; eski token bekor qoladi", async () => {
    const doc = makeDoc();
    await approveAll(doc);
    const oldToken = doc.verify.token;
    expect(oldToken).toMatch(/^[0-9a-f]{32}$/);

    const revoked = await act("reject", doc, REKTOR, { comment: "Soatlar xato" });
    expect(revoked.next).not.toHaveBeenCalled();
    expect(revoked.body).toMatchObject({ action: "revoked_final", rejectedStep: "rektor", status: "rejected" });
    expect(doc.verify.token).toBe(oldToken);
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.verify.revokedReason).toBe("Tasdiq bekor qilindi");

    stubLookupDb(doc);
    expect(await verifyService.lookup(oldToken)).toBeNull();

    await new Promise((r) => setImmediate(r));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ids.m, eventType: "workingSchedule_rejected", title: "Tasdiq bekor qilindi" }),
    );

    await act("approve", doc, OUB);
    expect(doc.status).toBe("draft");
    await act("approve", doc, OUB);
    expect(doc.status).toBe("in_review");
    const newToken = doc.verify.token;
    expect(newToken).toMatch(/^[0-9a-f]{32}$/);
    expect(newToken).not.toBe(oldToken);
    expect(doc.verify.revokedAt).toBeNull();

    stubLookupDb(doc);
    expect(await verifyService.lookup(oldToken)).toBeNull();
    expect(await verifyService.lookup(newToken)).toMatchObject({ state: "in_progress" });
  });

});

describe("ADR-041 — ishchi reja: rol va bog'liq hujjat", () => {
  test("prorektor (yakuniy emas) → 403; dekan → 403", async () => {
    const doc = makeDoc();
    await approveAll(doc);
    for (const u of [PROREKTOR, DEKAN]) {
      const { next } = await act("reject", doc, u, { comment: "x" });
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    }
    expect(doc.status).toBe("approved");
    expect(doc.verify.revokedAt).toBeNull();
  });

  test("bu ishchi rejadan hosil bo'lgan FAOL yuklama → 409 + ro'yxat", async () => {
    const doc = makeDoc();
    await approveAll(doc);
    const planId = new mongoose.Types.ObjectId();
    const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
    WorkingPlanModel.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([{ _id: planId }]) }),
    });
    const wlId = new mongoose.Types.ObjectId();
    jest.spyOn(WorkloadModel, "find").mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: wlId, title: "Anatomiya", status: "in_review" }]),
      }),
    });

    const { next } = await act("reject", doc, REKTOR, { comment: "x" });
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta.dependents).toEqual([
      { type: "workload", id: String(wlId), title: "Anatomiya", status: "in_review" },
    ]);
    expect(doc.status).toBe("approved");
  });
});
