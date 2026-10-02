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
const deps = require("#modules/4.02-studyLoad/_shared/finalStepRevoke.dependents");
const scienceProgramChain = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.chain");
const {
  REVOKE_ACTION,
  REVOKE_REASON,
  getFinalStep,
  assertFinalActor,
  applyRevoke,
  saveIfStillApproved,
  runFinalRevoke,
} = require("./finalStepRevoke");

const approved = (keys) => keys.map((step) => ({ step, status: "approved", approvedBy: "x" }));
const flush = () => new Promise((r) => setImmediate(r));

const makeRes = () => {
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

afterEach(() => jest.clearAllMocks());

describe("getFinalStep — hujjatning O'Z massivi", () => {
  test.each([
    ["legacy v259 (6 bosqich)", ["teacher", "kafedra", "arm", "methodical", "prorektor", "rektor"], "rektor"],
    ["v259 B1 (ADR-035)", ["teacher", "kafedra", "arm", "methodical", "dean"], "dean"],
    ["v142", ["teacher", "kafedra", "dean"], "dean"],
  ])("%s → %s", (_n, keys, expected) => {
    expect(getFinalStep({ approvalSteps: approved(keys) }, "approvalSteps").step).toBe(expected);
  });

  test("workingSchedule — `approvalHistory` maydoni", () => {
    const doc = { approvalHistory: approved(["methodical", "dean", "prorektor", "rektor"]) };
    expect(getFinalStep(doc, "approvalHistory").step).toBe("rektor");
  });

  test("bo'sh / yo'q massiv → null", () => {
    expect(getFinalStep({ approvalSteps: [] }, "approvalSteps")).toBeNull();
    expect(getFinalStep({}, "approvalSteps")).toBeNull();
  });
});

describe("assertFinalActor", () => {
  const roles = scienceProgramChain.STEP_ROLES;

  test("yakuniy bosqich roli o'tadi", () => {
    expect(() => assertFinalActor(ROLES.REKTOR, { step: "rektor", status: "approved" }, roles, false)).not.toThrow();
  });

  test("boshqa rol → 403", () => {
    expect.assertions(1);
    try {
      assertFinalActor(ROLES.REKTOR, { step: "dean", status: "approved" }, roles, false);
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  test("super_admin — bypass", () => {
    expect(() => assertFinalActor(ROLES.SUPER_ADMIN, { step: "dean", status: "approved" }, roles, true)).not.toThrow();
  });

  test("yakuniy bosqich tasdiqlanmagan → 409; bosqich yo'q → 400", () => {
    expect(() => assertFinalActor(ROLES.DEKAN, { step: "dean", status: "pending" }, roles, false)).toThrow(
      expect.objectContaining({ statusCode: 409 }),
    );
    expect(() => assertFinalActor(ROLES.DEKAN, null, roles, false)).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});

test("applyRevoke — faqat berilgan bosqich rejected + izoh/sana/kim", () => {
  const steps = approved(["methodical", "rektor"]);
  applyRevoke(steps[1], "u-1", "sabab");
  expect(steps[1]).toEqual(expect.objectContaining({ status: "rejected", approvedBy: "u-1", comment: "sabab" }));
  expect(steps[1].date).toBeInstanceOf(Date);
  expect(steps[0].status).toBe("approved");
});

describe("saveIfStillApproved — atomar yozuv", () => {
  test("save paytida filtr `{status:'approved'}`, keyin tozalanadi", async () => {
    const doc = { save: jest.fn(async function save() { expect(doc.$where).toEqual({ status: "approved" }); }) };
    await saveIfStillApproved(doc);
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.$where).toBeUndefined();
  });

  test.each(["DocumentNotFoundError", "VersionError"])("%s → 409", async (name) => {
    const err = Object.assign(new Error("x"), { name });
    const doc = { save: jest.fn().mockRejectedValue(err) };
    await expect(saveIfStillApproved(doc)).rejects.toMatchObject({ statusCode: 409 });
    expect(doc.$where).toBeUndefined();
  });
});

const makeWorkloadDoc = () => ({
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  department: "dep-1",
  status: "approved",
  approvalSteps: approved(["methodical", "kafedra", "financial", "prorektor", "rektor"]),
  verify: { token: "f".repeat(32), revokedAt: null },
  save: jest.fn().mockResolvedValue(undefined),
});
const makeDoc = makeWorkloadDoc;
const run = async (doc, role, body = { comment: "Hisob xato" }, afterSave) => {
  const res = makeRes();
  const next = jest.fn();
  const req = { body, user: { _id: "u-actor", role: { title: role } } };
  await runFinalRevoke({ entity: "workload", doc, req, res, next, afterSave });
  return { res, next };
};

describe("runFinalRevoke (workload entity) — muvaffaqiyat", () => {
  test("rektor → 200, rejected, token bekor, doc.comment, afterSave, bildirishnoma", async () => {
    const doc = makeDoc();
    const afterSave = jest.fn().mockResolvedValue(null);
    const { res, next } = await run(doc, ROLES.REKTOR, { comment: "Hisob xato" }, afterSave);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ action: REVOKE_ACTION, rejectedStep: "rektor", status: "rejected" }),
    );
    expect(doc.status).toBe("rejected");
    expect(doc.comment).toBe("Hisob xato");
    expect(doc.approvalSteps[4].status).toBe("rejected");
    expect(doc.approvalSteps.slice(0, 4).every((s) => s.status === "approved")).toBe(true);
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.verify.revokedReason).toBe(REVOKE_REASON);
    expect(afterSave).toHaveBeenCalledWith(doc);
    expect(deps.markInactiveDependentsStale).toHaveBeenCalledWith("workload", doc);

    await flush();
    expect(safeDispatchMany).toHaveBeenCalledWith(
      ["head-1"],
      expect.objectContaining({ eventType: "workload_rejected", title: "Tasdiq bekor qilindi" }),
    );
  });
});

describe("runFinalRevoke (workload entity) — rad etish holatlari", () => {
  test("sabab yo'q → 400, hech narsa yozilmaydi", async () => {
    const doc = makeDoc();
    const { next } = await run(doc, ROLES.REKTOR, { comment: "   " });
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.status).toBe("approved");
  });

  test("faol bog'liq hujjat → 409 + ro'yxat", async () => {
    const dependents = [{ type: "workloadDistribution", id: "d1", title: "T", status: "approved" }];
    deps.findActiveDependents.mockResolvedValueOnce(dependents);
    const doc = makeDoc();
    const { next } = await run(doc, ROLES.REKTOR);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(409);
    expect(err.meta.dependents).toEqual(dependents);
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.status).toBe("approved");
  });

  test("parallel so'rov holatni o'zgartirgan → 409", async () => {
    const doc = makeDoc();
    doc.save.mockRejectedValue(Object.assign(new Error("nf"), { name: "DocumentNotFoundError" }));
    const { next, res } = await run(doc, ROLES.REKTOR);
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(res.status).not.toHaveBeenCalled();
    expect(deps.markInactiveDependentsStale).not.toHaveBeenCalled();
  });

  test("bildirishnoma xatosi javobga ta'sir qilmaydi", async () => {
    safeDispatchMany.mockRejectedValueOnce(new Error("telegram down"));
    const { res, next } = await run(makeDoc(), ROLES.REKTOR);
    await flush();
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
