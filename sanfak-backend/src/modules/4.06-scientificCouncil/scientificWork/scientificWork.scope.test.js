const scientificWorkScope = require("./scientificWork.scope");
const { narrowMemberFilter } = require("./scientificWork.scope");

const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { scopeLevel: "self" } },
  ...overrides,
});

const createMockNext = () => jest.fn();

const run = async (req) => {
  const next = createMockNext();
  await scientificWorkScope(req, {}, next);
  return next;
};

describe("scientificWork.scope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (kotib va h.k.)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
  });

  test("self → req.scope = { $or: [{researcher}, {councilMembers}] } (oqituvchi/a'zo)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({
      $or: [{ researcher: "u1" }, { councilMembers: "u1" }],
    });
    expect(next).toHaveBeenCalledWith();
  });

  test("scopeLevel yo'q (undefined) → default 'self' sifatida ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({
      $or: [{ researcher: "u1" }, { councilMembers: "u1" }],
    });
    expect(next).toHaveBeenCalledWith();
  });

  test("boshqa scopeLevel qiymatlari (masalan 'department') ham 'self' kabi ishlaydi — modelda bunday maydon yo'q", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "department" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({
      $or: [{ researcher: "u1" }, { councilMembers: "u1" }],
    });
    expect(next).toHaveBeenCalledWith();
  });

  test("req.user yo'q → 500 (authenticate avval chaqirilmagan)", async () => {
    const req = { user: undefined };
    const next = await run(req);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(500);
  });

  test("role biriktirilmagan → 403", async () => {
    const req = createMockReq({ user: { _id: "u1", role: undefined } });
    const next = await run(req);

    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });
});

describe("narrowMemberFilter — query param scope'ni buzmaydi", () => {
  test("memberId berilmasa — scope o'zgarmaydi", () => {
    const scope = { $or: [{ researcher: "u1" }, { councilMembers: "u1" }] };
    expect(narrowMemberFilter(scope, undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan memberId erkin so'ralishi mumkin", () => {
    expect(narrowMemberFilter({}, "x1")).toEqual({ councilMembers: "x1" });
  });

  test("self scope — o'zini so'rasa o'tadi", () => {
    const scope = { $or: [{ researcher: "u1" }, { councilMembers: "u1" }] };
    expect(narrowMemberFilter(scope, "u1")).toEqual({
      $or: [{ researcher: "u1" }, { councilMembers: "u1" }],
      councilMembers: "u1",
    });
  });

  test("self scope — BEGONA memberId so'rasa bo'sh natija (bypass yo'q, hujjat mavjudligi oshkor qilinmaydi)", () => {
    const scope = { $or: [{ researcher: "u1" }, { councilMembers: "u1" }] };
    expect(narrowMemberFilter(scope, "u2")).toEqual({
      councilMembers: { $in: [] },
    });
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    const scope = { $or: [{ researcher: idLike }, { councilMembers: idLike }] };
    expect(narrowMemberFilter(scope, "abc123")).toEqual({
      ...scope,
      councilMembers: "abc123",
    });
  });
});
