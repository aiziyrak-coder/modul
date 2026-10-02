"use strict";

const ExcelJS = require("exceljs");

const DEPARTMENTS = [
  { _id: "dep1", title: "Farmakologiya kafedrasi" },
  { _id: "dep2", title: "Jarrohlik kafedrasi" },
];
const GROUPS = [{ _id: "g1", title: "ORD-101" }];
const COURSES = [
  { _id: "c1", title: "1-kurs" },
  { _id: "c2", title: "2-kurs" },
];
const SPECIALTIES = [
  { _id: "sp1", title: "Terapiya", code: "5A510101", program: "ordinatura" },
  { _id: "sp2", title: "Terapiya", code: "70910401", program: "magistratura" },
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

const {
  importRoster,
  resolveUnique,
  resolveSpecialty,
  parseRow,
  parseDate,
  parseCoordinates,
  cellText,
} = require("./rosterImport");

const HEADERS = [
  "Familiya",
  "Ism",
  "Otasining ismi",
  "Ta'lim yo'nalishi",
  "JSHSHIR",
  "Mutaxassislik",
  "Kafedra",
  "Guruh",
  "Kurs",
  "O'quv yili",
  "Ta'lim turi",
];

const OK_ROW = [
  "Aliyev",
  "Sardor",
  "Botir o'g'li",
  "ordinatura",
  "12345678901234",
  "Terapiya",
  "Farmakologiya kafedrasi",
  "ORD-101",
  1,
  "2025/2026",
  "byudjet",
];

async function book(rows, headers = HEADERS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Kontingent");
  ws.addRow(headers);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveByTitle.mockResolvedValue("ay1");
  mockOnboardResident.mockResolvedValue({
    ok: true,
    errors: [],
    warnings: [],
    fullName: "Aliyev Sardor Botir o'g'li",
    account: { status: "created", userId: "u1" },
    resident: { status: "created", id: "r1" },
  });
});

describe("cellText", () => {
  it.each([
    [{ value: "matn" }, "matn"],
    [{ value: 42 }, "42"],
    [{ value: null }, ""],
    [{ value: { richText: [{ text: "Ali" }, { text: "yev" }] } }, "Aliyev"],
    [{ value: { result: 7 } }, "7"],
  ])("%p -> %p", (cell, want) => {
    expect(cellText(cell)).toBe(want);
  });
});

describe("parseDate", () => {
  it.each([
    ["2025-09-01", "2025-09-01"],
    ["01.09.2025", "2025-09-01"],
    ["1/9/2025", "2025-09-01"],
  ])("%s -> %s", (input, iso) => {
    expect(parseDate(input).date.toISOString().slice(0, 10)).toBe(iso);
  });

  it("bo'sh -> empty", () => {
    expect(parseDate("").empty).toBe(true);
  });

  it.each(["kecha", "2025/09/01", "32.01.2025", "01.13.2025"])("%p -> invalid", (v) => {
    expect(parseDate(v).invalid).toBe(true);
  });
});

describe("parseCoordinates", () => {
  it("Google Maps'dan nusxa (bitta katak)", () => {
    expect(parseCoordinates({ combined: "41.311081, 69.240562" }).location).toEqual({
      lat: 41.311081,
      lng: 69.240562,
    });
  });

  it.each(["41.311081 69.240562", "41.311081;69.240562", "  41.311081 ,  69.240562  "])(
    "ajratgichning har xil ko'rinishi: %p",
    (v) => {
      expect(parseCoordinates({ combined: v }).location).toEqual({
        lat: 41.311081,
        lng: 69.240562,
      });
    },
  );

  it("alohida ikki ustun", () => {
    expect(parseCoordinates({ lat: "41.31", lng: "69.24" }).location).toEqual({
      lat: 41.31,
      lng: 69.24,
    });
  });

  it("alohida ustunlarda o'nlik VERGUL qabul qilinadi (ajratgich yo'q)", () => {
    expect(parseCoordinates({ lat: "41,31", lng: "69,24" }).location).toEqual({
      lat: 41.31,
      lng: 69.24,
    });
  });

  it.each([{ lat: "41.31" }, { lng: "69.24" }])("yarim koordinata (%p) -> xato", (v) => {
    expect(parseCoordinates(v).errors[0]).toMatch(/ikkalasi birga/);
  });

  it("bitta katakda o'nlik vergul -> aniq xabar bilan rad", () => {
    const e = parseCoordinates({ combined: "41,311081, 69,240562" }).errors;
    expect(e[0]).toMatch(/VERGUL/);
  });

  it.each(["41.31", "41.31, 69.24, 5", "shimol", "a, b"])("tushunarsiz %p -> xato", (v) => {
    expect(parseCoordinates({ combined: v }).errors).toHaveLength(1);
  });

  it.each([
    ["200, 69", /Kenglik/],
    ["41, 200", /Uzunlik/],
    ["-91, 0", /Kenglik/],
  ])("diapazondan tashqari %p", (v, re) => {
    expect(parseCoordinates({ combined: v }).errors[0]).toMatch(re);
  });

  it("ikki shakl ZIDDIYATI -> rad etiladi", () => {
    const e = parseCoordinates({ combined: "41.31, 69.24", lat: "42", lng: "70" }).errors;
    expect(e[0]).toMatch(/BIR XIL emas/);
  });

  it("ikki shakl MOS kelsa — o'tadi", () => {
    expect(
      parseCoordinates({ combined: "41.31, 69.24", lat: "41.31", lng: "69.24" }).location,
    ).toEqual({ lat: 41.31, lng: 69.24 });
  });

  it("bo'sh -> koordinata ham, xato ham yo'q (IXTIYORIY)", () => {
    expect(parseCoordinates({})).toEqual({ errors: [] });
  });
});

describe("resolveUnique / resolveSpecialty", () => {
  it("registr va apostrofga befarq", () => {
    expect(resolveUnique(DEPARTMENTS, "  farmakologiya KAFEDRASI ").row._id).toBe("dep1");
  });

  it("mutaxassislik FAQAT o'z dasturi ichida", () => {
    expect(resolveSpecialty(SPECIALTIES, "Terapiya", "ordinatura").row._id).toBe("sp1");
    expect(resolveSpecialty(SPECIALTIES, "Terapiya", "magistratura").row._id).toBe("sp2");
  });

  it("kod bo'yicha ham topiladi", () => {
    expect(resolveSpecialty(SPECIALTIES, "5A510101", "ordinatura").row._id).toBe("sp1");
  });

  it("boshqa dasturning kodi — topilmaydi", () => {
    expect(resolveSpecialty(SPECIALTIES, "5A510101", "magistratura").missing).toBe(true);
  });
});

describe("parseRow — enum va turlar", () => {
  const base = { lastName: "A", firstName: "B", jshshir: "12345678901234" };

  it.each([
    ["magistratura", "magistratura"],
    ["Magistr", "magistratura"],
    ["ordinatura", "ordinatura"],
    ["Klinik ordinatura", "ordinatura"],
    ["rezidentura", "ordinatura"],
  ])("dastur %p -> %s", (input, want) => {
    expect(parseRow({ ...base, program: input }).value.program).toBe(want);
  });

  it("tushunarsiz dastur -> xato", () => {
    const e = parseRow({ ...base, program: "bakalavr" }).errors;
    expect(e[0]).toMatch(/Ta'lim yo'nalishi tushunarsiz/);
  });

  it.each([
    ["byudjet", "byudjet"],
    ["Budjet", "byudjet"],
    ["shartnoma", "shartnoma"],
    ["Kontrakt", "shartnoma"],
  ])("ta'lim turi %p -> %s", (input, want) => {
    expect(parseRow({ ...base, program: "ordinatura", fundingType: input }).value.fundingType)
      .toBe(want);
  });

  it.each([
    ["ha", true],
    ["Yo'q", false],
    ["1", true],
  ])("xorijiy %p -> %p", (input, want) => {
    expect(parseRow({ ...base, program: "ordinatura", foreign: input }).value.foreign).toBe(want);
  });

  it("tushunarsiz mantiqiy qiymat -> xato", () => {
    const e = parseRow({ ...base, program: "ordinatura", foreign: "balki" }).errors;
    expect(e[0]).toMatch(/"ha" yoki "yo'q"/);
  });

  it("JSHSHIR son katagida qisqargan bo'lsa — MAXSUS xabar", () => {
    const e = parseRow({ ...base, jshshir: "1234567890123", program: "ordinatura" }, true).errors;
    expect(e[0]).toMatch(/MATN formatiga/);
  });

  it("dastur bo'sh -> xato (u modelda majburiy va rolni belgilaydi)", () => {
    expect(parseRow(base).errors[0]).toMatch(/Ta'lim yo'nalishi bo'sh/);
  });

  it("pasportning faqat yarmi — xato", () => {
    const e = parseRow({ ...base, program: "ordinatura", passportSeria: "AA" }).errors;
    expect(e[0]).toMatch(/ikkalasi birga/);
  });
});

describe("to'g'ri fayl", () => {
  it("satr ishlanadi va hisobot to'ldiriladi", async () => {
    const report = await importRoster(await book([OK_ROW]));

    expect(report.total).toBe(1);
    expect(report.resident).toEqual({ created: 1, existing: 0, linked: 0, failed: 0 });
    expect(report.account).toEqual({ created: 1, existing: 0, skipped: 0 });
  });

  it("ma'lumotnomaning KANONIK nomi va id lari yoziladi", async () => {
    const row = [...OK_ROW];
    row[6] = "  farmakologiya kafedrasi  ";
    await importRoster(await book([row]));

    expect(mockOnboardResident.mock.calls[0][0]).toMatchObject({
      department: "dep1",
      departmentTitle: "Farmakologiya kafedrasi",
      group: "g1",
      groupTitle: "ORD-101",
      specialty: "sp1",
      specialtyTitle: "Terapiya",
      specialtyCode: "5A510101",
      courseNumber: 1,
      program: "ordinatura",
    });
  });

  it("dastur o'zgarsa mutaxassislik ham BOSHQA yozuvga bog'lanadi", async () => {
    const row = [...OK_ROW];
    row[3] = "magistratura";
    await importRoster(await book([row]));

    expect(mockOnboardResident.mock.calls[0][0]).toMatchObject({
      specialty: "sp2",
      specialtyCode: "70910401",
    });
  });

  it("ism qismlari ALOHIDA uzatiladi (taxminiy bo'lish YO'Q)", async () => {
    await importRoster(await book([OK_ROW]));
    expect(mockOnboardResident.mock.calls[0][0]).toMatchObject({
      lastName: "Aliyev",
      firstName: "Sardor",
      middleName: "Botir o'g'li",
    });
  });

  it("sarlavha 1-qatorda bo'lmasa ham topiladi", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("K");
    ws.addRow(["KONTINGENT RO'YXATI"]);
    ws.addRow([]);
    ws.addRow(HEADERS);
    ws.addRow(OK_ROW);
    const report = await importRoster(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(report.rows[0].row).toBe(4);
  });

  it("bo'sh qatorlar sanalmaydi", async () => {
    const report = await importRoster(await book([OK_ROW, [], OK_ROW.map(() => "")]));
    expect(report.total).toBe(1);
  });
});

describe("koordinata butun import orqali o'tadi", () => {
  it("payloadga `workplaceLocation` bo'lib tushadi", async () => {
    const headers = [...HEADERS, "Ish joyi koordinatasi"];
    await importRoster(await book([[...OK_ROW, "41.311081, 69.240562"]], headers));

    expect(mockOnboardResident.mock.calls[0][0].workplaceLocation).toEqual({
      lat: 41.311081,
      lng: 69.240562,
    });
  });

  it("ustun bo'lmasa payloadda ham YO'Q (ixtiyoriy)", async () => {
    await importRoster(await book([OK_ROW]));
    expect(mockOnboardResident.mock.calls[0][0]).not.toHaveProperty("workplaceLocation");
  });

  it("noto'g'ri koordinata SATRNI rad etadi", async () => {
    const headers = [...HEADERS, "Ish joyi koordinatasi"];
    const report = await importRoster(await book([[...OK_ROW, "41,31, 69,24"]], headers));

    expect(report.resident.failed).toBe(1);
    expect(report.rows[0].errors[0]).toMatch(/VERGUL/);
    expect(mockOnboardResident).not.toHaveBeenCalled();
  });
});

describe("qisman muvaffaqiyat", () => {
  it("xato satr `failed`, qolganlari ishlanadi", async () => {
    const bad = [...OK_ROW];
    bad[4] = "123";
    const good = [...OK_ROW];
    good[4] = "99999999999999";

    const report = await importRoster(await book([bad, good]));

    expect(report.resident.failed).toBe(1);
    expect(report.resident.created).toBe(1);
    expect(mockOnboardResident).toHaveBeenCalledTimes(1);
  });

  it("bitta satrning yiqilishi ham to'xtatmaydi", async () => {
    const second = [...OK_ROW];
    second[4] = "99999999999999";
    mockOnboardResident
      .mockRejectedValueOnce(new Error("DB yiqildi"))
      .mockResolvedValueOnce({
        ok: true, errors: [], warnings: [], fullName: "X",
        account: { status: "existing", userId: "u2" },
        resident: { status: "existing", id: "r2" },
      });

    const report = await importRoster(await book([OK_ROW, second]));
    expect(report.resident.failed).toBe(1);
    expect(report.resident.existing).toBe(1);
  });
});

describe("ma'lumotnomada topilmagan qiymat — satr RAD ETILADI", () => {
  it.each([
    [5, "Yo'q mutaxassislik", /Mutaxassislik .* topilmadi/],
    [6, "Yo'q kafedra", /Kafedra ma'lumotnomada topilmadi/],
    [7, "Yo'q-guruh", /Guruh ma'lumotnomada topilmadi/],
    [8, 9, /Kurs ma'lumotnomada topilmadi/],
  ])("ustun %i noto'g'ri -> failed", async (idx, value, re) => {
    const row = [...OK_ROW];
    row[idx] = value;

    const report = await importRoster(await book([row]));
    expect(report.resident.failed).toBe(1);
    expect(report.rows[0].errors.join(" ")).toMatch(re);
    expect(mockOnboardResident).not.toHaveBeenCalled();
  });

  it("o'quv yili ma'lumotnomada yo'q -> failed", async () => {
    mockResolveByTitle.mockResolvedValue(null);
    const report = await importRoster(await book([OK_ROW]));
    expect(report.rows[0].errors.join(" ")).toMatch(/O'quv yili/);
  });
});

describe("fayl ICHIDAGI dublikat", () => {
  it("ikkinchi bir xil JSHSHIR rad etiladi", async () => {
    const report = await importRoster(await book([OK_ROW, OK_ROW]));

    expect(report.resident.created).toBe(1);
    expect(report.resident.failed).toBe(1);
    expect(report.rows[1].errors[0]).toMatch(/faylda allaqachon bor \(2-satr\)/);
  });
});

describe("ustunlar", () => {
  it("rahbar/ustoz ustuni e'tiborsiz qoladi va SABABI qaytariladi", async () => {
    const headers = [...HEADERS, "Rahbar", "Sababsiz soat"];
    const row = [...OK_ROW, "Falonchi", 40];

    const report = await importRoster(await book([row], headers));

    expect(report.columns.ignored.find((c) => c.header === "Rahbar").reason)
      .toMatch(/qo'lda biriktiradi/);
    const payload = mockOnboardResident.mock.calls[0][0];
    expect(payload).not.toHaveProperty("supervisor");
    expect(payload).not.toHaveProperty("totalUnexcusedHours");
  });
});

describe("faylni umuman qabul qilib bo'lmaydigan holatlar -> 400", () => {
  it("xlsx emas", async () => {
    await expect(importRoster(Buffer.from("bu xlsx emas"))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("majburiy ustun yetishmaydi", async () => {
    const headers = HEADERS.filter((h) => h !== "JSHSHIR");
    await expect(importRoster(await book([], headers))).rejects.toThrow(/JSHSHIR/);
  });

  it("ta'lim yo'nalishi ustuni yo'q -> 400 (u majburiy)", async () => {
    const headers = HEADERS.filter((h) => h !== "Ta'lim yo'nalishi");
    await expect(importRoster(await book([], headers))).rejects.toThrow(/Ta'lim yo'nalishi/);
  });
});

describe("dryRun", () => {
  it("`onboardResident` ga uzatiladi va hisobotda belgilanadi", async () => {
    const report = await importRoster(await book([OK_ROW]), { dryRun: true });
    expect(mockOnboardResident.mock.calls[0][1]).toEqual({ dryRun: true });
    expect(report.dryRun).toBe(true);
  });

  it("default — yozadi", async () => {
    const report = await importRoster(await book([OK_ROW]));
    expect(report.dryRun).toBe(false);
    expect(mockOnboardResident.mock.calls[0][1]).toEqual({ dryRun: false });
  });
});

describe("satr holati — assimetriya bo'lmasin", () => {
  const BAD_ROW = ["", "", "ordinatura", "12345678901234", "", "", "", "", ""];

  it("muvaffaqiyatli satrda `status: \"ok\"`", async () => {
    const report = await importRoster(await book([OK_ROW]));

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].status).toBe("ok");
    expect(report.rows[0].resident).toBe("created");
    expect(report.rows[0].account).toBe("created");
  });

  it("yiqilgan satrda `status: \"failed\"` (o'zgarmadi)", async () => {
    const report = await importRoster(await book([BAD_ROW]));

    expect(report.rows[0].status).toBe("failed");
    expect(Array.isArray(report.rows[0].errors)).toBe(true);
  });

  it("aralash faylda HAR BIR satrda holat bor va faqat ikki qiymat", async () => {
    const report = await importRoster(await book([OK_ROW, BAD_ROW]));

    expect(report.rows).toHaveLength(2);
    for (const r of report.rows) {
      expect(typeof r.status).toBe("string");
    }
    expect(new Set(report.rows.map((r) => r.status))).toEqual(new Set(["ok", "failed"]));
  });

  it("`dryRun` da ham holat bir xil yoziladi", async () => {
    const report = await importRoster(await book([OK_ROW]), { dryRun: true });

    expect(report.rows[0].status).toBe("ok");
  });
});
