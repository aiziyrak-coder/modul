"use strict";

const ExcelJS = require("exceljs");

const DEPARTMENTS = [
  { _id: "dep1", title: "Farmakologiya kafedrasi" },
  { _id: "dep2", title: "Jarrohlik kafedrasi" },
];
const GROUPS = [{ _id: "g1", title: "ORD-101" }];
const COURSES = [
  { _id: "c1", title: "2-kurs" },
  { _id: "c2", title: "1-kurs" },
];
const SPECIALTIES = [
  { _id: "sp1", title: "Terapiya", code: "5A510101", program: "ordinatura" },
  { _id: "sp2", title: "Jamoat salomatligi", code: "70910401", program: "magistratura" },
];
const ACADEMIC_YEARS = [
  { _id: "ay1", title: "2024/2025", active: false },
  { _id: "ay2", title: "2025/2026", active: true },
];

let mockDepartments = DEPARTMENTS;
let mockGroups = GROUPS;
let mockCourses = COURSES;
let mockSpecialties = SPECIALTIES;
let mockAcademicYears = ACADEMIC_YEARS;

const mockRefModel = (get) => ({
  find: () => ({ select: () => ({ lean: async () => get() }) }),
});

jest.mock("#references/department/department.model", () => mockRefModel(() => mockDepartments));
jest.mock("#references/group/group.model", () => mockRefModel(() => mockGroups));
jest.mock("#references/course/course.model", () => mockRefModel(() => mockCourses));
jest.mock("#references/academicYear/academicYear.model", () =>
  mockRefModel(() => mockAcademicYears),
);
jest.mock(
  "#modules/4.05-residency/residencySpecialty/residencySpecialty.model",
  () => mockRefModel(() => mockSpecialties),
);

const mockResolveByTitle = jest.fn();
jest.mock("./academicYearRefPlugin", () => ({ resolveByTitle: mockResolveByTitle }));

const mockOnboardResident = jest.fn();
jest.mock("./residentOnboarding", () => ({ onboardResident: mockOnboardResident }));

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
  mockDepartments = DEPARTMENTS;
  mockGroups = GROUPS;
  mockCourses = COURSES;
  mockSpecialties = SPECIALTIES;
  mockAcademicYears = ACADEMIC_YEARS;

  mockResolveByTitle.mockReset();
  mockResolveByTitle.mockImplementation(async (title) =>
    mockAcademicYears.find((y) => y.title === title) ? { id: "ay", title } : null,
  );

  mockOnboardResident.mockReset();
  mockOnboardResident.mockResolvedValue({
    ok: true,
    fullName: "X",
    warnings: [],
    resident: { status: "created", id: "r1" },
    account: { status: "created" },
  });
});

describe("namunaviy satrlar", () => {
  test("ma'lumotnoma ustunlari JONLI qatorlardan to'ldiriladi", async () => {
    const rows = await buildSampleRows();

    expect(rows).toHaveLength(SAMPLE_ROW_COUNT);
    expect(rows[0].department).toBe("Farmakologiya kafedrasi");
    expect(rows[0].group).toBe("ORD-101");
    expect(rows[0].courseNumber).toBe("1");
    expect(rows[0].academicYear).toBe("2025/2026");
    expect(rows[0].program).toBe("magistratura");
    expect(rows[0].specialty).toBe("Jamoat salomatligi");
    expect(rows[1].program).toBe("ordinatura");
    expect(rows[1].specialty).toBe("Terapiya");
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

    expect(report.resident.failed).toBe(SAMPLE_ROW_COUNT);
    for (const row of report.rows) {
      expect(row.errors).toHaveLength(1);
      expect(row.errors[0]).toMatch(/namunaviy satr/i);
    }
    expect(mockOnboardResident).not.toHaveBeenCalled();
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
    expect(report.resident.failed).toBe(0);
    expect(report.resident.created).toBe(SAMPLE_ROW_COUNT);
    expect(report.columns.ignored).toEqual([]);
  });

  test("ma'lumotnoma BO'SH bo'lsa ham namuna toza o'tadi", async () => {
    mockDepartments = [];
    mockGroups = [];
    mockCourses = [];
    mockSpecialties = [];
    mockAcademicYears = [];

    const rows = await buildSampleRows();
    rows.forEach((row, i) => {
      row.jshshir = `3123456789012${i}`;
    });

    const { buffer } = await buildSampleBuffer(rows);
    const report = await importRoster(buffer, { dryRun: true });

    expect(report.resident.failed).toBe(0);
  });

  test("noaniq (takroriy nomli) ma'lumotnoma qatori TANLANMAYDI", async () => {
    mockDepartments = [
      { _id: "d1", title: "Terapiya kafedrasi" },
      { _id: "d2", title: "Terapiya kafedrasi" },
      { _id: "d3", title: "Yagona kafedra" },
    ];

    const rows = await buildSampleRows();
    expect(rows[0].department).toBe("Yagona kafedra");
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
  test("pickUnique takrorlanmagan nomni qaytaradi, bo'lmasa null", () => {
    expect(pickUnique([{ title: "A" }, { title: "A" }])).toBeNull();
    expect(pickUnique([{ title: "A" }, { title: "A" }, { title: "B" }])).toEqual({
      title: "B",
    });
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
