const { blockHours, blockCounts } = require("./personalWorkPlan.teachingLoad");

const TEN = ["lecture", "seminar", "laboratory", "practical", "on", "yan", "retake", "practiceLead", "otherWork", "adjustment"];
const sumTen = (h) => Math.round(TEN.reduce((a, k) => a + h[k], 0) * 100) / 100;

const block = ({ classTypes = [], items = [], totalHour = 0, nonAuditHour = 0, stream = 0, group = 0 } = {}) => ({
  totalHour,
  nonAuditHour,
  studyWork: { stream, group, classTypes, items },
});
const ct = (slug, total) => ({ slug, total, stream: 1 });
const it = (slug, value) => ({ slug, value });

describe("blockHours — test4 defekti (24 + 192 + 10 = 226)", () => {
  const b = block({
    totalHour: 226,
    stream: 1,
    group: 8,
    classTypes: [ct("maruza", 24), ct("amaliy", 192)],
    items: [it("on", 0), it("yan", 0), it("qoldirilgan", 10), it("malakaviy", 0)],
  });

  test("qayta topshirish o'z kalitida, tuzatish 0, Σ = jami", () => {
    const h = blockHours(b);
    expect(h).toMatchObject({ lecture: 24, seminar: 192, retake: 10, otherWork: 0, adjustment: 0 });
    expect(sumTen(h)).toBe(226);
  });

  test("eski `independent` formulasi o'zgarmagan (L-06): jami − auditoriya", () => {
    expect(blockHours(b).independent).toBe(10);
  });

  test("oqim/guruh soni studyWork'dan", () => {
    expect(blockCounts(b)).toEqual({ streamCount: 1, groupCount: 8 });
  });
});

describe("blockHours — chekka holatlar (Σ = jami har doim)", () => {
  test("ADR-034 bo'lingan blokning egasi bo'lmagan qismi: skalyar 0, faqat auditoriya", () => {
    const h = blockHours(block({ totalHour: 48, classTypes: [ct("amaliy", 48)], items: [it("on", 0), it("yan", 0)] }));
    expect(h).toMatchObject({ seminar: 48, on: 0, yan: 0, adjustment: 0 });
    expect(sumTen(h)).toBe(48);
  });

  test("soat qo'lda PASAYTIRILGAN blok — manfiy tuzatish (taxminiy bo'lish yo'q)", () => {
    const h = blockHours(block({ totalHour: 200, classTypes: [ct("maruza", 24), ct("amaliy", 192)] }));
    expect(h.adjustment).toBe(-16);
    expect(h.independent).toBe(0);
    expect(sumTen(h)).toBe(200);
  });

  test("scope'siz blok: boshqa ishlar `nonAuditHour` da — «otherWork» ga tushadi", () => {
    const h = blockHours(block({ totalHour: 130, nonAuditHour: 10, classTypes: [ct("maruza", 120)] }));
    expect(h).toMatchObject({ otherWork: 10, adjustment: 0 });
    expect(sumTen(h)).toBe(130);
  });

  test("kasrli ON/YAN (talaba × 0.2/0.3) — suzuvchi xato tuzatishga tushmaydi", () => {
    const h = blockHours(block({ totalHour: 30.3, classTypes: [ct("maruza", 20)], items: [it("on", 4.1), it("yan", 6.2)] }));
    expect(h.adjustment).toBe(0);
    expect(sumTen(h)).toBe(30.3);
  });

  test("bo'sh / buzuq blok — xato bermaydi, hammasi 0", () => {
    const h = blockHours(undefined);
    expect(sumTen(h)).toBe(0);
    expect(blockCounts(null)).toEqual({ streamCount: 0, groupCount: 0 });
  });
});
