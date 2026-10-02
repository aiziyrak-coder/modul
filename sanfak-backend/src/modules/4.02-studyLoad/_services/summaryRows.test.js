const {
  deriveSummaryRows,
  countKeylessRows,
  orderByLabels,
  SUMMARY_ROW_TITLE_MAX,
  SUMMARY_ROWS_MAX,
} = require("./summaryRows");

const SUMMARY_2023 = [
  { key: " ", title: "Nazariy va amaliy ta’lim", weeks: 180, semester: "1-12", note: null },
  { key: "M", title: "Amaliyot", weeks: 27, semester: "2-11", note: null },
  { key: "A", title: "Attestatsiyalar", weeks: 35, semester: "1-12", note: null },
  { key: "D", title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", weeks: 4, semester: "12" },
  { key: "T", title: "Ta’til haftalari", weeks: 56, semester: "1-12" },
  { key: "K", title: "Kredit ta’lim tizimiga kirish", weeks: 1, semester: "1" },
  { key: "G", title: "GPA ko’rsatkichini hisoblash", weeks: 5, semester: "2,4,6,8,10" },
];

describe("deriveSummaryRows (ADR-040)", () => {
  test("massiv emas / bo'sh — null", () => {
    expect(deriveSummaryRows(undefined)).toBeNull();
    expect(deriveSummaryRows(null)).toBeNull();
    expect(deriveSummaryRows({ key: "A", title: "x" })).toBeNull();
    expect(deriveSummaryRows([])).toBeNull();
  });

  test("2023 namuna — varaq tartibi (' ',M,A,D,T,K,G) va nomlar", () => {
    const rows = deriveSummaryRows(SUMMARY_2023);
    expect(rows.map((r) => r.key)).toEqual([" ", "M", "A", "D", "T", "K", "G"]);
    expect(rows[1]).toEqual({ key: "M", title: "Amaliyot" });
    expect(rows[3].title).toBe("Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi");
    expect(rows[4].title).toBe("Ta’til haftalari");
  });

  test("key=null tashlanadi (countKeylessRows sanaydi), JAMI tashlanadi", () => {
    const summary = [
      { key: null, title: "Noma'lum qator" },
      { key: "A", title: "Attestatsiyalar" },
      { key: " ", title: "JAMI" },
      { key: null, title: "Hammasi" },
    ];
    expect(deriveSummaryRows(summary)).toEqual([{ key: "A", title: "Attestatsiyalar" }]);
    expect(countKeylessRows(summary)).toBe(2);
    expect(countKeylessRows(undefined)).toBe(0);
  });

  test("takror harf — birinchisi g'olib; trim; ' ' harfi saqlanadi", () => {
    const rows = deriveSummaryRows([
      { key: "M", title: "  Amaliyot  " },
      { key: "M", title: "Ikkinchi amaliyot" },
      { key: " ", title: "Nazariy" },
    ]);
    expect(rows).toEqual([
      { key: "M", title: "Amaliyot" },
      { key: " ", title: "Nazariy" },
    ]);
  });

  test("nom ≤ 200, qatorlar ≤ 20; bo'sh nomli qator tashlanadi", () => {
    const long = deriveSummaryRows([{ key: "A", title: "a".repeat(300) }, { key: "B", title: "  " }]);
    expect(long).toHaveLength(1);
    expect(long[0].title).toHaveLength(SUMMARY_ROW_TITLE_MAX);
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `K${i}`, title: `Q${i}` }));
    expect(deriveSummaryRows(many)).toHaveLength(SUMMARY_ROWS_MAX);
  });
});

describe("orderByLabels (ADR-040)", () => {
  const legend = [
    { key: " ", title: "Nazariy va amaliy ta'lim" },
    { key: "A", title: "Attestatsiyalar" },
    { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
    { key: "M", title: "Malakaviy amaliyot" },
    { key: "Q", title: "Xulosa'da yo'q harf" },
  ];
  const keyOf = (k) => k.key;

  test("Xulosa tartibi + Xulosa nomi; Xulosa'da yo'q legend harfi oxirida, label null", () => {
    const out = orderByLabels(legend, deriveSummaryRows(SUMMARY_2023), keyOf);
    expect(out.map((o) => o.item.key)).toEqual([" ", "M", "A", "D", "Q"]);
    expect(out[1].label).toBe("Amaliyot");
    expect(out[4]).toEqual({ item: legend[4], label: null });
  });

  test("summaryRows yo'q/bo'sh — asl tartib, hamma label null", () => {
    for (const rows of [null, undefined, []]) {
      const out = orderByLabels(legend, rows, keyOf);
      expect(out.map((o) => o.item)).toEqual(legend);
      expect(out.every((o) => o.label === null)).toBe(true);
    }
  });

  test("items massiv emas — bo'sh massiv", () => {
    expect(orderByLabels(null, [{ key: "A", title: "x" }], keyOf)).toEqual([]);
  });
});
