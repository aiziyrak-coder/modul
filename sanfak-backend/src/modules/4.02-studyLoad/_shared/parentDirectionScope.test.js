jest.mock("#references/direction/direction.model", () => ({
  find: jest.fn(),
}));

const Direction = require("#references/direction/direction.model");
const parentDirectionScope = require("./parentDirectionScope");
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

const createParentModel = () => ({ find: jest.fn() });

const run = async (req, options) => {
  const next = createMockNext();
  const middleware = parentDirectionScope(options);
  await middleware(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parentDirectionScope — options validatsiyasi", () => {
  test("parentModel yoki parentRefField berilmasa — Error throw qiladi", () => {
    expect(() => parentDirectionScope({})).toThrow(
      "parentDirectionScope: 'parentModel' va 'parentRefField' options majburiy",
    );
    expect(() =>
      parentDirectionScope({ parentModel: createParentModel() }),
    ).toThrow();
    expect(() =>
      parentDirectionScope({ parentRefField: "learningProcess" }),
    ).toThrow();
  });
});

describe("parentDirectionScope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(Direction.find).not.toHaveBeenCalled();
    expect(parentModel.find).not.toHaveBeenCalled();
  });

  test("faculty → yo'nalishlar Direction.find bilan, keyin ota hujjatlar parentModel.find bilan topiladi", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }, { _id: "dir2" }]);
    const parentModel = createParentModel();
    mockFindChain(parentModel.find, [{ _id: "lp1" }, { _id: "lp2" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    expect(Direction.find).toHaveBeenCalledWith({ faculty: "f1", active: true });
    expect(parentModel.find).toHaveBeenCalledWith({
      direction: { $in: ["dir1", "dir2"] },
    });
    expect(req.scope).toEqual({ learningProcess: { $in: ["lp1", "lp2"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("department → faculty bilan BIR XIL natija beradi (kafedra darajasida alohida egalik yo'q)", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }]);
    const parentModel = createParentModel();
    mockFindChain(parentModel.find, [{ _id: "ws1" }]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "department" },
      },
    });
    const next = await run(req, { parentModel, parentRefField: "workingSchedule" });

    expect(Direction.find).toHaveBeenCalledWith({ faculty: "f1", active: true });
    expect(parentModel.find).toHaveBeenCalledWith({ direction: { $in: ["dir1"] } });
    expect(req.scope).toEqual({ workingSchedule: { $in: ["ws1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("faculty/department → fakultet aniqlanmasa 403, parentModel.find chaqirilmaydi", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: null },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(403);
    expect(Direction.find).not.toHaveBeenCalled();
    expect(parentModel.find).not.toHaveBeenCalled();
  });

  test("self (default) → FAIL-CLOSED, req.scope = { _id: { $in: [] } } (DB so'rovisiz)", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    expect(req.scope).toEqual({ _id: { $in: [] } });
    expect(next).toHaveBeenCalledWith();
    expect(Direction.find).not.toHaveBeenCalled();
    expect(parentModel.find).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' (fail-closed) sifatida ishlaydi", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    expect(req.scope).toEqual({ _id: { $in: [] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("bypassRoles dagi rol → req.scope = {} (scope qo'llanmaydi)", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({
      user: {
        _id: "u1",
        role: { title: ROLES.REJA_MOLIYA, scopeLevel: "self" },
      },
    });
    const next = await run(req, {
      parentModel,
      parentRefField: "learningProcess",
      bypassRoles: [ROLES.REJA_MOLIYA],
    });

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(Direction.find).not.toHaveBeenCalled();
    expect(parentModel.find).not.toHaveBeenCalled();
  });

  test("req.user yo'q → 500 (authenticate avval chaqirilmagan)", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({ user: undefined });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(500);
  });

  test("role biriktirilmagan → 403", async () => {
    const parentModel = createParentModel();
    const req = createMockReq({ user: { _id: "u1", role: undefined } });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(403);
  });
});

const { narrowParentFilter } = require("./parentDirectionScope");

describe("narrowParentFilter — query param scope'ni buzmaydi", () => {
  test("query berilmasa — scope o'zgarmaydi", () => {
    const scope = { workingSchedule: { $in: ["a", "b"] } };
    expect(narrowParentFilter(scope, "workingSchedule", undefined)).toEqual(scope);
  });

  test("global scope ({}) — istalgan qiymat so'ralishi mumkin", () => {
    expect(narrowParentFilter({}, "workingSchedule", "x1")).toEqual({
      workingSchedule: "x1",
    });
  });

  test("faculty/department scope — ro'yxatdagi qiymat o'tadi", () => {
    const scope = { workingSchedule: { $in: ["a", "b"] } };
    expect(narrowParentFilter(scope, "workingSchedule", "b")).toEqual({
      workingSchedule: "b",
    });
  });

  test("faculty/department scope — ro'yxatdan TASHQARI qiymat → bo'sh natija", () => {
    const scope = { workingSchedule: { $in: ["a", "b"] } };
    expect(narrowParentFilter(scope, "workingSchedule", "zzz")).toEqual({
      workingSchedule: { $in: [] },
    });
  });

  test("self (fail-closed) scope — qiymat so'ralsa QO'SHILADI, lekin _id:{$in:[]} baribir hech narsa qaytarmaydi", () => {
    const scope = { _id: { $in: [] } };
    expect(narrowParentFilter(scope, "workingSchedule", "x1")).toEqual({
      _id: { $in: [] },
      workingSchedule: "x1",
    });
  });

  test("ObjectId/string turlari aralash bo'lsa ham to'g'ri solishtiradi", () => {
    const idLike = { toString: () => "abc123" };
    expect(
      narrowParentFilter(
        { learningProcess: { $in: [idLike] } },
        "learningProcess",
        "abc123",
      ),
    ).toEqual({ learningProcess: "abc123" });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("parentDirectionScope — ADR-030 fakultet langari (birlashgan faculty|department case)", () => {
  test("(c) dekan: users.faculty ≠ department.faculty → Direction.find users.faculty bilan", async () => {
    mockFindChain(Direction.find, [{ _id: "dir1" }]);
    const parentModel = createParentModel();
    mockFindChain(parentModel.find, [{ _id: "lp1" }]);
    const req = createMockReq({
      user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });
    expect(Direction.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(req.scope).toEqual({ learningProcess: { $in: ["lp1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("RIPPLE QOPQONI: kafedra mudiri (scopeLevel department), users.faculty eskirgan → FAQAT department.faculty", async () => {
    mockFindChain(Direction.find, [{ _id: "dirDep" }]);
    const parentModel = createParentModel();
    mockFindChain(parentModel.find, [{ _id: "lpDep" }]);
    const req = createMockReq({
      user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "department" } },
    });
    const next = await run(req, { parentModel, parentRefField: "learningProcess" });
    expect(Direction.find).toHaveBeenCalledWith({ faculty: F_DEP, active: true });
    expect(req.scope).toEqual({ learningProcess: { $in: ["lpDep"] } });
    expect(next).toHaveBeenCalledWith();
  });
});
