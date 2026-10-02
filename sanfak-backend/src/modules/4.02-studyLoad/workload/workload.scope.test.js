jest.mock("#modules/4.02-studyLoad/_shared/scopeHelpers", () => ({
  resolveFacultyDepartmentIds: jest.fn(),
}));

const {
  resolveFacultyDepartmentIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");
const workloadScope = require("./workload.scope");
const { ROLES } = require("#config/constants");

const createMockReq = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  user: { _id: "507f1f77bcf86cd799439011", role: { scopeLevel: "self" } },
  ...overrides,
});

const createMockNext = () => jest.fn();

const run = async (req, options) => {
  const next = createMockNext();
  const middleware = workloadScope(options);
  await middleware(req, {}, next);
  return next;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workload.scope — scopeLevel bo'yicha req.scope", () => {
  test("global → req.scope = {} (DB so'rovisiz)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "global" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
  });

  test("department → req.scope = { department: <id> } (model'da maydon bor, qo'shimcha so'rov shart emas)", async () => {
    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "d1", faculty: "f1" },
        role: { scopeLevel: "department" },
      },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ department: "d1" });
    expect(next).toHaveBeenCalledWith();
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
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
  });

  test("faculty → fakultetdagi kafedralar resolveFacultyDepartmentIds bilan topiladi, keyin department: { $in: [...] }", async () => {
    resolveFacultyDepartmentIds.mockResolvedValue(["d1", "d2", "d3"]);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(resolveFacultyDepartmentIds).toHaveBeenCalledWith(req.user);
    expect(req.scope).toEqual({ department: { $in: ["d1", "d2", "d3"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("faculty → resolveFacultyDepartmentIds bo'sh/null qaytarsa ham fail-closed {$in: []}", async () => {
    resolveFacultyDepartmentIds.mockResolvedValue(null);

    const req = createMockReq({
      user: {
        _id: "u1",
        department: { _id: "dSelf", faculty: "f1" },
        role: { scopeLevel: "faculty" },
      },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ department: { $in: [] } });
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
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
  });

  test("self (default) → req.scope = { _id: { $in: [] } } — fail-closed (WorkloadSchema'da egasi maydoni yo'q, OQITUVCHI WORKLOAD permission'iga ega emas)", async () => {
    const req = createMockReq({
      user: { _id: "u1", role: { scopeLevel: "self" } },
    });
    const next = await run(req);

    expect(req.scope).toEqual({ _id: { $in: [] } });
    expect(next).toHaveBeenCalledWith();
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
  });

  test("scopeLevel yo'q (undefined) → default 'self' sifatida fail-closed ishlaydi", async () => {
    const req = createMockReq({ user: { _id: "u1", role: {} } });
    const next = await run(req);

    expect(req.scope).toEqual({ _id: { $in: [] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("bypassRoles dagi rol → req.scope = {} (scope qo'llanmaydi)", async () => {
    const req = createMockReq({
      user: {
        _id: "u1",
        role: { title: ROLES.REJA_MOLIYA, scopeLevel: "global" },
      },
    });
    const next = await run(req, { bypassRoles: [ROLES.REJA_MOLIYA] });

    expect(req.scope).toEqual({});
    expect(next).toHaveBeenCalledWith();
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
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

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("workload.scope — ADR-030 fakultet langari (403 darvozasi)", () => {
  test("(a) kafedrasiz dekan, faqat users.faculty → 403 EMAS, helper chaqiriladi", async () => {
    resolveFacultyDepartmentIds.mockResolvedValue(["d1"]);
    const req = createMockReq({
      user: { _id: "u1", faculty: F_OWN, department: null, role: { scopeLevel: "faculty" } },
    });
    const next = await run(req);
    expect(resolveFacultyDepartmentIds).toHaveBeenCalledWith(req.user);
    expect(req.scope).toEqual({ department: { $in: ["d1"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("(c) dekan: users.faculty ≠ department.faculty → darvozadan o'tadi (langar helper'da hal bo'ladi)", async () => {
    resolveFacultyDepartmentIds.mockResolvedValue(["d1", "d2"]);
    const req = createMockReq({
      user: { _id: "u1", faculty: F_OWN, department: { _id: "dSelf", faculty: F_DEP }, role: { scopeLevel: "faculty" } },
    });
    const next = await run(req);
    expect(req.scope).toEqual({ department: { $in: ["d1", "d2"] } });
    expect(next).toHaveBeenCalledWith();
  });

  test("fakultetsiz va kafedrasiz dekan → 403 (fail-closed saqlanadi)", async () => {
    const req = createMockReq({
      user: { _id: "u1", faculty: null, department: null, role: { scopeLevel: "faculty" } },
    });
    const next = await run(req);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
    expect(resolveFacultyDepartmentIds).not.toHaveBeenCalled();
  });
});
