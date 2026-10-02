"use strict";

const ExcelJS = require("exceljs");

const FACULTIES = [
  { _id: "f1", title: "Farmatsiya fakulteti" },
  { _id: "f2", title: "Davolash fakulteti" },
];
const DIRECTIONS = [
  { _id: "d1", title: "Farmatsiya (farmatsevtika ishi)", faculty: "f1" },
  { _id: "d2", title: "Davolash ishi", faculty: "f2" },
  { _id: "d3", title: "Umumiy", faculty: "f1" },
  { _id: "d4", title: "Umumiy", faculty: "f1" },
];
const GROUPS = [{ _id: "g1", title: "Farm-101", direction: "d1", course: "c1" }];
const COURSES = [
  { _id: "c1", title: "1-kurs" },
  { _id: "c2", title: "2-kurs" },
];

const refModel = (rows) => ({
  find: () => ({ select: () => ({ lean: async () => rows }) }),
});

jest.mock("#references/faculty/faculty.model", () => refModel(FACULTIES), { virtual: false });
jest.mock("#references/direction/direction.model", () => refModel(DIRECTIONS));
jest.mock("#references/group/group.model", () => refModel(GROUPS));
jest.mock("#references/course/course.model", () => refModel(COURSES));

const mockResolveByTitle = jest.fn();
jest.mock("./academicYearRefPlugin", () => ({ resolveByTitle: mockResolveByTitle }));

const mockOnboardStudent = jest.fn();
jest.mock("./studentOnboarding", () => ({ onboardStudent: mockOnboardStudent }));

const {
  importRoster,
  resolveUnique,
  validateRow,
  cellText,
} = require("./rosterImport");

const HEADERS = [
  "Familiya",
  "Ism",
  "Otasining ismi",
  "JSHSHIR",
  "Fakultet",
  "Yo'nalish",
  "Kurs",
  "Guruh",
  "O'quv yili",
  "Email",
];

async function book(rows, headers = HEADERS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Talabalar");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const OK_ROW = [
  "Aliyev",
  "Sardor",
  "Botir o'g'li",
  "12345678901234",
  "Farmatsiya fakulteti",
  "Farmatsiya (farmatsevtika ishi)",
  1,
  "Farm-101",
  "2025/2026",
  "s@fjsti.uz",
];

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveByTitle.mockResolvedValue("ay1");
  mockOnboardStudent.mockResolvedValue({
    ok: true,
    errors: [],
    warnings: [],
    fullName: "Aliyev Sardor Botir o'g'li",
    account: { status: "created", userId: "u1" },
    student: { status: "created", id: "s1" },
  });
});

describe("cellText — ExcelJS katagining har xil shakllari", () => {
  it.each([
    [{ value: "matn" }, "matn"],
    [{ value: 42 }, "42"],
    [{ value: null }, ""],
    [{ value: undefined }, ""],
    [{ value: { richText: [{ text: "Ali" }, { text: "yev" }] } }, "Aliyev"],
    [{ value: { result: 7 } }, "7"],
    [{ value: { text: "havola" } }, "havola"],
  ])("%p -> %p", (cell, want) => {
    expect(cellText(cell)).toBe(want);
  });

  it("obyekt jimgina \"[object Object]\" bo'lib qolmaydi", () => {
    expect(cellText({ value: { qandaydir: 1 } })).toBe("");
  });
});

describe("resolveUnique", () => {
  it("registr va apostrofga befarq", () => {
    expect(resolveUnique(FACULTIES, "  farmatsiya FAKULTETI ").row._id).toBe("f1");
  });

  it("bir nechta moslik -> ambiguous (taxmin QILINMAYDI)", () => {
    expect(resolveUnique(DIRECTIONS, "Umumiy", "faculty", "f1")).toEqual({ ambiguous: 2 });
  });

  it("ota-ona mos kelmasa -> topilmadi", () => {
    expect(resolveUnique(DIRECTIONS, "Davolash ishi", "faculty", "f1").missing).toBe(true);
  });
});

describe("validateRow", () => {
  it("to'liq satr — xato yo'q", () => {
    expect(validateRow({ lastName: "A", firstName: "B", jshshir: "12345678901234" })).toEqual([]);
  });

  it("JSHSHIR son katagida qisqargan bo'lsa — MAXSUS xabar", () => {
    const e = validateRow({ lastName: "A", firstName: "B", jshshir: "1234567890123" }, true);
    expect(e[0]).toMatch(/MATN formatiga/);
  });

  it("JSHSHIR matn bo'lsa — oddiy xabar", () => {
    const e = validateRow({ lastName: "A", firstName: "B", jshshir: "abc" }, false);
    expect(e[0]).toMatch(/aniq 14 raqam/);
    expect(e[0]).not.toMatch(/MATN formatiga/);
  });

  it("pasportning faqat yarmi — xato", () => {
    const e = validateRow({
      lastName: "A", firstName: "B", jshshir: "12345678901234", passportSeria: "AA",
    });
    expect(e[0]).toMatch(/ikkalasi birga/);
  });
});

describe("to'g'ri fayl", () => {
  it("satr ishlanadi va hisobot to'ldiriladi", async () => {
    const report = await importRoster(await book([OK_ROW]));

    expect(report.total).toBe(1);
    expect(report.student).toEqual({ created: 1, existing: 0, linked: 0, failed: 0 });
    expect(report.account).toEqual({ created: 1, existing: 0, skipped: 0 });
    expect(report.rows[0]).toMatchObject({ row: 2, student: "created", account: "created" });
  });

  it("ma'lumotnomaning KANONIK nomi yoziladi, operator imlosi emas", async () => {
    const row = [...OK_ROW];
    row[4] = "  farmatsiya fakulteti  ";
    await importRoster(await book([row]));

    expect(mockOnboardStudent.mock.calls[0][0]).toMatchObject({
      faculty: "Farmatsiya fakulteti",
      facultyId: "f1",
      directionId: "d1",
      groupId: "g1",
      course: 1,
    });
  });

  it("ism qismlari ALOHIDA uzatiladi (taxminiy bo'lish YO'Q)", async () => {
    await importRoster(await book([OK_ROW]));
    expect(mockOnboardStudent.mock.calls[0][0]).toMatchObject({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
    });
  });

  it("sarlavha 1-qatorda bo'lmasa ham topiladi", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("T");
    ws.addRow(["IQTIDORLI TALABALAR RO'YXATI"]);
    ws.addRow([]);
    ws.addRow(HEADERS);
    ws.addRow(OK_ROW);
    const report = await importRoster(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(report.total).toBe(1);
    expect(report.rows[0].row).toBe(4);
  });

  it("bo'sh qatorlar sanalmaydi", async () => {
    const report = await importRoster(await book([OK_ROW, [], [], OK_ROW.map(() => "")]));
    expect(report.total).toBe(1);
  });
});

describe("ish joyi", () => {
  it("shundayligicha uzatiladi", async () => {
    const headers = [...HEADERS, "Ish joyi"];
    const row = [...OK_ROW, "Shahar dorixonasi #3"];

    await importRoster(await book([row], headers));

    expect(mockOnboardStudent.mock.calls[0][0]).toMatchObject({
      workplace: "Shahar dorixonasi #3",
    });
  });

  it("ustun bo'lmasa `null` ketadi", async () => {
    await importRoster(await book([OK_ROW]));
    expect(mockOnboardStudent.mock.calls[0][0]).toMatchObject({ workplace: null });
  });

  it("muqobil sarlavha ham tanilaydi", async () => {
    await importRoster(await book([[...OK_ROW, "Klinika"]], [...HEADERS, "Ish joy"]));
    expect(mockOnboardStudent.mock.calls[0][0]).toMatchObject({ workplace: "Klinika" });
  });
});

describe("qisman muvaffaqiyat — buzuq satr faylni to'xtatmaydi", () => {
  it("xato satr `failed`, qolganlari ishlanadi", async () => {
    const bad = [...OK_ROW];
    bad[3] = "123";
    const good = [...OK_ROW];
    good[3] = "99999999999999";

    const report = await importRoster(await book([bad, good]));

    expect(report.total).toBe(2);
    expect(report.student.failed).toBe(1);
    expect(report.student.created).toBe(1);
    expect(report.rows[0]).toMatchObject({ row: 2, status: "failed" });
    expect(report.rows[0].errors[0]).toMatch(/14 raqam/);
    expect(mockOnboardStudent).toHaveBeenCalledTimes(1);
  });

  it("bitta satrning yiqilishi ham to'xtatmaydi", async () => {
    const second = [...OK_ROW];
    second[3] = "99999999999999";
    mockOnboardStudent
      .mockRejectedValueOnce(new Error("DB yiqildi"))
      .mockResolvedValueOnce({
        ok: true, errors: [], warnings: [], fullName: "X",
        account: { status: "existing", userId: "u2" },
        student: { status: "existing", id: "s2" },
      });

    const report = await importRoster(await book([OK_ROW, second]));
    expect(report.student.failed).toBe(1);
    expect(report.student.existing).toBe(1);
    expect(report.rows[0].errors[0]).toMatch(/DB yiqildi/);
  });
});

describe("ma'lumotnomada topilmagan qiymat — satr RAD ETILADI", () => {
  it.each([
    [4, "Yo'q fakultet", /Fakultet ma'lumotnomada topilmadi/],
    [5, "Yo'q yo'nalish", /Yo'nalish bu fakultetda topilmadi/],
    [6, 9, /Kurs ma'lumotnomada topilmadi/],
    [7, "Yo'q-guruh", /Guruh bu yo'nalishda topilmadi/],
  ])("ustun %i noto'g'ri -> failed", async (idx, value, re) => {
    const row = [...OK_ROW];
    row[idx] = value;

    const report = await importRoster(await book([row]));
    expect(report.student.failed).toBe(1);
    expect(report.rows[0].errors.join(" ")).toMatch(re);
    expect(mockOnboardStudent).not.toHaveBeenCalled();
  });

  it("noaniq yo'nalish (2 ta bir xil nom) -> failed", async () => {
    const row = [...OK_ROW];
    row[5] = "Umumiy";
    row[7] = "";
    const report = await importRoster(await book([row]));
    expect(report.rows[0].errors.join(" ")).toMatch(/noaniq/);
  });

  it("o'quv yili ma'lumotnomada yo'q -> failed", async () => {
    mockResolveByTitle.mockResolvedValue(null);
    const report = await importRoster(await book([OK_ROW]));
    expect(report.rows[0].errors.join(" ")).toMatch(/O'quv yili/);
  });

  it("ota-ona ko'rsatilmagan bo'lsa bola ham bog'lanmaydi", async () => {
    const row = [...OK_ROW];
    row[4] = "";
    const report = await importRoster(await book([row]));
    expect(report.rows[0].errors.join(" ")).toMatch(/avval to'g'ri fakultet/);
  });
});

describe("fayl ICHIDAGI dublikat", () => {
  it("ikkinchi bir xil JSHSHIR rad etiladi", async () => {
    const report = await importRoster(await book([OK_ROW, OK_ROW]));

    expect(report.student.created).toBe(1);
    expect(report.student.failed).toBe(1);
    expect(report.rows[1].errors[0]).toMatch(/faylda allaqachon bor \(2-satr\)/);
    expect(mockOnboardStudent).toHaveBeenCalledTimes(1);
  });
});

describe("ustunlar", () => {
  it("rad etiladigan ustun e'tiborsiz qoladi va SABABI qaytariladi", async () => {
    const headers = [...HEADERS, "Jami ball", "Maslahatchi"];
    const row = [...OK_ROW, 100, "Falonchi"];

    const report = await importRoster(await book([row], headers));

    expect(report.columns.ignored.map((c) => c.header)).toEqual(
      expect.arrayContaining(["Jami ball", "Maslahatchi"]),
    );
    expect(report.columns.ignored.find((c) => c.header === "Jami ball").reason)
      .toMatch(/TASDIQLANGAN yutuqlardan/);
    const payload = mockOnboardStudent.mock.calls[0][0];
    expect(payload).not.toHaveProperty("totalScore");
    expect(payload).not.toHaveProperty("advisorId");
  });

  it("noma'lum ustun ham ogohlantirish beradi", async () => {
    const report = await importRoster(await book([[...OK_ROW, "x"]], [...HEADERS, "Allaqanday"]));
    expect(report.columns.ignored.find((c) => c.header === "Allaqanday")).toBeTruthy();
  });
});

describe("faylni umuman qabul qilib bo'lmaydigan holatlar -> 400", () => {
  it("xlsx emas", async () => {
    await expect(importRoster(Buffer.from("bu xlsx emas"))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("sarlavha qatori yo'q", async () => {
    await expect(importRoster(await book([], ["aaa", "bbb"]))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("majburiy ustun yetishmaydi", async () => {
    const headers = HEADERS.filter((h) => h !== "JSHSHIR");
    await expect(importRoster(await book([], headers))).rejects.toThrow(/JSHSHIR/);
  });
});

describe("dryRun", () => {
  it("`onboardStudent` ga dryRun uzatiladi", async () => {
    await importRoster(await book([OK_ROW]), { dryRun: true });
    expect(mockOnboardStudent.mock.calls[0][1]).toEqual({ dryRun: true });
  });

  it("hisobotda belgilanadi", async () => {
    const report = await importRoster(await book([OK_ROW]), { dryRun: true });
    expect(report.dryRun).toBe(true);
  });

  it("default — yozadi (dryRun: false)", async () => {
    const report = await importRoster(await book([OK_ROW]));
    expect(report.dryRun).toBe(false);
    expect(mockOnboardStudent.mock.calls[0][1]).toEqual({ dryRun: false });
  });
});
