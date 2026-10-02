jest.mock("./workDecision.model");

const WorkDecision = require("./workDecision.model");
const { requireDecisionReadAccess } = require("./workDecision.access");

const RESEARCHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SECRETARY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const MEMBER_ID = "cccccccccccccccccccccccc";
const STRANGER_ID = "dddddddddddddddddddddddd";
const DECISION_ID = "ffffffffffffffffffffffff";

const createMockReq = (overrides = {}) => ({
  params: { id: DECISION_ID },
  user: { _id: STRANGER_ID, role: { scopeLevel: "self" } },
  ...overrides,
});

const mockFindById = (doc) => {
  WorkDecision.findById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    }),
  });
};

const baseWork = (overrides = {}) => ({
  researcher: RESEARCHER_ID,
  secretary: SECRETARY_ID,
  councilMembers: [MEMBER_ID],
  ...overrides,
});

const baseDecision = (work = baseWork()) => ({
  _id: DECISION_ID,
  type: "seminar",
  work,
});

const run = async (req) => {
  const next = jest.fn();
  await requireDecisionReadAccess(req, {}, next);
  return next.mock.calls[0]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workDecision.access — requireDecisionReadAccess", () => {
  test("global scope (kotib) — o'tadi", async () => {
    mockFindById(baseDecision());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "global" } },
    });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("ilmiy ish muallifi (researcher) — o'tadi", async () => {
    mockFindById(baseDecision());
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("kotib (secretary) o'zi — o'tadi", async () => {
    mockFindById(baseDecision());
    const req = createMockReq({
      user: { _id: SECRETARY_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("shu ishga biriktirilgan kengash a'zosi — o'tadi", async () => {
    mockFindById(baseDecision());
    const req = createMockReq({
      user: { _id: MEMBER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("IDOR: biriktirilmagan kengash a'zosi — 403 (asosiy fix)", async () => {
    mockFindById(baseDecision());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("qaror topilmasa — 404", async () => {
    mockFindById(null);

    const err = await run(createMockReq());

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("fail-closed: qaror bor, `work` null (ish o'chirilgan) — 403", async () => {
    mockFindById(baseDecision(null));
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("populate qilingan researcher (obyekt, _id bilan) — to'g'ri ishlaydi", async () => {
    mockFindById(
      baseDecision(
        baseWork({ researcher: { _id: RESEARCHER_ID, firstName: "Ali" } }),
      ),
    );
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(req);

    expect(err).toBeUndefined();
  });

  test("guard o'tganda `req.decision` keyingi middleware uchun o'rnatiladi", async () => {
    const decision = baseDecision();
    mockFindById(decision);
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    await run(req);

    expect(req.decision).toBe(decision);
  });
});

describe("workDecision.access — middleware tartibi buzilishi", () => {
  test("req.user yo'q -> 500 (authenticate avval chaqirilmagan)", async () => {
    const req = { params: { id: DECISION_ID }, user: undefined };

    const err = await run(req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });
});
