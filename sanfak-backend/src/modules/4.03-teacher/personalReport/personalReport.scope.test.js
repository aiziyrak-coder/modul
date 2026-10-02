jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#references/department/department.model");

const User = require("#modules/4.01-auth/user/user.model");
const Department = require("#references/department/department.model");
const personalReportScope = require("./personalReport.scope");
const { narrowTeacherFilter } = require("./personalReport.scope");
const { ROLES } = require("#config/constants");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const FAC_ID = "cccccccccccccccccccccccc";
const MATE_1 = "dddddddddddddddddddddddd";

const mockUsers = (ids) => {
  User.find = jest.fn().mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(ids.map((_id) => ({ _id }))) }),
  });
};
const mockDepartments = (ids) => {
  Department.find = jest.fn().mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(ids.map((_id) => ({ _id }))) }),
  });
};

const run = (req, opts = {}) =>
  new Promise((resolve) => {
    personalReportScope(opts)(req, {}, (err) => resolve(err ? { err } : { scope: req.scope }));
  });

const reqAs = (scopeLevel, extra = {}) => ({
  user: {
    _id: USER_ID,
    role: { title: "x", scopeLevel },
    department: { _id: DEPT_ID, faculty: FAC_ID },
    ...extra,
  },
});

beforeEach(() => jest.clearAllMocks());

describe("personalReportScope — har scopeLevel to'g'ri filtr beradi", () => {
  test("self — o'qituvchi faqat o'z hisobotini ko'radi", async () => {
    const { scope } = await run(reqAs("self"));
    expect(scope).toEqual({ teacher: USER_ID });
  });

  test("faculty — dekan/kotib o'z fakulteti a'zolarini ko'radi", async () => {
    mockDepartments([DEPT_ID]);
    mockUsers([USER_ID, MATE_1]);
    const { scope } = await run(reqAs("faculty"));

    expect(Department.find).toHaveBeenCalledWith({ faculty: FAC_ID, active: true });
    expect(scope).toEqual({ teacher: { $in: [USER_ID, MATE_1] } });
  });

  test("global — filtrsiz `{}`", async () => {
    const { scope } = await run(reqAs("global"));
    expect(scope).toEqual({});
  });

  test("bypassRoles — global ko'radi", async () => {
    const req = reqAs("faculty");
    req.user.role.title = ROLES.SUPER_ADMIN;
    const { scope } = await run(req, { bypassRoles: [ROLES.SUPER_ADMIN] });
    expect(scope).toEqual({});
  });
});

describe("personalReportScope — xato holatlari", () => {
  test("req.user yo'q — 500", async () => {
    const { err } = await run({});
    expect(err.statusCode).toBe(500);
  });

  test("rol yo'q — 403", async () => {
    const { err } = await run({ user: { _id: USER_ID } });
    expect(err.statusCode).toBe(403);
  });

  test("faculty scope, lekin fakultet aniqlanmagan — 403", async () => {
    const req = {
      user: { _id: USER_ID, role: { scopeLevel: "faculty" }, department: { _id: DEPT_ID } },
    };
    const { err } = await run(req);
    expect(err.statusCode).toBe(403);
    expect(err.message).toMatch(/fakultet/i);
  });
});

describe("narrowTeacherFilter — `?teacher=` scope'ni buzmasin", () => {
  test("doira ICHIDAGI o'qituvchi — qo'llanadi", () => {
    const scope = { teacher: { $in: [USER_ID, MATE_1] } };
    expect(narrowTeacherFilter(scope, MATE_1)).toEqual({ teacher: MATE_1 });
  });

  test("doira TASHQARISIDAGI o'qituvchi — bo'sh natija (bypass YO'Q)", () => {
    const scope = { teacher: { $in: [USER_ID, MATE_1] } };
    expect(narrowTeacherFilter(scope, "ffffffffffffffffffffffff")).toEqual({
      teacher: { $in: [] },
    });
  });

  test("self scope — faqat o'zi so'ralsa qo'llanadi", () => {
    expect(narrowTeacherFilter({ teacher: USER_ID }, USER_ID)).toEqual({ teacher: USER_ID });
    expect(narrowTeacherFilter({ teacher: USER_ID }, MATE_1)).toEqual({
      teacher: { $in: [] },
    });
  });
});

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

describe("personalReportScope — ADR-030 fakultet langari", () => {
  test("(c) dekan: users.faculty ≠ department.faculty → Department.find users.faculty bilan", async () => {
    mockDepartments([DEPT_ID]);
    mockUsers([USER_ID, MATE_1]);
    const { scope, err } = await run(reqAs("faculty", { faculty: F_OWN, department: { _id: DEPT_ID, faculty: F_DEP } }));
    expect(err).toBeUndefined();
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(scope).toEqual({ teacher: { $in: [USER_ID, MATE_1] } });
  });

  test("(a) kafedrasiz dekan, faqat users.faculty → 403 emas", async () => {
    mockDepartments([DEPT_ID]);
    mockUsers([MATE_1]);
    const { scope, err } = await run(reqAs("faculty", { faculty: F_OWN, department: null }));
    expect(err).toBeUndefined();
    expect(Department.find).toHaveBeenCalledWith({ faculty: F_OWN, active: true });
    expect(scope).toEqual({ teacher: { $in: [MATE_1] } });
  });

  test("kafedrasiz va fakultetsiz dekan → 403 (fail-closed)", async () => {
    const { err } = await run(reqAs("faculty", { faculty: null, department: null }));
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(403);
  });
});

describe("personalReportScope — P-37: oqituvchi scopeLevel driftida ham FAQAT o'zi", () => {
  test.each(["department", "faculty", "global", "self", undefined])(
    "oqituvchi, scopeLevel=%s → { teacher: o'zi }, DB so'rovisiz",
    async (scopeLevel) => {
      mockDepartments([DEPT_ID]);
      mockUsers([USER_ID, MATE_1]);
      const req = reqAs(scopeLevel, { role: { title: ROLES.OQITUVCHI, scopeLevel } });
      const { scope, err } = await run(req);
      expect(err).toBeUndefined();
      expect(scope).toEqual({ teacher: USER_ID });
      expect(User.find).not.toHaveBeenCalled();
      expect(Department.find).not.toHaveBeenCalled();
    },
  );

  test("oqituvchi bypassRoles'da bo'lsa ham kengaymaydi (route konfiguratsiyasi ustun emas)", async () => {
    const req = reqAs("department", { role: { title: ROLES.OQITUVCHI, scopeLevel: "department" } });
    const { scope } = await run(req, { bypassRoles: [ROLES.OQITUVCHI] });
    expect(scope).toEqual({ teacher: USER_ID });
  });

  test("kafedra mudiri (department) avvalgidek kafedra a'zolarini ko'radi — regressiya yo'q", async () => {
    mockUsers([USER_ID, MATE_1]);
    const req = reqAs("department", { role: { title: ROLES.KAFEDRA_MUDIRI, scopeLevel: "department" } });
    const { scope } = await run(req);
    expect(scope).toEqual({ teacher: { $in: [USER_ID, MATE_1] } });
  });

  test("narrowTeacherFilter: oqituvchi ?teacher=<begona> → bo'sh natija (sizish yo'q)", () => {
    expect(narrowTeacherFilter({ teacher: USER_ID }, MATE_1)).toEqual({ teacher: { $in: [] } });
    expect(narrowTeacherFilter({ teacher: USER_ID }, USER_ID)).toEqual({ teacher: USER_ID });
  });
});
