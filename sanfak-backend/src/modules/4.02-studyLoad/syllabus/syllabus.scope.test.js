jest.mock("#modules/4.01-auth/user/user.model", () => ({
  find: jest.fn(),
}));

const User = require("#modules/4.01-auth/user/user.model");
const syllabusScope = require("./syllabus.scope");
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
  const middleware = syllabusScope(options);
  await middleware(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("syllabus.scope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("department → kafedra a'zolari User.find bilan topiladi, 'author.teacher': { $in: [...] }", async () => {
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
    expect(req.scope).toEqual({ "author.teacher": { $in: ["m1", "m2"] } });
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

  test("faculty → req.scope = { faculty: <id> } (model'da maydon bor, qo'shimcha so'rov shart emas)", async () => {
    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ faculty: "f1" });
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
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
  });

  test("self (default) → req.scope = { 'author.teacher': <o'zi> } (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ "author.teacher": "u1" });
    expect(next).toHaveBeenCalledWith();
    expect(User.find).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' sifatida ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({ "author.teacher": "u1" });
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

const { narrowTeacherFilter } = require("./syllabus.scope");

describe("narrowTeacherFilter — query param scope'ni buzmaydi", () => {
  test("teacher query berilmasa — scope o'zgarmaydi", () => {
    const scope = { "author.teacher": { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan teacher so'ralishi mumkin", () => {
    expect(narrowTeacherFilter({}, "x1")).toEqual({ "author.teacher": "x1" });
  });

  test("faculty scope — teacher QO'SHILADI, faculty saqlanadi (AND — bypass yo'q)", () => {
    expect(narrowTeacherFilter({ faculty: "f1" }, "x1")).toEqual({
      faculty: "f1",
      "author.teacher": "x1",
    });
  });

  test("self scope — o'zini so'rasa o'tadi", () => {
    expect(narrowTeacherFilter({ "author.teacher": "u1" }, "u1")).toEqual({
      "author.teacher": "u1",
    });
  });

  test("self scope — BOSHQANI so'rasa bo'sh natija (bypass yo'q)", () => {
    expect(narrowTeacherFilter({ "author.teacher": "u1" }, "u2")).toEqual({
      "author.teacher": { $in: [] },
    });
  });

  test("department scope — ro'yxatdagi teacher o'tadi", () => {
    const scope = { "author.teacher": { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, "b")).toEqual({ "author.teacher": "b" });
  });

  test("department scope — ro'yxatdan TASHQARI teacher → bo'sh natija", () => {
    const scope = { "author.teacher": { $in: ["a", "b"] } };
    expect(narrowTeacherFilter(scope, "zzz")).toEqual({
      "author.teacher": { $in: [] },
    });
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    expect(
      narrowTeacherFilter({ "author.teacher": { $in: [idLike] } }, "abc123"),
    ).toEqual({ "author.teacher": "abc123" });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("syllabus.scope — ADR-030 fakultet langari", () => {
  test("(c) dekan: users.faculty ≠ department.faculty → req.scope.faculty = users.faculty", async () => {
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(req.scope).toEqual({ faculty: F_OWN });
    expect(next).toHaveBeenCalledWith();
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → 403 emas", async () => {
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: null, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(req.scope).toEqual({ faculty: F_OWN });
    expect(next).toHaveBeenCalledWith();
  });
});
