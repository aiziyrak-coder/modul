const { resolveFacultyId } = require("./studyLoadStatistics.service");

const FACULTY_A = "6600000000000000000000f1";
const FACULTY_B = "6600000000000000000000f2";

describe("studyLoadStatistics.service — resolveFacultyId (scope qopqoni)", () => {
  test("scope.user bor (scopeLevel:self) → 403", () => {
    expect(() => resolveFacultyId({ user: "u1" }, {})).toThrow();
    try {
      resolveFacultyId({ user: "u1" }, {});
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  test("global scope ({}) + faculty query yo'q → null (cheklovsiz)", () => {
    expect(resolveFacultyId({}, {})).toBeNull();
  });

  test("global scope ({}) + ?faculty= berilgan → o'sha fakultet ObjectId'i", () => {
    const result = resolveFacultyId({}, { faculty: FACULTY_A });
    expect(String(result)).toBe(FACULTY_A);
  });

  test("scope.faculty bor (dekan) + ?faculty= BOSHQA fakultet → 403 (IDOR)", () => {
    expect(() => resolveFacultyId({ faculty: FACULTY_A }, { faculty: FACULTY_B })).toThrow();
    try {
      resolveFacultyId({ faculty: FACULTY_A }, { faculty: FACULTY_B });
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  test("scope.faculty bor (dekan) + ?faculty= MOS fakultet → o'sha fakultet qaytadi", () => {
    const result = resolveFacultyId({ faculty: FACULTY_A }, { faculty: FACULTY_A });
    expect(String(result)).toBe(FACULTY_A);
  });

  test("scope.faculty bor (dekan) + faculty query YO'Q → scope'dagi fakultet qaytadi (kengaymaydi)", () => {
    const result = resolveFacultyId({ faculty: FACULTY_A }, {});
    expect(String(result)).toBe(FACULTY_A);
  });

  test("scopeLevel:'department' (kafedra_mudiri) → 403, scope shakli dekanniki bilan BIR XIL bo'lsa ham", () => {
    expect(() => resolveFacultyId({ faculty: FACULTY_A }, {}, "department")).toThrow();
    try {
      resolveFacultyId({ faculty: FACULTY_A }, {}, "department");
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  test("scopeLevel:'department' + ?faculty= berilgan bo'lsa ham → 403 (query'dan oldin tekshiriladi)", () => {
    try {
      resolveFacultyId({ faculty: FACULTY_A }, { faculty: FACULTY_A }, "department");
      throw new Error("kutilmagan: 403 chiqishi kerak edi");
    } catch (err) {
      expect(err.statusCode).toBe(403);
    }
  });

  test("scopeLevel:'faculty' (dekan) — 403 CHIQMAYDI, avvalgi xulq saqlanadi", () => {
    const result = resolveFacultyId({ faculty: FACULTY_A }, {}, "faculty");
    expect(String(result)).toBe(FACULTY_A);
  });

  test("scopeLevel:'global' (O'UB/prorektor/rektor) — 403 CHIQMAYDI", () => {
    const result = resolveFacultyId({}, { faculty: FACULTY_A }, "global");
    expect(String(result)).toBe(FACULTY_A);
  });

  test("scopeLevel berilmagan (eski chaqiruvchi) — orqaga-moslik, oldingi 6 test buzilmaydi", () => {
    const result = resolveFacultyId({ faculty: FACULTY_A }, {});
    expect(String(result)).toBe(FACULTY_A);
  });
});
