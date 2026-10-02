"use strict";

jest.mock("#shared/winston.logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  saveAndUpdatePdf: jest.fn().mockResolvedValue(null),
}));
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
const deps = require("#modules/4.02-studyLoad/_shared/finalStepRevoke.dependents");
const {
  DEFAULT_REVOCABLE,
  assertRevocable,
  saveIfStillApproved,
} = require("./finalStepRevoke");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadController = require("#modules/4.02-studyLoad/workload/workload.controller");
const DistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const DistController = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.controller");

const STEPS = ["methodical", "kafedra", "financial", "prorektor", "rektor"];
const makeDoc = (status, extra = {}) => {
  const doc = {
    _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    status,
    department: "dep-1",
    approvalSteps: STEPS.map((step) => ({ step, status: "approved", approvedBy: "u-prev" })),
    verify: { token: "f".repeat(32), revokedAt: null },
    ...extra,
  };
  doc.save = jest.fn(async () => {
    doc.savedWhere = doc.$where;
  });
  return doc;
};

async function reject(Model, Controller, doc, role) {
  jest.spyOn(Model, "findOne").mockResolvedValue(doc);
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  await Controller.reject(
    { params: { id: doc._id }, body: { comment: "Guruhlar o'zgardi" }, query: {}, scope: {}, user: { _id: "u-r", role: { title: role } } },
    res,
    next,
  );
  return { res, next };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("finalStepRevoke — revocableStatuses opsiyasi", () => {
  test("default FAQAT approved; superseded → 409", () => {
    expect(DEFAULT_REVOCABLE).toEqual(["approved"]);
    expect(() => assertRevocable({ status: "approved" })).not.toThrow();
    expect(() => assertRevocable({ status: "superseded" })).toThrow(
      expect.objectContaining({ statusCode: 409, message: "Bu holatdagi hujjatning tasdig'ini bekor qilib bo'lmaydi" }),
    );
  });

  test("atomar guard: bitta holat — aniq tenglik (o'zgarmagan), ko'p holat — $in", async () => {
    const one = makeDoc("approved");
    await saveIfStillApproved(one);
    expect(one.savedWhere).toEqual({ status: "approved" });
    const many = makeDoc("superseded");
    await saveIfStillApproved(many, ["approved", "superseded"]);
    expect(many.savedWhere).toEqual({ status: { $in: ["approved", "superseded"] } });
    expect(many.$where).toBeUndefined();
  });
});

describe("yuklama reject — superseded (egasi 2026-09-24)", () => {
  test("rektor → 200 rejected, token bekor, guard $in", async () => {
    const doc = makeDoc("superseded", { supersededBy: "v2" });
    const { res, next } = await reject(WorkloadModel, WorkloadController, doc, ROLES.REKTOR);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ action: "revoked_final", status: "rejected" });
    expect(doc.status).toBe("rejected");
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.savedWhere).toEqual({ status: { $in: ["approved", "superseded"] } });
  });

  test("boshqa rol (prorektor) → 403, holat o'zgarmaydi", async () => {
    const doc = makeDoc("superseded");
    const { next } = await reject(WorkloadModel, WorkloadController, doc, ROLES.PROREKTOR);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(doc.status).toBe("superseded");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("faol taqsimot bor → 409 active_dependents", async () => {
    deps.findActiveDependents.mockResolvedValueOnce([{ type: "workloadDistribution", id: "d1", status: "approved" }]);
    const doc = makeDoc("superseded");
    const { next } = await reject(WorkloadModel, WorkloadController, doc, ROLES.REKTOR);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409, meta: expect.objectContaining({ reason: "active_dependents" }) });
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe("joriy vN qaytarilsa vN-1 TIKLANMAYDI", () => {
  test("approved vN → rejected; boshqa yuklamalarga yozuv YO'Q", async () => {
    const updateMany = jest.spyOn(WorkloadModel, "updateMany").mockResolvedValue({ modifiedCount: 0 });
    const updateOne = jest.spyOn(WorkloadModel, "updateOne").mockResolvedValue({ modifiedCount: 0 });
    const doc = makeDoc("approved", { version: 2, previousVersion: "v1" });
    const { res } = await reject(WorkloadModel, WorkloadController, doc, ROLES.REKTOR);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.status).toBe("rejected");
    expect(doc.savedWhere).toEqual({ status: { $in: ["approved", "superseded"] } });
    expect(updateMany).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe("taqsimot — superseded qaytarilmaydi (default saqlangan)", () => {
  test("prorektor superseded taqsimotni qaytarsa → 409 superseded", async () => {
    const doc = makeDoc("superseded", {
      approvalSteps: ["kafedra", "methodical", "financial", "dean", "prorektor"].map((step) => ({ step, status: "approved" })),
    });
    const { next } = await reject(DistModel, DistController, doc, ROLES.PROREKTOR);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409, meta: { reason: "superseded" } });
    expect(doc.save).not.toHaveBeenCalled();
  });
});
