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
const { saveAndUpdatePdf } = require("#shared/pdfGenerators/pdfHelpers");
const { safeDispatchMany } = require("#modules/4.02-studyLoad/_shared/chainNotify");
const deps = require("#modules/4.02-studyLoad/_shared/finalStepRevoke.dependents");

const M = "#modules/4.02-studyLoad";
const ENTITIES = Object.fromEntries(
  [
    "workingSchedule",
    "workload",
    "workloadDistribution",
    "syllabus",
    "scienceProgram",
    "workloadSummary",
    "contingentReport",
  ].map((name) => [
    name,
    {
      Model: require(`${M}/${name}/${name}.model`),
      Controller: require(`${M}/${name}/${name}.controller`),
    },
  ]),
);
const entity = (name) => ENTITIES[name];

const SP_B1 = ["teacher", "kafedra", "arm", "methodical", "dean"];
const SP_LEGACY = ["teacher", "kafedra", "arm", "methodical", "prorektor", "rektor"];

const C = ([name, folder, handler, field, steps, roles, eventType, pdf, extra]) => ({
  name, folder, handler, field, steps, finalRole: roles[0], otherRole: roles[1], eventType, pdf, extra,
});
const CASES = [
  C(["workingSchedule", "workingSchedule", "reject", "approvalHistory", ["methodical", "dean", "prorektor", "rektor"], [ROLES.REKTOR, ROLES.PROREKTOR], "workingSchedule_rejected", false, {}]),
  C(["workload", "workload", "reject", "approvalSteps", ["methodical", "kafedra", "financial", "prorektor", "rektor"], [ROLES.REKTOR, ROLES.PROREKTOR], "workload_rejected", true, { department: "dep-1" }]),
  C(["workloadDistribution", "workloadDistribution", "reject", "approvalSteps", ["kafedra", "methodical", "financial", "dean", "prorektor"], [ROLES.PROREKTOR, ROLES.DEKAN], "workload_rejected", true, { department: "dep-1" }]),
  C(["syllabus", "syllabus", "reject", "approvalSteps", ["kafedra", "arm", "methodical", "dean", "prorektor"], [ROLES.PROREKTOR, ROLES.DEKAN], "syllabus_rejected", true, { author: { teacher: "t-1" } }]),
  C(["scienceProgram v259 B1", "scienceProgram", "reject", "approvalSteps", SP_B1, [ROLES.DEKAN, ROLES.REKTOR], "scienceProgram_rejected", true, { formVersion: "v259", user: "t-1" }]),
  C(["scienceProgram v259 legacy", "scienceProgram", "reject", "approvalSteps", SP_LEGACY, [ROLES.REKTOR, ROLES.DEKAN], "scienceProgram_rejected", true, { formVersion: "v259", user: "t-1" }]),
  C(["scienceProgram v142", "scienceProgram", "reject", "approvalSteps", ["teacher", "kafedra", "dean"], [ROLES.DEKAN, ROLES.KAFEDRA_MUDIRI], "scienceProgram_rejected", true, { formVersion: "v142", user: "t-1" }]),
  C(["workloadSummary", "workloadSummary", "rejectWorkloadSummary", "approvalSteps", ["methodical", "financial", "prorektor", "rektor"], [ROLES.REKTOR, ROLES.PROREKTOR], "workloadSummary_rejected", false, { createdBy: "c-1" }]),
  C(["contingentReport", "contingentReport", "rejectContingentReport", "approvalSteps", ["dean"], [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI], "contingentReport_rejected", false, { createdBy: "c-1", faculty: "f-1" }]),
];

const TOKEN = "f".repeat(32);
const flush = () => new Promise((r) => setImmediate(r));

const makeDoc = (c, { pendingLast = false } = {}) => ({
  _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  status: pendingLast ? "in_review" : "approved",
  [c.field]: c.steps.map((step, i) => ({
    step,
    status: pendingLast && i === c.steps.length - 1 ? "pending" : "approved",
    approvedBy: "u-prev",
    date: new Date("2026-09-01"),
  })),
  verify: { token: TOKEN, revokedAt: null, revokedReason: null },
  save: jest.fn().mockResolvedValue(undefined),
  ...c.extra,
});

const call = async (c, doc, role, body = { comment: "Qayta ko'rib chiqilsin" }) => {
  const { Model, Controller } = entity(c.folder);
  jest.spyOn(Model, "findOne").mockResolvedValue(doc);
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);
  const next = jest.fn();
  const req = {
    params: { id: String(doc._id) },
    body,
    query: {},
    scope: c.folder === "contingentReport" ? { faculty: "f-1" } : {},
    user: { _id: "u-actor", role: { title: role } },
  };
  await Controller[c.handler](req, res, next);
  return { res, next, body: res.json.mock.calls[0]?.[0] };
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function finalRoleRevokes(c) {
  const doc = makeDoc(c);
  const { res, next, body } = await call(c, doc, c.finalRole);
  const last = c.steps.length - 1;

  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(body).toMatchObject({ action: "revoked_final", rejectedStep: c.steps[last], status: "rejected" });
  expect(doc.status).toBe("rejected");
  expect(doc[c.field][last]).toMatchObject({ status: "rejected", comment: "Qayta ko'rib chiqilsin" });
  expect(doc[c.field].slice(0, -1).every((s) => s.status === "approved")).toBe(true);
  expect(doc.verify).toMatchObject({ token: TOKEN, revokedReason: "Tasdiq bekor qilindi" });
  expect(doc.verify.revokedAt).toBeInstanceOf(Date);
  expect(doc.save).toHaveBeenCalledTimes(1);
  expect(saveAndUpdatePdf).toHaveBeenCalledTimes(c.pdf ? 1 : 0);

  await flush();
  expect(safeDispatchMany).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ eventType: c.eventType, title: "Tasdiq bekor qilindi" }),
  );
  expect(safeDispatchMany.mock.calls[0][0].length).toBeGreaterThan(0);
}

async function otherRoleForbidden(c) {
  const doc = makeDoc(c);
  const { next } = await call(c, doc, c.otherRole);
  expect(next.mock.calls[0][0].statusCode).toBe(403);
  expect(doc.status).toBe("approved");
  expect(doc.save).not.toHaveBeenCalled();
  expect(doc.verify.revokedAt).toBeNull();
}

async function superAdminRevokes(c) {
  const doc = makeDoc(c);
  const { res } = await call(c, doc, ROLES.SUPER_ADMIN);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(doc.status).toBe("rejected");
}

async function activeDependentsBlock(c) {
  const dependents = [{ type: "x", id: "d-1", title: "T", status: "approved" }];
  deps.findActiveDependents.mockResolvedValueOnce(dependents);
  const doc = makeDoc(c);
  const { next } = await call(c, doc, c.finalRole);
  const err = next.mock.calls[0][0];
  expect(err.statusCode).toBe(409);
  expect(err.meta).toMatchObject({ reason: "active_dependents", dependents });
  expect(doc.save).not.toHaveBeenCalled();
}

async function inReviewUnchanged(c) {
  const doc = makeDoc(c, { pendingLast: true });
  const { res, body } = await call(c, doc, c.finalRole);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(body.action).not.toBe("revoked_final");
  expect(doc.status).toBe("rejected");
  expect(deps.findActiveDependents).not.toHaveBeenCalled();
}

describe.each(CASES)("ADR-041 — $name", (c) => {
  test(`yakuniy rol (${c.finalRole}) → 200, rejected, token bekor, bildirishnoma`, () => finalRoleRevokes(c));
  test(`boshqa rol (${c.otherRole}) → 403, hech narsa yozilmaydi`, () => otherRoleForbidden(c));
  test("super_admin → 200", () => superAdminRevokes(c));
  test("faol bog'liq hujjat → 409 + ro'yxat", () => activeDependentsBlock(c));
  test("regressiya: `in_review` rad yo'li o'zgarmagan", () => inReviewUnchanged(c));
});
