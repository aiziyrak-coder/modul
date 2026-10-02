"use strict";

const { buildSummary } = require("#modules/4.02-studyLoad/_services/contingentSummary");
const {
  buildContingentWorkbook,
  contingentFileName,
  HEADER_TOP,
  LAST_COL,
} = require("./contingentReport.xlsx");

const row = (course, over = {}) => ({
  direction: "d1",
  directionCode: "60910200",
  directionTitle: "Davolash ishi",
  category: "milliy",
  course,
  total: 10 * course,
  boys: 4 * course,
  girls: 6 * course,
  grant: 3 * course,
  contract: 7 * course,
  grantBoys: course,
  grantGirls: 2 * course,
  contractBoys: 3 * course,
  contractGirls: 4 * course,
  groupCount: 1,
  streamCount: 1,
  mobilityOut: 0,
  mobilityIn: 0,
  ...over,
});

const doc = {
  facultyTitle: "Davolash ishi fakulteti",
  academicYearTitle: "2026/2027",
  rows: [row(1), row(2)],
  foreignByCountry: [{ country: "Hindiston", total: 3, boys: 2, girls: 1 }],
};

const cellText = (ws, r, c) => {
  const v = ws.getCell(r, c).value;
  return v && typeof v === "object" && "richText" in v ? v.richText.map((t) => t.text).join("") : v;
};

const wb = buildContingentWorkbook({
  variant: "faculty",
  doc,
  academicYearTitle: "2026/2027",
  asOfDate: new Date("2026-07-16"),
  summary: buildSummary({ reports: [doc] }),
  signatories: { dean: { name: "R.A.Rahmonov", date: "2026-yil “ 22 ” sentabr" } },
});

describe("buildContingentWorkbook — fakultet varianti, «Kontingent» varag'i", () => {
  test("3 varaq — Kontingent / Kurs jami / Xorijlik talabalar", () => {
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Kontingent", "Kurs jami", "Xorijlik talabalar"]);
  });

  test("sarlavha + sana + 2 qavatli jadval sarlavhasi (15 ustun, PDF bilan bir xil matn)", () => {
    const ws = wb.getWorksheet("Kontingent");
    expect(cellText(ws, 1, 1)).toContain("Davolash ishi fakulteti kunduzgi bakalavr");
    expect(cellText(ws, 2, LAST_COL - 1)).toBe("16.07.2026");
    expect(cellText(ws, 3, 1)).toBe("Ta'lim yunalishi");
    expect(cellText(ws, 3, 8)).toBe("Grant");
    expect(cellText(ws, 4, 8)).toBe("O'g'il");
    expect(cellText(ws, 4, 11)).toBe("Qiz");
    expect(cellText(ws, 3, 13)).toBe("Oqimlar soni");
    expect(HEADER_TOP.filter(Boolean)).toHaveLength(13);
  });

  test("qatorlar: yorliq + kurs + 13 raqam; JAMI va fakultet jami; institut JAMI yo'q", () => {
    const ws = wb.getWorksheet("Kontingent");
    expect(cellText(ws, 5, 1)).toBe("60910200-Davolash ishi (milliy)");
    expect(cellText(ws, 5, 2)).toBe(1);
    expect(cellText(ws, 5, 3)).toBe(10);
    expect(cellText(ws, 6, 2)).toBe(2);
    expect(cellText(ws, 7, 1)).toBe("JAMI:");
    expect(cellText(ws, 7, 3)).toBe(30);
    expect(cellText(ws, 8, 1)).toBe("Davolash ishi fakulteti bo'yicha jami");
    expect(cellText(ws, 9, 1)).toBeNull();
  });
});

describe("buildContingentWorkbook — fakultet varianti, 2–3-varaqlar", () => {
  test("Kurs jami varag'i: 1-kurs..6-kurs + JAMI, keyin fakultet×kurs", () => {
    const ws = wb.getWorksheet("Kurs jami");
    expect(cellText(ws, 3, 1)).toBe("1-kurs");
    expect(cellText(ws, 3, 3)).toBe(10);
    expect(cellText(ws, 8, 1)).toBe("6-kurs");
    expect(cellText(ws, 9, 1)).toBe("JAMI:");
    expect(cellText(ws, 9, 3)).toBe(30);
    expect(cellText(ws, 11, 1)).toBe("Fakultetlar nomi");
    expect(cellText(ws, 12, 1)).toBe("Davolash ishi");
    expect(cellText(ws, 12, 8)).toBe(30);
    expect(cellText(ws, 13, 1)).toBe("JAMI:");
  });

  test("Xorijlik talabalar: davlatlar + JAMI + dekan imzosi (ism, sana)", () => {
    const ws = wb.getWorksheet("Xorijlik talabalar");
    expect(cellText(ws, 1, 1)).toBe("Xorijlik talabalar kontingenti");
    expect(cellText(ws, 2, 1)).toBe("Davlatlar");
    expect(cellText(ws, 3, 1)).toBe("Hindiston");
    expect(cellText(ws, 4, 1)).toBe("JAMI:");
    expect(cellText(ws, 4, 2)).toBe(3);
    expect(cellText(ws, 7, 1)).toBe("Davolash ishi fakulteti dekani:");
    expect(cellText(ws, 7, 3)).toBe("R.A.Rahmonov");
    expect(cellText(ws, 8, 3)).toBe("2026-yil “ 22 ” sentabr");
  });
});

describe("buildContingentWorkbook — yig'ma varianti", () => {
  test("institut JAMI qatori bor, imzo — O'UB boshlig'i, ism bo'sh chiziq", () => {
    const wb = buildContingentWorkbook({
      variant: "institute",
      academicYearTitle: "2026/2027",
      asOfDate: new Date("2026-07-16"),
      summary: buildSummary({ reports: [doc], faculties: [{ _id: "f1", title: "Davolash ishi fakulteti" }] }),
    });
    const ws = wb.getWorksheet("Kontingent");
    expect(cellText(ws, 1, 1)).not.toContain("Davolash ishi fakulteti kunduzgi");
    expect(cellText(ws, 9, 1)).toBe("JAMI:");
    const ws3 = wb.getWorksheet("Xorijlik talabalar");
    expect(cellText(ws3, 7, 1)).toBe("O'quv-uslubiy boshqarma boshlig'i:");
    expect(cellText(ws3, 7, 3)).toBe("____________");
  });
});

describe("contingentFileName", () => {
  test("yil + fakultet (transliteratsiyasiz, apostrof tushadi)", () => {
    expect(contingentFileName({ academicYearTitle: "2026/2027", ext: "pdf" })).toBe("kontingent-hisoboti-2026-2027.pdf");
    expect(
      contingentFileName({ academicYearTitle: "2026/2027", facultyTitle: "Davolash ishi fakulteti", ext: "xlsx" }),
    ).toBe("kontingent-hisoboti-2026-2027-davolash-ishi-fakulteti.xlsx");
    expect(contingentFileName({ facultyTitle: "Farg'ona", ext: "xlsx" })).toBe("kontingent-hisoboti-fargona.xlsx");
  });
});
