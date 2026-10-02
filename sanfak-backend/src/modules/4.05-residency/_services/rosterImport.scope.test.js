"use strict";

const ExcelJS = require("exceljs");

const DEPARTMENTS = [
  { _id: "dep1", title: "Farmakologiya kafedrasi" },
  { _id: "dep2", title: "Jarrohlik kafedrasi" },
];
const GROUPS = [{ _id: "g1", title: "ORD-101" }];
const COURSES = [{ _id: "c1", title: "1-kurs" }];
const SPECIALTIES = [
  { _id: "sp1", title: "Terapiya", code: "5A510101", program: "ordinatura" },
];

const refModel = (rows) => ({
  find: () => ({ select: () => ({ lean: async () => rows }) }),
});

jest.mock("#references/department/department.model", () => refModel(DEPARTMENTS));
jest.mock("#references/group/group.model", () => refModel(GROUPS));
jest.mock("#references/course/course.model", () => refModel(COURSES));
jest.mock(
  "#modules/4.05-residency/residencySpecialty/residencySpecialty.model",
  () => refModel(SPECIALTIES),
);

const mockResolveByTitle = jest.fn();
jest.mock("./academicYearRefPlugin", () => ({ resolveByTitle: mockResolveByTitle }));

const mockOnboardResident = jest.fn();
jest.mock("./residentOnboarding", () => ({ onboardResident: mockOnboardResident }));

const { importRoster } = require("./rosterImport");

const HEADERS = [
  "Familiya",
  "Ism",
  "Ta'lim yo'nalishi",
  "JSHSHIR",
  "Mutaxassislik",
  "Kafedra",
  "Guruh",
  "Kurs",
  "O'quv yili",
];

const ROW_OWN = [
  "Aliyev",
  "Sardor",
  "ordinatura",
  "12345678901234",
  "Terapiya",
  "Farmakologiya kafedrasi",
  "ORD-101",
  1,
  "2025/2026",
];

const ROW_OTHER = [
  "Valiyev",
  "Jasur",
  "ordinatura",
  "43210987654321",
  "Terapiya",
  "Jarrohlik kafedrasi",
  "ORD-101",
  1,
  "2025/2026",
];

async function book(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kontingent");
  ws.addRow(HEADERS);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const onlyDep1 = (payload) => String(payload.department) === "dep1";

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveByTitle.mockResolvedValue("ay1");
  mockOnboardResident.mockResolvedValue({
    ok: true,
    errors: [],
    warnings: [],
    fullName: "Aliyev Sardor",
    account: { status: "created", userId: "u1" },
    resident: { status: "created", id: "r1" },
  });
});

describe("doiradan tashqaridagi satr", () => {
  it("🔴 rad etiladi, o'z kafedrasidagi satr esa o'tadi", async () => {
    const report = await importRoster(await book([ROW_OWN, ROW_OTHER]), {
      canCreate: onlyDep1,
    });

    expect(report.total).toBe(2);
    expect(report.resident.created).toBe(1);
    expect(report.resident.failed).toBe(1);

    const denied = report.rows.find((x) => x.status === "failed");
    expect(denied.errors[0]).toContain("doirangizdan tashqarida");
    expect(denied.fullName).toBe("Valiyev Jasur");
  });

  it("rad etilgan satr uchun `onboardResident` CHAQIRILMAYDI", async () => {
    await importRoster(await book([ROW_OTHER]), { canCreate: onlyDep1 });

    expect(mockOnboardResident).not.toHaveBeenCalled();
  });

  it("butun fayl rad etilmaydi — hisobot HAR DOIM qaytadi", async () => {
    const report = await importRoster(await book([ROW_OTHER, ROW_OTHER]), {
      canCreate: onlyDep1,
    });

    expect(report.total).toBe(2);
    expect(report.resident.failed).toBe(2);
    expect(report.resident.created).toBe(0);
  });
});

describe("cheklovsiz chaqiruv", () => {
  it("predikat berilmasa hamma satr o'tadi (mavjud xulq)", async () => {
    const report = await importRoster(await book([ROW_OWN, ROW_OTHER]));

    expect(report.resident.created).toBe(2);
    expect(report.resident.failed).toBe(0);
  });

  it("hamma narsaga ruxsat beruvchi predikat ham bir xil", async () => {
    const report = await importRoster(await book([ROW_OWN, ROW_OTHER]), {
      canCreate: () => true,
    });

    expect(report.resident.created).toBe(2);
  });
});

describe("kafedra ustuni bo'sh", () => {
  it("cheklangan rol uchun rad etiladi (kafedrasiz yozuv hech kimga ko'rinmasdi)", async () => {
    const noDept = [...ROW_OWN];
    noDept[5] = "";

    const report = await importRoster(await book([noDept]), { canCreate: onlyDep1 });

    expect(report.resident.failed).toBe(1);
    expect(report.rows[0].errors[0]).toContain("doirangizdan tashqarida");
  });
});
