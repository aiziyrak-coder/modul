jest.mock("#references/direction/direction.model", () => ({
  find: jest.fn(),
}));

const Direction = require("#references/direction/direction.model");
const workingScheduleScope = require("./workingSchedule.scope");
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
  const middleware = workingScheduleScope(options);
  await middleware(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workingSchedule.scope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(Direction.find).not.toHaveBeenCalled();
  });

  test("faculty → fakultetdagi yo'nalishlar Direction.find bilan topiladi, direction: { $in: [...] }", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }, { _id: "dir2" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(Direction.find).toHaveBeenCalledWith({ faculty: "f1", active: true });
    expect(req.scope).toEqual({ direction: { $in: ["dir1", "dir2"] } });
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
    expect(Direction.find).not.toHaveBeenCalled();
  });

  test("department → faculty bilan BIR XIL natija beradi (kafedra darajasida alohida egalik yo'q)", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "department" },
      },
    });
    const next = await run(req);

    expect(Direction.find).toHaveBeenCalledWith({ faculty: "f1", active: true });
    expect(req.scope).toEqual({ direction: { $in: ["dir1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("department → kafedra/fakultet aniqlanmasa 403", async () => {
    const req = createMockReq({
      user: { _id: "u1", department: null, role: { scopeLevel: "department" } },
    });
    const next = await run(req);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(403);
  });

  test("self (default) → FAIL-CLOSED, req.scope = { _id: { $in: [] } } (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ _id: { $in: [] } });
    expect(next).toHaveBeenCalledWith();
    expect(Direction.find).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' (fail-closed) sifatida ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({ _id: { $in: [] } });
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
    expect(Direction.find).not.toHaveBeenCalled();
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

const { narrowDirectionFilter } = require("./workingSchedule.scope");

describe("narrowDirectionFilter — query param scope'ni buzmaydi", () => {
  test("direction query berilmasa — scope o'zgarmaydi", () => {
    const scope = { direction: { $in: ["a", "b"] } };
    expect(narrowDirectionFilter(scope, undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan direction so'ralishi mumkin", () => {
    expect(narrowDirectionFilter({}, "x1")).toEqual({ direction: "x1" });
  });

  test("faculty/department scope — ro'yxatdagi direction o'tadi", () => {
    const scope = { direction: { $in: ["a", "b"] } };
    expect(narrowDirectionFilter(scope, "b")).toEqual({ direction: "b" });
  });

  test("faculty/department scope — ro'yxatdan TASHQARI direction → bo'sh natija", () => {
    const scope = { direction: { $in: ["a", "b"] } };
    expect(narrowDirectionFilter(scope, "zzz")).toEqual({
      direction: { $in: [] },
    });
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    expect(
      narrowDirectionFilter({ direction: { $in: [idLike] } }, "abc123"),
    ).toEqual({ direction: "abc123" });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("workingSchedule.scope — ADR-030 fakultet langari (birlashgan faculty|department case)", () => {
  test("(c) dekan (scopeLevel faculty): users.faculty ≠ department.faculty → Direction.find users.faculty bilan", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Direction.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ direction: { $in: ["dir1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → 403 emas, fakultet yo'nalishlari", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }, { _id: "dir2" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: null, role: { scopeLevel: "faculty" } } });
    const next = await run(req);
    expect(Direction.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ direction: { $in: ["dir1", "dir2"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("RIPPLE QOPQONI: kafedra mudiri (scopeLevel department), users.faculty eskirgan → FAQAT department.faculty", async () => {
    mockFindChain(Direction.find, [{ _id: "dirDep" }]);
    const req = createMockReq({ user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "department" } } });
    const next = await run(req);
    expect(Direction.find).toHaveBeenCalledWith({ faculty: F_DEP, active: true });
    expect(req.scope).toEqual({ direction: { $in: ["dirDep"] } });
    expect(next).toHaveBeenCalledWith();
  });
});
