const {
  isAggregateRow,
  hasAggregateRow,
} = require("./aggregateRow");

describe("isAggregateRow", () => {
  test.each([
    ["Jami"],
    ["HAMMASI"],
    ["jami"],
    ["  Hammasi  "],
    ["Jami:"],
    ["Итого"],
    ["Total"],
  ])("kodsiz «%s» — yig'indi qatori", (title) => {
    expect(isAggregateRow({ code: "", title })).toBe(true);
  });

  test("KODLI qator hech qachon yig'indi emas (kod = haqiqiy fan belgisi)", () => {
    expect(isAggregateRow({ code: "FS1104", title: "Jami" })).toBe(false);
  });

  test("kodsiz haqiqiy fan yig'indi deb hisoblanmaydi", () => {
    expect(isAggregateRow({ code: "", title: "Klinik modullar" })).toBe(false);
  });

  test("nomida «jami» bo'lgan fan — yig'indi EMAS (aynan moslik talab qilinadi)", () => {
    expect(isAggregateRow({ code: "", title: "Jamiyat va oila" })).toBe(false);
  });

  test("bo'sh/noto'g'ri qiymatlarda yiqilmaydi", () => {
    expect(isAggregateRow(null)).toBe(false);
    expect(isAggregateRow({})).toBe(false);
    expect(isAggregateRow({ code: null, title: null })).toBe(false);
  });
});

describe("hasAggregateRow", () => {
  test("blok ichida yig'indi qatori bo'lsa — true", () => {
    const blocks = [
      { sciences: [{ code: "FS1104", title: "Falsafa" }] },
      { sciences: [{ code: "", title: "HAMMASI" }] },
    ];
    expect(hasAggregateRow(blocks)).toBe(true);
  });

  test("faqat fanlar bo'lsa — false (PDF o'z «Jami» qatorini chizadi)", () => {
    const blocks = [{ sciences: [{ code: "FS1104", title: "Falsafa" }] }];
    expect(hasAggregateRow(blocks)).toBe(false);
  });

  test("bo'sh/yo'q ma'lumotda yiqilmaydi", () => {
    expect(hasAggregateRow(undefined)).toBe(false);
    expect(hasAggregateRow([])).toBe(false);
    expect(hasAggregateRow([{}])).toBe(false);
    expect(hasAggregateRow([{ sciences: null }])).toBe(false);
  });
});
