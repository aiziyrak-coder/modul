const { resolveUserFacultyId } = require("./userScope");

const F_OWN = "6a7344010156990958a25c46";
const F_DEP = "6a73443f0156990958a267a0";

const user = (scopeLevel, { faculty, departmentFaculty } = {}) => ({
  _id: "u1",
  role: scopeLevel === undefined ? undefined : { scopeLevel },
  faculty,
  department: departmentFaculty === undefined ? null : { _id: "d1", faculty: departmentFaculty },
});

describe("resolveUserFacultyId — faculty-scoped rol (dekan, kotib)", () => {
  test("(a) faqat users.faculty → o'zi", () => {
    expect(resolveUserFacultyId(user("faculty", { faculty: F_OWN }))).toBe(F_OWN);
  });

  test("(b) faqat department.faculty → zaxira ishlaydi", () => {
    expect(resolveUserFacultyId(user("faculty", { departmentFaculty: F_DEP }))).toBe(F_DEP);
  });

  test("(c) ikkalasi farqli → users.faculty g'olib (Rasulova)", () => {
    expect(
      resolveUserFacultyId(user("faculty", { faculty: F_OWN, departmentFaculty: F_DEP })),
    ).toBe(F_OWN);
  });

  test("ikkalasi ham yo'q → null (chaqiruvchi 403 qaytaradi)", () => {
    expect(resolveUserFacultyId(user("faculty"))).toBeNull();
    expect(resolveUserFacultyId(user("faculty", { faculty: null, departmentFaculty: null }))).toBeNull();
  });
});

describe("resolveUserFacultyId — kafedra-langarli va boshqa rollar", () => {
  test.each(["department", "self", "global", undefined])(
    "scopeLevel=%s: (c) ikkalasi farqli → FAQAT department.faculty (users.faculty e'tiborsiz)",
    (scopeLevel) => {
      expect(
        resolveUserFacultyId(user(scopeLevel, { faculty: F_OWN, departmentFaculty: F_DEP })),
      ).toBe(F_DEP);
    },
  );

  test("department-scoped, (a) faqat users.faculty → null (kesh haqiqat emas)", () => {
    expect(resolveUserFacultyId(user("department", { faculty: F_OWN }))).toBeNull();
  });

  test("role yo'q → department-langar", () => {
    expect(resolveUserFacultyId({ _id: "u1", faculty: F_OWN, department: { faculty: F_DEP } })).toBe(F_DEP);
  });
});

describe("resolveUserFacultyId — normalizatsiya", () => {
  test("populated hujjat → ._id", () => {
    expect(
      resolveUserFacultyId(user("faculty", { faculty: { _id: F_OWN, title: "Davolash fakulteti" } })),
    ).toBe(F_OWN);
    expect(
      resolveUserFacultyId(user("department", { departmentFaculty: { _id: F_DEP, title: "Xalqaro" } })),
    ).toBe(F_DEP);
  });

  test("ObjectId-sifat obyekt (toString bor, _id yo'q) o'zgarmaydi", () => {
    const oid = { toString: () => F_OWN };
    expect(resolveUserFacultyId(user("faculty", { faculty: oid }))).toBe(oid);
  });

  test("user yo'q → null", () => {
    expect(resolveUserFacultyId(null)).toBeNull();
    expect(resolveUserFacultyId(undefined)).toBeNull();
  });
});
