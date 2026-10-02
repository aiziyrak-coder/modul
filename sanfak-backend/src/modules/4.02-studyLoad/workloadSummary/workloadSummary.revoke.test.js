"use strict";

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/_shared/chainNotify", () => ({
  safeDispatch: jest.fn().mockResolvedValue(null),
  safeDispatchMany: jest.fn().mockResolvedValue(undefined),
  getDepartmentHeadUserIds: jest.fn().mockResolvedValue(["head-1"]),
}));
jest.mock("#modules/4.02-studyLoad/_shared/finalStepRevoke.dependents", () => ({
  ACTIVE_STATUSES: ["in_review", "approved"],
  findActiveDependents: jest.fn().mockResolvedValue([]),
  markInactiveDependentsStale: jest.fn().mockResolvedValue(0),
}));

const { ROLES } = require("#config/constants");
const { safeDispatchMany } = require("#modules/4.02-studyLoad/_shared/chainNotify");
const { runFinalRevoke } = require("#modules/4.02-studyLoad/_shared/finalStepRevoke");
const WorkloadSummary = require("./workloadSummary.model");
const Controller = require("./workloadSummary.controller");
const { STEP_ORDER } = require("./workloadSummary.chain");

const TOKEN = "f".repeat(32);
const flush = () => new Promise((r) => setImmediate(r));

const makeDoc = (status) => {
  const doc = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    status,
    createdBy: "c-1",
    approvalSteps: STEP_ORDER.map((step) => ({
      step,
      status: "approved",
      approvedBy: "u-prev",
      date: new Date("2026-09-01"),
    })),
    verify: { token: TOKEN, revokedAt: null, revokedReason: null },
  };
  doc.save = jest.fn(async () => {
    doc.savedWhere = doc.$where;
  });
  return doc;
};

const reject = async (doc, role, body = { comment: "Hisob xato" }) => {
  jest.spyOn(WorkloadSummary, "findOne").mockResolvedValue(doc);
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  const req = { params: { id: doc._id }, body, query: {}, user: { _id: "u-actor", role: { title: role } } };
  await Controller.rejectWorkloadSummary(req, res, next);
  return { res, next, body: res.json.mock.calls[0]?.[0] };
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("superseded → rejected (rektor)", () => {
  test("rektor → 200, rejected, token bekor, atomar filtr {approved|superseded}, bildirishnoma", async () => {
    const doc = makeDoc("superseded");
    const { res, next, body } = await reject(doc, ROLES.REKTOR);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ action: "revoked_final", rejectedStep: "rektor", status: "rejected" });
    expect(doc.status).toBe("rejected");
    expect(doc.approvalSteps[3]).toMatchObject({ status: "rejected", comment: "Hisob xato" });
    expect(doc.approvalSteps.slice(0, 3).every((s) => s.status === "approved")).toBe(true);
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.verify.revokedReason).toBe("Tasdiq bekor qilindi");
    expect(doc.savedWhere).toEqual({ status: { $in: ["approved", "superseded"] } });
    expect(doc.$where).toBeUndefined();

    await flush();
    expect(safeDispatchMany).toHaveBeenCalledWith(
      ["c-1"],
      expect.objectContaining({ eventType: "workloadSummary_rejected", title: "Tasdiq bekor qilindi" }),
    );
  });

  test("super_admin → 200", async () => {
    const doc = makeDoc("superseded");
    const { res } = await reject(doc, ROLES.SUPER_ADMIN);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
  });

  test.each([ROLES.PROREKTOR, ROLES.REJA_MOLIYA, ROLES.OQUV_USLUBIY_BOSHQARMA])(
    "%s → 403, hech narsa yozilmaydi",
    async (role) => {
      const doc = makeDoc("superseded");
      const { next } = await reject(doc, role);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(doc.status).toBe("superseded");
      expect(doc.save).not.toHaveBeenCalled();
      expect(doc.verify.revokedAt).toBeNull();
    },
  );

  test("sabab yo'q → 400", async () => {
    const doc = makeDoc("superseded");
    const { next } = await reject(doc, ROLES.REKTOR, { comment: "  " });
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("parallel o'zgarish (DocumentNotFoundError) → 409", async () => {
    const doc = makeDoc("superseded");
    doc.save.mockRejectedValue(Object.assign(new Error("nf"), { name: "DocumentNotFoundError" }));
    const { next } = await reject(doc, ROLES.REKTOR);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
  });
});

describe("regressiya — approved yo'li o'zgarmagan", () => {
  test("approved + rektor → 200 revoked_final", async () => {
    const doc = makeDoc("approved");
    const { res, body } = await reject(doc, ROLES.REKTOR);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ action: "revoked_final", status: "rejected" });
  });

  test("approved + prorektor → 403", async () => {
    const doc = makeDoc("approved");
    const { next } = await reject(doc, ROLES.PROREKTOR);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
});

describe("boshqa hujjatlar — default faqat `approved`", () => {
  const run = async (doc, opts = {}) => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    const next = jest.fn();
    const req = { body: { comment: "x" }, user: { _id: "u", role: { title: ROLES.REKTOR } } };
    await runFinalRevoke({ entity: "workload", doc, req, res, next, ...opts });
    return { res, next };
  };
  const workloadDoc = (status) => {
    const doc = makeDoc(status);
    doc.department = "dep-1";
    doc.approvalSteps = ["methodical", "kafedra", "financial", "prorektor", "rektor"].map((step) => ({
      step,
      status: "approved",
    }));
    return doc;
  };

  test("opt-in'siz `superseded` → 409, yozilmaydi", async () => {
    const doc = workloadDoc("superseded");
    const { next } = await run(doc);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.verify.revokedAt).toBeNull();
  });

  test("opt-in'siz `approved` → atomar filtr aynan {status:'approved'}", async () => {
    const doc = workloadDoc("approved");
    const { res } = await run(doc);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.savedWhere).toEqual({ status: "approved" });
  });
});
