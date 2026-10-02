"use strict";

const {
  buildAbsenceNoticePdf,
  uzDate,
  sumHours,
  absenceCardRows,
  LESSON_TYPE_LABEL,
  MISSED_LESSON_COLUMNS,
  missedLessonCells,
} = require("./absenceNotice.pdf");
const { RESIDENCY_LESSON_TYPES } = require("../attendance/attendance.model");

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const FULL = {
  resident: {
    fullName: "Aliyev Sardor Botir o'g'li",
    program: "ordinatura",
    specialtyTitle: "Kardiologiya",
    departmentTitle: "Ichki kasalliklar kafedrasi",
    courseNumber: 2,
    groupTitle: "ORD-201",
  },
  supervisor: {
    fullName: "Ergasheva Dilnoza Shavkatovna",
    position: "Klinik ustoz",
    department: "Ichki kasalliklar kafedrasi",
  },
  streak: {
    days: 3,
    from: "2026-09-02",
    to: "2026-09-06",
    windowDays: 7,
    windowFrom: "2026-09-02",
    windowTo: "2026-09-08",
  },
  rows: [
    { day: "2026-09-01", science: "Kardiologiya", lessonType: "amaliy", hours: 2 },
    { day: "2026-09-02", science: "Kardiologiya", lessonType: "amaliy", hours: 2 },
  ],
  totals: { unexcusedHours: 10, warningHours: 6, expulsionHours: 72 },
  content: "Rezident oxirgi 7 kunda 3 kun sababsiz mashg'ulotlarga kelmadi.",
  issuedAt: new Date("2026-09-09T06:00:00.000Z"),
};

describe("uzDate", () => {
  it.each([
    ["2026-09-01", "01.09.2026"],
    ["2026-12-31", "31.12.2026"],
  ])("%s -> %s", (key, want) => {
    expect(uzDate(key)).toBe(want);
  });

  it.each([null, undefined, "", "salom", "01.09.2026"])("%p -> chiziqcha", (bad) => {
    expect(uzDate(bad)).toBe("—");
  });
});

describe("buildAbsenceNoticePdf", () => {
  it("haqiqiy PDF qaytaradi", async () => {
    const buf = await buildAbsenceNoticePdf(FULL);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(10_000);
  });

  it("BITTA sahifa — footer bo'sh sahifa ochmaydi", async () => {
    expect(pageCount(await buildAbsenceNoticePdf(FULL))).toBe(1);
  });

  it("jadvalsiz (rows bo'sh) ham bitta sahifa", async () => {
    expect(pageCount(await buildAbsenceNoticePdf({ ...FULL, rows: [] }))).toBe(1);
  });

  it("izohsiz ham yiqilmaydi", async () => {
    const buf = await buildAbsenceNoticePdf({ ...FULL, content: "" });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("bo'sh argument bilan ham yiqilmaydi", async () => {
    const buf = await buildAbsenceNoticePdf();
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBe(1);
  });

  it("to'liqsiz talaba ma'lumotida ham quriladi", async () => {
    const buf = await buildAbsenceNoticePdf({
      ...FULL,
      resident: { fullName: "Faqat ism" },
      supervisor: {},
    });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("uzun izoh ko'p sahifaga o'tsa ham yiqilmaydi", async () => {
    const buf = await buildAbsenceNoticePdf({
      ...FULL,
      content: "Uzun matn. ".repeat(800),
    });
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBeGreaterThanOrEqual(1);
  });
});

describe("absenceCardRows — «Qoldirish holati» matni (ABS-Q12=A)", () => {
  const labels = (rows) => rows.map(([label]) => label);
  const value = (rows, label) => rows.find(([l]) => l === label)?.[1];

  it("yangi snapshot: oyna bilan kun, tekshirilgan davr, shu kunlardagi soat", () => {
    const rows = absenceCardRows(FULL.streak, FULL.rows, FULL.totals);
    expect(labels(rows)).toEqual([
      "Sababsiz qoldirilgan kun",
      "Tekshirilgan davr",
      "Shu kunlarda qoldirilgan",
      "Jami sababsiz soat (joriy o'quv yili)",
      "Ostona (TZ 4.5.4)",
    ]);
    expect(value(rows, "Sababsiz qoldirilgan kun")).toBe("3 kun (oxirgi 7 kunda)");
    expect(value(rows, "Tekshirilgan davr")).toBe("02.09.2026 — 08.09.2026");
    expect(value(rows, "Shu kunlarda qoldirilgan")).toBe("4 soat");
    expect(value(rows, "Jami sababsiz soat (joriy o'quv yili)")).toBe("10 soat");
  });

  it("🔴 yorliqlarda «ketma-ket» yo'q", () => {
    const text = JSON.stringify(absenceCardRows(FULL.streak, FULL.rows, FULL.totals));
    expect(text).not.toMatch(/ketma-ket/i);
  });

  it("eski (oynasiz) snapshot: qo'shimchasiz kun, davr — null («—»)", () => {
    const rows = absenceCardRows({ days: 5, from: "2026-09-01", to: "2026-09-08" }, [], {});
    expect(value(rows, "Sababsiz qoldirilgan kun")).toBe("5 kun");
    expect(value(rows, "Tekshirilgan davr")).toBeNull();
    expect(value(rows, "Shu kunlarda qoldirilgan")).toBeNull();
  });

  it("eski snapshot bilan PDF baribir quriladi", async () => {
    const buf = await buildAbsenceNoticePdf({
      ...FULL,
      streak: { days: 5, from: "2026-09-01", to: "2026-09-08" },
    });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("jadval ustunlari — hizalanish", () => {
  it("HAR bir ustunda `align` ANIQ berilgan", () => {
    const missing = MISSED_LESSON_COLUMNS.filter((c) => !c.align).map((c) => c.header);
    expect(missing).toEqual([]);
  });

  it.each([
    ["Sana", "left"],
    ["Fan", "left"],
    ["Dars turi", "left"],
    ["Soat", "right"],
  ])("%s → %s", (header, align) => {
    expect(MISSED_LESSON_COLUMNS.find((c) => c.header === header).align).toBe(align);
  });

  it("kengliklar musbat", () => {
    expect(MISSED_LESSON_COLUMNS.every((c) => c.width > 0)).toBe(true);
  });
});

describe("dars turi yorlig'i", () => {
  it("modeldagi HAR bir tur uchun nom bor", () => {
    const missing = RESIDENCY_LESSON_TYPES.filter((t) => !LESSON_TYPE_LABEL[t]);
    expect(missing).toEqual([]);
  });

  it.each([
    ["amaliy", "Amaliy"],
    ["maruza", "Ma'ruza"],
    ["oraliq_nazorat", "Oraliq nazorat"],
  ])("%s → %s", (key, want) => {
    expect(LESSON_TYPE_LABEL[key]).toBe(want);
  });
});

describe("sumHours — davr soati", () => {
  it("qatorlar yig'indisi", () => {
    expect(sumHours([{ hours: 2 }, { hours: 4 }, { hours: 2 }])).toBe(8);
  });

  it.each([[[]], [null], [undefined]])("%p → null (chizilmaydi)", (rows) => {
    expect(sumHours(rows)).toBeNull();
  });

  it("soatsiz qator 0 deb sanaladi, yig'indi buzilmaydi", () => {
    expect(sumHours([{ hours: 2 }, { hours: null }, {}])).toBe(2);
  });

  it("jadval yig'indisi `totals.unexcusedHours` ga bog'liq EMAS", () => {
    const rows = [{ hours: 2 }, { hours: 2 }];
    expect(sumHours(rows)).toBe(4);
    expect(FULL.totals.unexcusedHours).toBe(10);
  });
});

describe("missedLessonCells — jadval qatori", () => {
  it("sana o'zbekcha, dars turi nomi bilan, soat satr", () => {
    expect(missedLessonCells({ day: "2026-09-01", science: "Kardiologiya", lessonType: "amaliy", hours: 2 })).toEqual({
      day: "01.09.2026",
      science: "Kardiologiya",
      lessonType: "Amaliy",
      hours: "2",
    });
  });

  it("noma'lum dars turi yo'qotilmaydi", () => {
    expect(missedLessonCells({ day: "2026-09-01", lessonType: "seminar", hours: 0 }).lessonType).toBe("seminar");
    expect(missedLessonCells({ day: "2026-09-01", hours: 0 }).hours).toBe("0");
  });

  it("bo'sh qiymatlar — «—»", () => {
    expect(missedLessonCells({ day: null, science: null, lessonType: null, hours: null })).toEqual({
      day: "—",
      science: "—",
      lessonType: "—",
      hours: "—",
    });
  });
});
