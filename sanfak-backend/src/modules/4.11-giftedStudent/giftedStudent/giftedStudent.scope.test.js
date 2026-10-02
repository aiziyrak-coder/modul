jest.mock("#shared/error", () => ({
  ErrorHandler: class ErrorHandler extends Error {},
}));
jest.mock("exceljs", () => ({ Workbook: class {} }));

const mockExec = jest.fn().mockResolvedValue([]);
const mockSort = jest.fn(() => ({ exec: mockExec }));
const mockFind = jest.fn(() => ({ sort: mockSort, exec: mockExec, lean: jest.fn() }));
jest.mock("./giftedStudent.model", () => ({
  find: (...args) => mockFind(...args),
  paginate: jest.fn().mockResolvedValue({ docs: [] }),
}));

const Controller = require("./giftedStudent.controller");

const FACULTY_ID = "69df7a8f94bda50c83a1d435";
const res = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });

beforeEach(() => jest.clearAllMocks());

describe("findAllStudents — scope query bilan ustidan yozilmaydi", () => {
  test("query `faculty` scope'ni BEKOR QILA OLMAYDI", async () => {
    const req = {
      query: { faculty: "Boshqa fakultet" },
      scope: { facultyId: FACULTY_ID },
    };
    await Controller.findAllStudents(req, res(), jest.fn());

    const filter = mockFind.mock.calls[0][0];
    expect(filter.facultyId).toBe(FACULTY_ID);
    expect(filter.faculty).toBe("Boshqa fakultet");
    expect(filter.facultyId).not.toBe("Boshqa fakultet");
  });

  test("scope bo'sh bo'lsa (global rol) query filtri ishlaydi", async () => {
    const req = { query: { faculty: "Farmatsiya fakulteti" }, scope: {} };
    await Controller.findAllStudents(req, res(), jest.fn());

    expect(mockFind.mock.calls[0][0].faculty).toBe("Farmatsiya fakulteti");
  });

  test("boshqa query filtrlari saqlanadi (course/search/academicYear)", async () => {
    const req = {
      query: { course: 3, search: "Ali", academicYear: "2025-2026" },
      scope: { facultyId: FACULTY_ID },
    };
    await Controller.findAllStudents(req, res(), jest.fn());

    const f = mockFind.mock.calls[0][0];
    expect(f.course).toBe(3);
    expect(f.academicYear).toEqual({ $in: ["2025/2026", "2025-2026"] });
    expect(f.fullName).toEqual({ $regex: "Ali", $options: "i" });
    expect(f.facultyId).toBe(FACULTY_ID);
  });
});

describe("getRanking — scope'ga bo'ysunadi", () => {
  test("scope filtri reytingga ham qo'llanadi", async () => {
    const req = { query: {}, scope: { facultyId: FACULTY_ID } };
    await Controller.getRanking(req, res(), jest.fn());

    const filter = mockFind.mock.calls[0][0];
    expect(filter.active).toBe(true);
    expect(filter.facultyId).toBe(FACULTY_ID);
  });

  test("global rolda (scope bo'sh) faqat active filtri qoladi", async () => {
    await Controller.getRanking({ query: {}, scope: {} }, res(), jest.fn());
    expect(mockFind.mock.calls[0][0]).toEqual({ active: true });
  });
});

describe("findAllStudents — qidiruv qoidasi", () => {
  const filterFor = async (query) => {
    await Controller.findAllStudents({ query, scope: {} }, res(), jest.fn());
    return mockFind.mock.calls[0][0];
  };

  test("metakarakterlar escape qilinadi va naqsh kompilyatsiya bo'ladi", async () => {
    const f = await filterFor({ search: "Anatomiya (atlas)" });
    expect(f.fullName).toEqual({
      $regex: "Anatomiya \\(atlas\\)",
      $options: "i",
    });
    expect(() => new RegExp(f.fullName.$regex)).not.toThrow();
  });

  test("bosh/oxirgi bo'shliqlar kesiladi, ichkaridagilari siqiladi", async () => {
    const f = await filterFor({ search: "  Karimov   Aziz  " });
    expect(f.fullName.$regex).toBe("Karimov Aziz");
  });

  test("faqat bo'shliqli so'rov FILTR QO'YMAYDI — to'liq ro'yxat qaytadi", async () => {
    const f = await filterFor({ search: "   " });
    expect(f.fullName).toBeUndefined();
  });

  test("qism-satr, anchor yo'q; kirillda ham registrga sezgir emas", async () => {
    const f = await filterFor({ search: "тошкент" });
    const rx = new RegExp(f.fullName.$regex, f.fullName.$options);
    expect(rx.test("Шаҳар ТОШКЕНТ филиали")).toBe(true);
  });
});
