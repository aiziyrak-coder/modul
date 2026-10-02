"use strict";

jest.mock("./workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.service", () => ({
  loadSummaryWorkloads: jest.fn().mockResolvedValue([]),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(() => ({ lean: () => ({ exec: async () => [] }) })),
}));

const WorkloadSummary = require("./workloadSummary.model");
const service = require("./workloadSummary.service");
const { STEP_ORDER } = require("./workloadSummary.chain");
const { ROLES } = require("#config/constants");

function matchField(val, cond) {
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      if (op === "$in") return arg.includes(val);
      if (op === "$nin") return !arg.includes(val);
      if (op === "$ne") return val !== arg;
      if (op === "$not") return !matchField(val, arg);
      if (op === "$elemMatch") return Array.isArray(val) && val.some((el) => matches(el, arg));
      throw new Error(`noma'lum operator ${op}`);
    });
  }
  return val === cond;
}
function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    if (key === "$and") return cond.every((f) => matches(doc, f));
    if (key === "$expr") {
      expect(cond).toEqual({ $eq: [1, 0] });
      return false;
    }
    return matchField(doc[key], cond);
  });
}

const steps = (statuses) => STEP_ORDER.map((step, i) => ({ step, status: statuses[i] || "pending" }));
const DOCS = [
  { _id: "draft", status: "draft", approvalSteps: steps([]) },
  { _id: "draftNoSteps", status: "draft", approvalSteps: [] },
  { _id: "atFinancial", status: "in_review", approvalSteps: steps(["approved"]) },
  { _id: "atProrektor", status: "in_review", approvalSteps: steps(["approved", "approved"]) },
  { _id: "atRektor", status: "in_review", approvalSteps: steps(["approved", "approved", "approved"]) },
  { _id: "rejectedAtFinancial", status: "rejected", approvalSteps: steps(["approved", "rejected"]) },
  { _id: "approved", status: "approved", approvalSteps: steps(["approved", "approved", "approved", "approved"]) },
  { _id: "superseded", status: "superseded", approvalSteps: steps(["approved", "approved", "approved", "approved"]) },
].map((d) => ({ ...d, active: true, academicYear: "ay1" }));

const ALL = DOCS.map((d) => d._id);
const LATER = ["approved", "superseded"];
const EXPECTED = {
  [ROLES.OQUV_USLUBIY_BOSHQARMA]: ALL,
  [ROLES.SUPER_ADMIN]: ALL,
  [ROLES.REJA_MOLIYA]: ["atFinancial", "atProrektor", "atRektor", "rejectedAtFinancial", ...LATER],
  [ROLES.PROREKTOR]: ["atProrektor", "atRektor", ...LATER],
  [ROLES.REKTOR]: ["atRektor", ...LATER],
  [ROLES.KAFEDRA_MUDIRI]: [],
  [ROLES.DEKAN]: [],
};

const visibleIds = (filter) => DOCS.filter((d) => matches(d, filter)).map((d) => d._id);
const viewer = (role) => ({ userRole: role, userId: "u1" });

let captured;
beforeEach(() => {
  captured = null;
  WorkloadSummary.paginate = jest.fn(async (filter) => {
    captured = filter;
    return { docs: [] };
  });
});

describe("ro'yxat — rol faqat o'z navbatidan boshlab ko'radi", () => {
  test.each(Object.entries(EXPECTED))("%s", async (role, expected) => {
    await service.paginateSummaries({}, viewer(role));
    expect(visibleIds(captured).sort()).toEqual([...expected].sort());
  });

  test("viewer uzatilmasa — fail-closed (hech narsa)", async () => {
    await service.paginateSummaries({});
    expect(visibleIds(captured)).toEqual([]);
  });
});

describe("`?status=` ko'rinishni chetlab o'tolmaydi", () => {
  test.each([ROLES.REKTOR, ROLES.PROREKTOR, ROLES.REJA_MOLIYA])("%s + ?status=draft → bo'sh", async (role) => {
    await service.paginateSummaries({ status: "draft" }, viewer(role));
    expect(visibleIds(captured)).toEqual([]);
  });

  test("rektor + ?status=in_review → faqat o'z navbatidagisi", async () => {
    await service.paginateSummaries({ status: "in_review" }, viewer(ROLES.REKTOR));
    expect(visibleIds(captured)).toEqual(["atRektor"]);
  });

  test("O'UB + ?status=draft → ikkala qoralama", async () => {
    await service.paginateSummaries({ status: "draft" }, viewer(ROLES.OQUV_USLUBIY_BOSHQARMA));
    expect(visibleIds(captured).sort()).toEqual(["draft", "draftNoSteps"]);
  });

  test("o'chirilgan (active:false) hech kimga ko'rinmaydi", async () => {
    await service.paginateSummaries({}, viewer(ROLES.SUPER_ADMIN));
    expect(matches({ ...DOCS[6], active: false }, captured)).toBe(false);
  });
});

const findOneOver = (docs) =>
  jest.fn((filter) => {
    const found = docs.find((d) => matches(d, filter)) || null;
    const chain = { populate: () => chain, lean: () => chain, exec: async () => found };
    chain.then = (res, rej) => Promise.resolve(found).then(res, rej);
    return chain;
  });

describe("detal — ko'rinmaydigan hujjat 404 (null)", () => {
  beforeEach(() => {
    WorkloadSummary.findOne = findOneOver(DOCS);
  });

  test.each([
    [ROLES.REKTOR, "draft", false],
    [ROLES.REKTOR, "draftNoSteps", false],
    [ROLES.REKTOR, "atProrektor", false],
    [ROLES.REKTOR, "atRektor", true],
    [ROLES.REKTOR, "superseded", true],
    [ROLES.PROREKTOR, "atFinancial", false],
    [ROLES.REJA_MOLIYA, "draft", false],
    [ROLES.REJA_MOLIYA, "atFinancial", true],
    [ROLES.OQUV_USLUBIY_BOSHQARMA, "draft", true],
    [ROLES.KAFEDRA_MUDIRI, "approved", false],
  ])("%s → %s: ko'rinadi=%s", async (role, id, visible) => {
    const doc = await service.findSummaryById(id, viewer(role));
    expect(Boolean(doc)).toBe(visible);
  });

  test("eksport filtri (readFilter) detal bilan bir xil", () => {
    const f = service.readFilter("draft", viewer(ROLES.REKTOR));
    expect(visibleIds(f)).toEqual([]);
    const g = service.readFilter("atRektor", viewer(ROLES.REKTOR));
    expect(visibleIds(g)).toEqual(["atRektor"]);
  });
});

describe("model: yangi hisobot 4 ta `pending` bosqich bilan tug'iladi", () => {
  test("default approvalSteps", () => {
    const RealModel = jest.requireActual("./workloadSummary.model");
    const doc = new RealModel({ academicYear: "64b000000000000000000001" });
    expect(doc.status).toBe("draft");
    expect(doc.approvalSteps.map((s) => [s.step, s.status])).toEqual(
      STEP_ORDER.map((s) => [s, "pending"]),
    );
  });
});

describe("removeDraft — draft va rejected o'chiriladi, qolgani 409", () => {
  const makeDoc = (status, verify) => ({
    ...DOCS.find((d) => d.status === status),
    verify,
    save: jest.fn().mockResolvedValue(undefined),
  });
  const run = (doc, role = ROLES.OQUV_USLUBIY_BOSHQARMA) => {
    WorkloadSummary.findOne = jest.fn(async (filter) => (matches(doc, filter) ? doc : null));
    return service.removeDraft(doc._id, viewer(role));
  };

  test.each(["draft", "rejected"])("%s → active:false", async (status) => {
    const doc = makeDoc(status);
    const out = await run(doc);
    expect(out).toBe(doc);
    expect(doc.active).toBe(false);
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  test.each(["in_review", "approved", "superseded"])("%s → 409, yozilmaydi", async (status) => {
    const doc = makeDoc(status);
    await expect(run(doc)).rejects.toMatchObject({ statusCode: 409 });
    expect(doc.active).toBe(true);
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("rejected + bekor qilinmagan token → o'chirishda bekor qilinadi", async () => {
    const doc = makeDoc("rejected", { token: "f".repeat(32), revokedAt: null, revokedReason: null });
    await run(doc);
    expect(doc.verify.revokedAt).toBeInstanceOf(Date);
    expect(doc.verify.revokedReason).toBe("Hisobot o'chirildi");
  });

  test("allaqachon bekor qilingan token — sabab o'zgarmaydi", async () => {
    const at = new Date("2026-09-20");
    const doc = makeDoc("rejected", { token: "f".repeat(32), revokedAt: at, revokedReason: "Tasdiq bekor qilindi" });
    await run(doc);
    expect(doc.verify).toMatchObject({ revokedAt: at, revokedReason: "Tasdiq bekor qilindi" });
  });

  test("ko'rinmaydigan hujjat (masalan rektor → draft) → null (404)", async () => {
    const doc = makeDoc("draft");
    expect(await run(doc, ROLES.REKTOR)).toBeNull();
    expect(doc.active).toBe(true);
  });
});
