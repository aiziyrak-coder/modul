"use strict";

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const mongoose = require("mongoose");
const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const ids = { m: new mongoose.Types.ObjectId(), d: new mongoose.Types.ObjectId() };
const USERS = [
  { _id: ids.m, firstName: "Nilufar", lastName: "Rahimova" },
  { _id: ids.d, firstName: "Dilshod", lastName: "Rahmonov" },
];
const OUB = { _id: ids.m, role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } };
const DEKAN = { _id: ids.d, role: { title: ROLES.DEKAN } };

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
  expect(next).not.toHaveBeenCalled();
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

describe("QR token oqimi (ADR-039)", () => {
  test("submit token chiqaradi; dekan tasdig'i — token o'sha, snapshot o'sadi", async () => {
    const doc = makeDoc();
    await act("approve", doc, OUB);
    expect(doc.status).toBe("in_review");
    const token = doc.verify.token;
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.snapshot.map((s) => s.step)).toEqual(["methodical"]);

    await act("approve", doc, DEKAN);
    expect(doc.verify.token).toBe(token);
    expect(doc.verify.snapshot.map((s) => s.step)).toEqual(["methodical", "dean"]);
    expect(doc.verify.snapshot[1].shortName).toBe("D.Rahmonov");
  });

  test("reject token'ni bekor qiladi; reopen + qayta submit — YANGI token", async () => {
    const doc = makeDoc();
    await act("approve", doc, OUB);
    const first = doc.verify.token;
    await act("reject", doc, DEKAN, { comment: "sabab" });
    expect(doc.status).toBe("rejected");
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);

    await act("approve", doc, OUB);
    expect(doc.status).toBe("draft");
    await act("approve", doc, OUB);
    expect(doc.verify.token).toMatch(/^[0-9a-f]{32}$/);
    expect(doc.verify.token).not.toBe(first);
    expect(doc.verify.revokedAt).toBeNull();
  });
});
