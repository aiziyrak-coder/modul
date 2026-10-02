const {
  syncKeyWeeksFromStats,
  sumKeyWeeksFromCourses,
  sumAllValuesStatistics,
  sumCoursesTotal,
  findStatForKeyItem,
  isTotalKeyItem,
} = require("./compositionSync");

const keys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 0 },
  { key: "A", title: "Attestatsiyalar", week: 0 },
  { key: "M", title: "Malakaviy amaliyot", week: 0 },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi", week: 0 },
  { key: "T", title: "Ta'til", week: 0 },
  { key: " ", title: "JAMI", week: 0 },
];

const stats = (over = {}) => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: over.n ?? 30 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: over.a ?? 4 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: over.m ?? 2 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: over.d ?? 1 },
  { key: "T", slug: "tatil_xaftalar_soni", title: "Ta'til xaftalar soni", value: over.t ?? 6 },
  { key: null, slug: "hammasi", title: "Hammasi", value: over.all ?? 43 },
];

const weekOf = (list, title) => list.find((k) => k.title === title).week;

describe("compositionSync — syncKeyWeeksFromStats (bitta kurs)", () => {
  test("SARLAVHA MOS KELMASA HAM `key` bo'yicha yangilanadi (T va D — asosiy defekt)", () => {
    const out = syncKeyWeeksFromStats(keys(), stats());
    expect(weekOf(out, "Ta'til")).toBe(6);
    expect(weekOf(out, "Yakuniy Davlat attestatsiyasi")).toBe(1);
  });

  test("JAMI — kurs statistikasidagi `slug: hammasi` dan (allValues'dan EMAS)", () => {
    const out = syncKeyWeeksFromStats(keys(), stats({ all: 43 }), {
      fallbackTotal: 999,
    });
    expect(weekOf(out, "JAMI")).toBe(43);
  });

  test("JAMI: kursda 'hammasi' yo'q → zaxira (eski allValues yo'li)", () => {
    const noTotal = stats().filter((s) => s.slug !== "hammasi");
    const out = syncKeyWeeksFromStats(keys(), noTotal, { fallbackTotal: 41 });
    expect(weekOf(out, "JAMI")).toBe(41);
  });

  test("JAMI ning `key`i \" \" bo'lsa ham 'Nazariy va amaliy ta'lim' qiymatini OLMAYDI", () => {
    const out = syncKeyWeeksFromStats(keys(), stats({ n: 30, all: 43 }));
    expect(weekOf(out, "Nazariy va amaliy ta'lim")).toBe(30);
    expect(weekOf(out, "JAMI")).toBe(43);
  });

  test("mos kelmagan element O'ZGARMAYDI (0 bilan bosilmaydi)", () => {
    const withGpa = [...keys(), { key: "G", title: "GPA hisoblash", week: 7 }];
    const out = syncKeyWeeksFromStats(withGpa, stats());
    expect(weekOf(out, "GPA hisoblash")).toBe(7);
  });

  test("zaxira: `key` bo'sh bo'lsa sarlavha bo'yicha (registrga bog'liq emas)", () => {
    const item = { key: null, title: "  attestatsiyalar  " };
    expect(findStatForKeyItem(item, stats()).value).toBe(4);
  });

  test("joyida o'zgartirmaydi — kirish massivi tegilmaydi", () => {
    const input = keys();
    syncKeyWeeksFromStats(input, stats());
    expect(input.every((k) => k.week === 0)).toBe(true);
  });

  test("bo'sh/yaroqsiz kirish — yiqilmaydi", () => {
    expect(syncKeyWeeksFromStats(null, null)).toEqual([]);
    expect(syncKeyWeeksFromStats(keys(), undefined)).toHaveLength(6);
  });
});

describe("compositionSync — sumKeyWeeksFromCourses (barcha kurslar)", () => {
  const courses = [
    { total: 40, statistics: stats({ n: 30, t: 6, all: 40 }) },
    { total: 42, statistics: stats({ n: 32, t: 6, all: 42 }) },
  ];

  test("har kalit BARCHA kurslar bo'yicha yig'iladi", () => {
    const out = sumKeyWeeksFromCourses(keys(), courses);
    expect(weekOf(out, "Nazariy va amaliy ta'lim")).toBe(62);
    expect(weekOf(out, "Ta'til")).toBe(12);
  });

  test("JAMI = Σ 'hammasi' (40+42=82) — import hisobi bilan bir xil", () => {
    const out = sumKeyWeeksFromCourses(keys(), courses);
    expect(weekOf(out, "JAMI")).toBe(82);
  });

  test("hech bir kursda topilmasa — element O'ZGARMAYDI", () => {
    const withGpa = [...keys(), { key: "G", title: "GPA hisoblash", week: 3 }];
    const out = sumKeyWeeksFromCourses(withGpa, courses);
    expect(weekOf(out, "GPA hisoblash")).toBe(3);
  });
});

describe("compositionSync — allValues", () => {
  const courses = [
    { total: 40, statistics: stats({ t: 6, all: 40 }) },
    { total: 42, statistics: stats({ t: 7, all: 42 }) },
  ];

  test("statistics[].value = Σ slug bo'yicha", () => {
    const allStats = [
      { key: "T", slug: "tatil_xaftalar_soni", title: "Ta'til xaftalar soni", value: 0 },
      { key: null, slug: "hammasi", title: "Hammasi", value: 0 },
    ];
    const out = sumAllValuesStatistics(allStats, courses);
    expect(out[0].value).toBe(13);
    expect(out[1].value).toBe(82);
  });

  test("slug mos kelmasa — `key` zaxirasi ishlaydi", () => {
    const allStats = [{ key: "T", slug: "boshqa_slug", title: "Ta'til", value: 0 }];
    const out = sumAllValuesStatistics(allStats, courses);
    expect(out[0].value).toBe(13);
  });

  test("total = Σ courses[].total", () => {
    expect(sumCoursesTotal(courses)).toBe(82);
    expect(sumCoursesTotal(null)).toBe(0);
  });
});

describe("compositionSync — isTotalKeyItem", () => {
  test("registr/bo'shliqqa bog'liq emas", () => {
    expect(isTotalKeyItem({ title: "JAMI" })).toBe(true);
    expect(isTotalKeyItem({ title: " jami " })).toBe(true);
    expect(isTotalKeyItem({ title: "Jami semestrda" })).toBe(false);
  });
});
