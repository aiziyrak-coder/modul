jest.mock("#modules/4.01-auth/user/user.model", () => ({
  find: jest.fn(),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(),
}));

const User = require("#modules/4.01-auth/user/user.model");
const Department = require("#references/department/department.model");
const teacherLeaveScope = require("./teacherLeave.scope");

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

const run = async (req) => {
  const next = createMockNext();
  await teacherLeaveScope(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("teacherLeave.scope — scopeLevel bo'yicha req.scope", () => {
  test("self → req.scope = { teacher: <o'zi> } (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ teacher: "u1" });
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' sifatida ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({ teacher: "u1" });
    expect(next).toHaveBeenCalledWith();
  });

  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("department → kafedra a'zolari User.find bilan topiladi, teacher: { $in: [...] }", async () => {
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
    expect(req.scope).toEqual({ teacher: { $in: ["m1", "m2"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("department → a'zo topilmasa ham xato bermaydi, bo'sh $in qaytadi", async () => {
    mockFindChain(User.find, []);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "d1" },
        role: { scopeLevel: "department" },
      },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ teacher: { $in: [] } });
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

  test("faculty → fakultetdagi kafedralar topiladi, keyin a'zolar → teacher: { $in: [...] }", async () => {
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
    expect(req.scope).toEqual({ teacher: { $in: ["m1", "m2", "m3"] } });
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

const { narrowTeacherFilter } = require("./teacherLeave.scope");

describe("narrowTeacherFilter — query param scope'ni buzmaydi", () => {
  test("teacher query berilmasa — scope o'zgarmaydi", () => {
    const scope = { teacher: { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan teacher so'ralishi mumkin", () => {
    expect(narrowTeacherFilter({}, "x1")).toEqual({ teacher: "x1" });
  });

  test("self scope — o'zini so'rasa o'tadi", () => {
    expect(narrowTeacherFilter({ teacher: "u1" }, "u1")).toEqual({
      teacher: "u1",
    });
  });

  test("self scope — BOSHQANI so'rasa bo'sh natija (bypass yo'q)", () => {
    expect(narrowTeacherFilter({ teacher: "u1" }, "u2")).toEqual({
      teacher: { $in: [] },
    });
  });

  test("department scope — ro'yxatdagi teacher o'tadi", () => {
    const scope = { teacher: { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, "b")).toEqual({ teacher: "b" });
  });

  test("department scope — ro'yxatdan TASHQARI teacher → bo'sh natija", () => {
    const scope = { teacher: { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, "zzz")).toEqual({
      teacher: { $in: [] },
    });
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    expect(narrowTeacherFilter({ teacher: { $in: [idLike] } }, "abc123")).toEqual({
      teacher: "abc123",
    });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("teacherLeave.scope — ADR-030 fakultet langari", () => {
  test("(c) dekan: users.faculty ≠ department.faculty → users.faculty g'olib", async () => {
    mockFindChain(Department.find, [{ _id: "d1" }]);
    mockFindChain(User.find, [{ _id: "m1" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ teacher: { $in: ["m1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → doira ochiladi", async () => {
    mockFindChain(Department.find, [{ _id: "d1" }]);
    mockFindChain(User.find, [{ _id: "m1" }, { _id: "m2" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: null, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ teacher: { $in: ["m1", "m2"] } });
    expect(next).toHaveBeenCalledWith();
  });
});
