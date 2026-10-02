jest.mock("./scientificWork.model");

const ScientificWork = require("./scientificWork.model");
const {
  requireReadAccess,
  requireWriteAccess,
} = require("./scientificWork.access");

const RESEARCHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SECRETARY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const MEMBER_ID = "cccccccccccccccccccccccc";
const STRANGER_ID = "dddddddddddddddddddddddd";
const WORK_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const createMockReq = (overrides = {}) => ({
  params: { id: WORK_ID },
  user: { _id: STRANGER_ID, role: { scopeLevel: "self" } },
  ...overrides,
});

const createMockNext = () => jest.fn();

const mockFindById = (doc) => {
  ScientificWork.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(doc),
  });
};

const baseWork = (overrides = {}) => ({
  _id: WORK_ID,
  researcher: RESEARCHER_ID,
  secretary: SECRETARY_ID,
  councilMembers: [MEMBER_ID],
  ...overrides,
});

const run = async (guard, req) => {
  const next = createMockNext();
  await guard(req, {}, next);
  return next.mock.calls[0]?.[0];
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scientificWork.access — requireReadAccess", () => {
  test("global scope foydalanuvchi — o'tadi (masalan kotib)", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "global" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeUndefined();
    expect(req.work).toEqual(baseWork());
  });

  test("muallif (researcher) — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeUndefined();
  });

  test("kotib (secretary) o'zi — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: SECRETARY_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeUndefined();
  });

  test("biriktirilgan kengash a'zosi (councilMembers) — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: MEMBER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeUndefined();
  });

  test("begona foydalanuvchi — 403", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("hujjat topilmasa — 404", async () => {
    mockFindById(null);
    const req = createMockReq();

    const err = await run(requireReadAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("populate qilingan researcher (obyekt, _id bilan) — to'g'ri ishlaydi", async () => {
    mockFindById(
      baseWork({ researcher: { _id: RESEARCHER_ID, firstName: "Ali" } }),
    );
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireReadAccess, req);

    expect(err).toBeUndefined();
  });
});

describe("scientificWork.access — requireWriteAccess", () => {
  test("global scope foydalanuvchi — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "global" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeUndefined();
  });

  test("muallif (researcher) — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: RESEARCHER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeUndefined();
  });

  test("kotib (secretary) o'zi — o'tadi", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: SECRETARY_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeUndefined();
  });

  test("biriktirilgan kengash a'zosi (councilMembers) — 403 (faqat ko'radi, tahrirlay olmaydi)", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: MEMBER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("begona foydalanuvchi — 403", async () => {
    mockFindById(baseWork());
    const req = createMockReq({
      user: { _id: STRANGER_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });

  test("hujjat topilmasa — 404", async () => {
    mockFindById(null);
    const req = createMockReq();

    const err = await run(requireWriteAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("populate qilingan secretary (obyekt, _id bilan) — to'g'ri ishlaydi", async () => {
    mockFindById(
      baseWork({ secretary: { _id: SECRETARY_ID, firstName: "Vali" } }),
    );
    const req = createMockReq({
      user: { _id: SECRETARY_ID, role: { scopeLevel: "self" } },
    });

    const err = await run(requireWriteAccess, req);

    expect(err).toBeUndefined();
  });
});

describe("scientificWork.access — middleware tartibi buzilishi", () => {
  test("req.user yo'q -> 500 (authenticate avval chaqirilmagan)", async () => {
    const req = { params: { id: WORK_ID }, user: undefined };

    const err = await run(requireReadAccess, req);

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });
});
