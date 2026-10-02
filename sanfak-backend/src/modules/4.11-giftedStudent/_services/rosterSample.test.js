"use strict";

const ExcelJS = require("exceljs");

const FACULTIES = [
  { _id: "f1", title: "Farmatsiya fakulteti" },
  { _id: "f2", title: "Davolash fakulteti" },
];
const DIRECTIONS = [
  { _id: "d1", title: "Farmatsevtika ishi", faculty: "f1" },
  { _id: "d2", title: "Davolash ishi", faculty: "f2" },
];
const GROUPS = [
  { _id: "g1", title: "Farm-101", direction: "d1", course: "c1" },
  { _id: "g2", title: "Dav-101", direction: "d2", course: "c1" },
];
const COURSES = [
  { _id: "c2", title: "2-kurs" },
  { _id: "c1", title: "1-kurs" },
];
const ACADEMIC_YEARS = [
  { _id: "ay1", title: "2024/2025", active: false },
  { _id: "ay2", title: "2025/2026", active: true },
];

let mockFaculties = FACULTIES;
let mockDirections = DIRECTIONS;
let mockGroups = GROUPS;
let mockCourses = COURSES;
let mockAcademicYears = ACADEMIC_YEARS;

const mockRefModel = (get) => ({
  find: () => ({ select: () => ({ lean: async () => get() }) }),
});

jest.mock("#references/faculty/faculty.model", () => mockRefModel(() => mockFaculties));
jest.mock("#references/direction/direction.model", () => mockRefModel(() => mockDirections));
jest.mock("#references/group/group.model", () => mockRefModel(() => mockGroups));
jest.mock("#references/course/course.model", () => mockRefModel(() => mockCourses));
jest.mock("#references/academicYear/academicYear.model", () =>
  mockRefModel(() => mockAcademicYears),
);

const mockResolveByTitle = jest.fn();
jest.mock("./academicYearRefPlugin", () => ({ resolveByTitle: mockResolveByTitle }));

const mockOnboardStudent = jest.fn();
jest.mock("./studentOnboarding", () => ({ onboardStudent: mockOnboardStudent }));

const { buildSampleRows, pickUnique, pickCourseNumber } = require("./rosterSample");
const { buildTemplateWorkbook } = require("./rosterTemplate");
const { importRoster } = require("./rosterImport");
const { COLUMNS, SAMPLE_PINS, SAMPLE_ROW_COUNT } = require("./rosterColumns");

async function buildSampleBuffer(overrideRows) {
  const rows = overrideRows ?? (await buildSampleRows());
  const wb = buildTemplateWorkbook(rows);
  return { buffer: await wb.xlsx.writeBuffer(), rows };
}

beforeEach(() => {
  mockFaculties = FACULTIES;
  mockDirections = DIRECTIONS;
  mockGroups = GROUPS;
  mockCourses = COURSES;
  mockAcademicYears = ACADEMIC_YEARS;

  mockResolveByTitle.mockReset();
  mockResolveByTitle.mockImplementation(async (title) =>
    mockAcademicYears.find((y) => y.title === title) ? "ay" : null,
  );

  mockOnboardStudent.mockReset();
  mockOnboardStudent.mockResolvedValue({
    ok: true,
    fullName: "X",
    warnings: [],
    student: { status: "created", id: "s1" },
    account: { status: "created" },
  });
});

describe("namunaviy satrlar", () => {
  test("ma'lumotnoma ustunlari IERARXIYAGA rioya qilib to'ldiriladi", async () => {
    const rows = await buildSampleRows();

    expect(rows).toHaveLength(SAMPLE_ROW_COUNT);
    expect(rows[0].faculty).toBe("Farmatsiya fakulteti");
    expect(rows[0].direction).toBe("Farmatsevtika ishi");
    expect(rows[0].group).toBe("Farm-101");
    expect(rows[0].course).toBe("1");
    expect(rows[0].academicYear).toBe("2025/2026");
  });

  test("zanjir uzilsa pastdagi ustunlar BO'SH qoladi", async () => {
    mockDirections = [
      { _id: "d1", title: "Bir xil", faculty: "f1" },
      { _id: "d2", title: "Bir xil", faculty: "f1" },
    ];
    mockFaculties = [{ _id: "f1", title: "Yagona fakultet" }];

    const rows = await buildSampleRows();
    expect(rows[0].faculty).toBe("Yagona fakultet");
    expect(rows[0].direction).toBe("");
    expect(rows[0].group).toBe("");
  });

  test("oxirgi satr — faqat majburiy ustunlardan iborat eng kam satr", async () => {
    const rows = await buildSampleRows();
    const last = rows[SAMPLE_ROW_COUNT - 1];

    for (const col of COLUMNS) {
      if (col.required) expect(last[col.key]).not.toBe("");
      else expect(last[col.key]).toBe("");
    }
  });

  test("har katak ODDIY SATR — formula yoki Date obyekti emas", async () => {
    const rows = await buildSampleRows();
    for (const row of rows) {
      for (const value of Object.values(row)) {
        expect(typeof value).toBe("string");
      }
    }
  });

  test("yangi ustun namunada AVTOMAT paydo bo'ladi (kalitlar COLUMNS dan)", async () => {
    const rows = await buildSampleRows();
    expect(Object.keys(rows[0]).sort()).toEqual(COLUMNS.map((c) => c.key).sort());
  });
});

describe("namunaviy fayl importerga berilganda", () => {
  test("o'qiladi va FAQAT 'namunaviy satr' sababi bilan rad etiladi", async () => {
    const { buffer } = await buildSampleBuffer();
    const report = await importRoster(buffer, { dryRun: true });

    expect(report.columns.ignored).toEqual([]);
    expect(report.total).toBe(SAMPLE_ROW_COUNT);

    expect(report.student.failed).toBe(SAMPLE_ROW_COUNT);
    for (const row of report.rows) {
      expect(row.errors).toHaveLength(1);
      expect(row.errors[0]).toMatch(/namunaviy satr/i);
    }
    expect(mockOnboardStudent).not.toHaveBeenCalled();
  });

  test("JSHSHIR haqiqiysiga almashtirilsa — satrlar TOZA o'tadi", async () => {
    const rows = await buildSampleRows();
    const real = ["31234567890123", "41234567890123", "51234567890123"];
    rows.forEach((row, i) => {
      row.jshshir = real[i];
    });

    const { buffer } = await buildSampleBuffer(rows);
    const report = await importRoster(buffer, { dryRun: true });

    const failed = report.rows.filter((r) => r.status === "failed");
    expect(failed.map((r) => r.errors)).toEqual([]);
    expect(report.student.failed).toBe(0);
    expect(report.student.created).toBe(SAMPLE_ROW_COUNT);
    expect(report.columns.ignored).toEqual([]);
  });

  test("ma'lumotnoma BO'SH bo'lsa ham namuna toza o'tadi", async () => {
    mockFaculties = [];
    mockDirections = [];
    mockGroups = [];
    mockCourses = [];
    mockAcademicYears = [];

    const rows = await buildSampleRows();
    rows.forEach((row, i) => {
      row.jshshir = `3123456789012${i}`;
    });

    const { buffer } = await buildSampleBuffer(rows);
    const report = await importRoster(buffer, { dryRun: true });

    expect(report.student.failed).toBe(0);
  });
});

describe("bo'sh shablon", () => {
  test("namunasiz — sarlavhadan keyin ma'lumot satri YO'Q", async () => {
    const wb = buildTemplateWorkbook();
    const buffer = await wb.xlsx.writeBuffer();

    const read = new ExcelJS.Workbook();
    await read.xlsx.load(buffer);
    expect(read.worksheets[0].rowCount).toBe(1);

    const report = await importRoster(buffer, { dryRun: true });
    expect(report.total).toBe(0);
  });

  test("namunali va bo'sh shablonning SARLAVHALARI bir xil", async () => {
    const headersOf = async (wb) => {
      const read = new ExcelJS.Workbook();
      await read.xlsx.load(await wb.xlsx.writeBuffer());
      return read.worksheets[0].getRow(1).values;
    };

    expect(await headersOf(buildTemplateWorkbook(await buildSampleRows()))).toEqual(
      await headersOf(buildTemplateWorkbook()),
    );
  });
});

describe("yordamchilar", () => {
  test("pickUnique ota bo'yicha cheklaydi va takroriy nomni tashlaydi", () => {
    const rows = [
      { title: "A", faculty: "f1" },
      { title: "A", faculty: "f2" },
      { title: "B", faculty: "f1" },
    ];
    expect(pickUnique(rows, "faculty", "f1")).toEqual({ title: "A", faculty: "f1" });
    expect(pickUnique([{ title: "A" }, { title: "A" }])).toBeNull();
  });

  test("pickCourseNumber raqami o'qiladigan eng kichik kursni beradi", () => {
    expect(pickCourseNumber([{ title: "3-kurs" }, { title: "1-kurs" }])).toBe("1");
    expect(pickCourseNumber([{ title: "kurs" }])).toBe("");
    expect(pickCourseNumber([])).toBe("");
  });

  test("SAMPLE_PINS soni namunaviy satrlar soniga teng", () => {
    expect(SAMPLE_PINS).toHaveLength(SAMPLE_ROW_COUNT);
    expect(new Set(SAMPLE_PINS).size).toBe(SAMPLE_ROW_COUNT);
    SAMPLE_PINS.forEach((pin) => expect(pin).toMatch(/^\d{14}$/));
  });
});
