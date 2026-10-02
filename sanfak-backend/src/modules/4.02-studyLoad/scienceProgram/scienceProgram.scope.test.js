jest.mock("#modules/4.01-auth/user/user.model", () => ({
  find: jest.fn(),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(),
}));
jest.mock("./scienceProgram.assignedSciences", () => ({
  resolveAssignedScienceIds: jest.fn(),
}));

const User = require("#modules/4.01-auth/user/user.model");
const Department = require("#references/department/department.model");
const { resolveAssignedScienceIds } = require("./scienceProgram.assignedSciences");
const scienceProgramScope = require("./scienceProgram.scope");
const { ROLES } = require("#config/constants");

const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { scopeLevel: "self" } },
  ...overrides,
});

const createMockNext = () => jest.fn();

const mockFindChain = (mockFn, resolvedDocs) => {
  mockFn.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(resolvedDocs),
    }),
  });
};

const run = async (req, options) => {
  const next = createMockNext();
  const middleware = scienceProgramScope(options);
  await middleware(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scienceProgram.scope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("department → kafedra a'zolari User.find bilan topiladi, user: { $in: [...] }", async () => {
    mockFindChain(User.find, [{ _id: "m1" }, { _id: "m2" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "d1", faculty: "f1" },
        role: { scopeLevel: "department" },
      },
    });
    const next = await run(req);

    expect(User.find).toHaveBeenCalledWith({ department: "d1", active: true });
    expect(req.scope).toEqual({ user: { $in: ["m1", "m2"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("department → kafedra biriktirilmagan bo'lsa 403 (next xato bilan chaqiriladi)", async () => {
    const req = createMockReq({
      user: { _id: "u1", department: null, role: { scopeLevel: "department" } },
    });
    const next = await run(req);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(User.find).not.toHaveBeenCalled();
  });

  test("faculty → fakultetdagi kafedralar topiladi, keyin a'zolar → user: { $in: [...] }", async () => {
    mockFindChain(Department.find, [{ _id: "d1" }, { _id: "d2" }]);
    mockFindChain(User.find, [{ _id: "m1" }, { _id: "m2" }, { _id: "m3" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(Department.find).toHaveBeenCalledWith({ faculty: "f1", active: true });
    expect(User.find).toHaveBeenCalledWith({
      department: { $in: ["d1", "d2"] },
      active: true,
    });
    expect(req.scope).toEqual({ user: { $in: ["m1", "m2", "m3"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("faculty → fakultet aniqlanmasa 403 (next xato bilan chaqiriladi)", async () => {
    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: null },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(Department.find).not.toHaveBeenCalled();
  });

  test("self (default) → req.scope = { user: <o'zi> } (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ user: "u1" });
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' sifatida ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({ user: "u1" });
    expect(next).toHaveBeenCalledWith();
  });

  test("bypassRoles dagi rol → req.scope = {} (scope qo'llanmaydi)", async () => {
    const req = createMockReq({
      user: {
        _id: "u1",
        role: { title: ROLES.REJA_MOLIYA, scopeLevel: "self" },
      },
    });
    const next = await run(req, { bypassRoles: [ROLES.REJA_MOLIYA] });

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("req.user yo'q → 500 (authenticate avval chaqirilmagan)", async () => {
    const req = createMockReq({ user: undefined });
    const next = await run(req);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(500);
  });

  test("role biriktirilmagan → 403", async () => {
    const req = createMockReq({ user: { _id: "u1", role: undefined } });
    const next = await run(req);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(403);
  });
});

const { narrowUserFilter } = require("./scienceProgram.scope");

describe("T-05 — oqituvchi GET: o'ziniki ∪ biriktirilgan fanlarning approved dasturlari", () => {
  const teacherReq = (method, overrides = {}) =>
    createMockReq({
      method,
      user: { _id: "u1", role: { title: ROLES.OQITUVCHI, scopeLevel: "self" } },
      ...overrides,
    });

  test("GET + biriktirilgan fanlar bor → $or: [{user: me}, {status: approved, science ∈ ids}]", async () => {
    resolveAssignedScienceIds.mockResolvedValue(["sci1", "sci2"]);
    const req = teacherReq("GET");
    const next = await run(req);

    expect(resolveAssignedScienceIds).toHaveBeenCalledWith("u1");
    expect(req.scope).toEqual({
      $or: [{ user: "u1" }, { status: "approved", science: { $in: ["sci1", "sci2"] } }],
    });
    expect(next).toHaveBeenCalledWith();
  });

  test("GET + biriktirma YO'Q → eski {user: me} (o'zgarish yo'q)", async () => {
    resolveAssignedScienceIds.mockResolvedValue([]);
    const req = teacherReq("GET");
    await run(req);

    expect(req.scope).toEqual({ user: "u1" });
  });

  test.each(["POST", "PUT", "PATCH", "DELETE"])(
    "%s (yozuv) → har doim {user: me}, biriktirma so'ralmaydi ham",
    async (method) => {
      resolveAssignedScienceIds.mockResolvedValue(["sci1"]);
      const req = teacherReq(method);
      await run(req);

      expect(req.scope).toEqual({ user: "u1" });
      expect(resolveAssignedScienceIds).not.toHaveBeenCalled();
    },
  );

});

describe("T-05 — chegaralar: rol, xato (fail-closed)", () => {
  const teacherReq = (method, overrides = {}) =>
    createMockReq({
      method,
      user: { _id: "u1", role: { title: ROLES.OQITUVCHI, scopeLevel: "self" } },
      ...overrides,
    });

  test("GET, lekin rol oqituvchi EMAS (boshqa self rol) → {user: me}", async () => {
    resolveAssignedScienceIds.mockResolvedValue(["sci1"]);
    const req = createMockReq({
      method: "GET",
      user: { _id: "u1", role: { title: "talaba", scopeLevel: "self" } },
    });
    await run(req);

    expect(req.scope).toEqual({ user: "u1" });
    expect(resolveAssignedScienceIds).not.toHaveBeenCalled();
  });

  test("yordamchi xato bersa — 500 (jimgina kengroq doira BERILMAYDI, fail-closed)", async () => {
    resolveAssignedScienceIds.mockRejectedValue(new Error("db yo'q"));
    const req = teacherReq("GET");
    const next = await run(req);

    expect(req.scope).toBeUndefined();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });
});

describe("narrowUserFilter — query param scope'ni buzmaydi", () => {
  test("user query berilmasa — scope o'zgarmaydi", () => {
    const scope = { user: { $in: ["a", "b"] } };
    expect(narrowUserFilter(scope, undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan user so'ralishi mumkin", () => {
    expect(narrowUserFilter({}, "x1")).toEqual({ user: "x1" });
  });

  test("self scope — o'zini so'rasa o'tadi", () => {
    expect(narrowUserFilter({ user: "u1" }, "u1")).toEqual({ user: "u1" });
  });

  test("self scope — BOSHQANI so'rasa bo'sh natija (bypass yo'q)", () => {
    expect(narrowUserFilter({ user: "u1" }, "u2")).toEqual({
      user: { $in: [] },
    });
  });

  test("department/faculty scope — ro'yxatdagi user o'tadi", () => {
    const scope = { user: { $in: ["a", "b"] } };
    expect(narrowUserFilter(scope, "b")).toEqual({ user: "b" });
  });

  test("department/faculty scope — ro'yxatdan TASHQARI user → bo'sh natija", () => {
    const scope = { user: { $in: ["a", "b"] } };
    expect(narrowUserFilter(scope, "zzz")).toEqual({
      user: { $in: [] },
    });
  });

  test("T-05 $or scope — `?user=` AND bilan qo'shiladi (doira torayadi, kengaymaydi)", () => {
    const scope = { $or: [{ user: "u1" }, { status: "approved", science: { $in: ["s1"] } }] };
    expect(narrowUserFilter(scope, "u1")).toEqual({ ...scope, user: "u1" });
    expect(narrowUserFilter(scope, undefined)).toEqual(scope);
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    expect(narrowUserFilter({ user: { $in: [idLike] } }, "abc123")).toEqual({
      user: "abc123",
    });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("scienceProgram.scope — ADR-030 fakultet langari", () => {
  test("(c) dekan: users.faculty ≠ department.faculty → users.faculty g'olib", async () => {
    mockFindChain(Department.find, [{ _id: "d1" }]);
    mockFindChain(User.find, [{ _id: "m1" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ user: { $in: ["m1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → doira ochiladi", async () => {
    mockFindChain(Department.find, [{ _id: "d1" }]);
    mockFindChain(User.find, [{ _id: "m1" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: null, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(next).toHaveBeenCalledWith();
  });
});
