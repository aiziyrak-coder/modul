const {
  SCALAR_OWNER_ORDER,
  plannedSlugs,
  normalizeClassTypeSlugs,
  scalarOwnerSlug,
  classTypesIntersect,
  applyClassTypeFilter,
  classTypeLabel,
} = require("./classTypeSplit");

const source = () => [
  { slug: "maruza", title: "Ma'ruza", stream: 2, total: 0 },
  { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", stream: 0, total: 0 },
  { slug: "seminar", title: "Seminar", stream: 1, total: 0 },
  { slug: "laboratoriya", title: "Laboratoriya", stream: 0, total: 0 },
  { slug: "amaliy", title: "Amaliy mashg'ulot", stream: 3, total: 0 },
];

describe("classTypeSplit — normalizeClassTypeSlugs (SHART #3)", () => {
  test("yo'q / [] → [] (barcha turlar); manba tartibida qaytadi", () => {
    expect(normalizeClassTypeSlugs(source(), undefined)).toEqual({ slugs: [], error: null });
    expect(normalizeClassTypeSlugs(source(), [])).toEqual({ slugs: [], error: null });
    expect(normalizeClassTypeSlugs(source(), ["amaliy", "maruza"])).toEqual({
      slugs: ["maruza", "amaliy"],
      error: null,
    });
  });

  test("barcha SOATLI turlar tanlansa → [] («bo'linmagan» bilan bir xil)", () => {
    expect(normalizeClassTypeSlugs(source(), ["maruza", "seminar", "amaliy"])).toEqual({
      slugs: [],
      error: null,
    });
  });

  test("manba blokda yo'q yoki soatsiz (stream = 0) tur → xato matni", () => {
    expect(normalizeClassTypeSlugs(source(), ["laboratoriya"]).error).toBe(
      "Dars turi topilmadi / rejalashtirilmagan: laboratoriya",
    );
    expect(normalizeClassTypeSlugs(source(), ["boshqa"]).error).toMatch(/boshqa/);
    expect(normalizeClassTypeSlugs(source(), "maruza").error).toMatch(/massiv/);
  });

  test("plannedSlugs — faqat stream > 0 turlar, tartib saqlanadi", () => {
    expect(plannedSlugs(source())).toEqual(["maruza", "seminar", "amaliy"]);
    expect(plannedSlugs(undefined)).toEqual([]);
  });
});

describe("classTypeSplit — scalarOwnerSlug (SHART #5, egasi Q1 = a)", () => {
  test("qat'iy tartib amaliy → seminar → laboratoriya → klinik, MASSIV tartibi emas", () => {
    expect(SCALAR_OWNER_ORDER).toEqual(["amaliy", "seminar", "laboratoriya", "klinik_amaliyot"]);
    expect(scalarOwnerSlug(source())).toBe("amaliy");
    const noPractical = source().filter((c) => c.slug !== "amaliy");
    expect(scalarOwnerSlug(noPractical)).toBe("seminar");
  });

  test("guruh-asosli soatli tur yo'q → birinchi soatli tur (ma'ruza); umuman yo'q → null", () => {
    expect(scalarOwnerSlug([{ slug: "maruza", stream: 4 }])).toBe("maruza");
    expect(scalarOwnerSlug([{ slug: "maruza", stream: 0 }])).toBeNull();
  });
});

describe("classTypeSplit — classTypesIntersect (D27 uchlik, SHART #4)", () => {
  test("[] = hamma tur — hamma bilan kesishadi; ajratilgan to'plamlar kesishmaydi", () => {
    expect(classTypesIntersect([], ["maruza"])).toBe(true);
    expect(classTypesIntersect(["maruza"], [])).toBe(true);
    expect(classTypesIntersect([], [])).toBe(true);
    expect(classTypesIntersect(["maruza"], ["amaliy"])).toBe(false);
    expect(classTypesIntersect(["maruza", "seminar"], ["seminar"])).toBe(true);
    expect(classTypesIntersect(undefined, ["amaliy"])).toBe(true);
  });
});

const scoped = () => ({
  stream: 1,
  group: 2,
  classTypes: [
    { slug: "maruza", title: "Ma'ruza", stream: 2, total: 2 },
    { slug: "amaliy", title: "Amaliy mashg'ulot", stream: 3, total: 6 },
  ],
  items: [
    { slug: "on", title: "ON", value: 0 },
    { slug: "yan", title: "YAN", value: 8 },
    { slug: "malakaviy", title: "Malakaviy amaliyot", value: 4 },
  ],
  thisSemester: { auditoriumHour: 5, teachingAuditoriumHour: 8, totalHour: 15, independentHour: 10 },
});

describe("classTypeSplit — applyClassTypeFilter (SHART #1)", () => {
  test("[] — hech narsa o'zgarmaydi (bayt-bayt eski natija), yig'indilar to'liq", () => {
    const sw = scoped();
    const before = JSON.stringify(sw);
    const r = applyClassTypeFilter(sw, [], "amaliy");
    expect(JSON.stringify(sw)).toBe(before);
    expect(r).toEqual({ teachingHour: 8, itemsSum: 12, ownsScalars: true });
  });

  test("ma'ruza qismi (egasi EMAS): amaliy 0, item'lar 0, mustaqil ta'lim 0, hosila maydonlar qayta", () => {
    const sw = scoped();
    const r = applyClassTypeFilter(sw, ["maruza"], "amaliy");
    expect(r).toEqual({ teachingHour: 2, itemsSum: 0, ownsScalars: false });
    expect(sw.classTypes[1]).toMatchObject({ slug: "amaliy", stream: 0, total: 0 });
    expect(sw.items.map((it) => it.value)).toEqual([0, 0, 0]);
    expect(sw.thisSemester).toEqual({
      auditoriumHour: 2,
      teachingAuditoriumHour: 2,
      totalHour: 2,
      independentHour: 0,
    });
  });

  test("amaliy qismi (egasi): ma'ruza 0, item'lar QOLADI", () => {
    const sw = scoped();
    const r = applyClassTypeFilter(sw, ["amaliy"], "amaliy");
    expect(r).toEqual({ teachingHour: 6, itemsSum: 12, ownsScalars: true });
    expect(sw.classTypes[0]).toMatchObject({ slug: "maruza", stream: 0, total: 0 });
    expect(sw.items.map((it) => it.value)).toEqual([0, 8, 4]);
    expect(sw.thisSemester.auditoriumHour).toBe(3);
    expect(sw.thisSemester.teachingAuditoriumHour).toBe(6);
    expect(sw.thisSemester.totalHour).toBe(13);
  });

  test("invariant: ma'ruza-qismi + amaliy-qismi = to'liq (teaching 2+6 = 8, items 0+12 = 12)", () => {
    const a = applyClassTypeFilter(scoped(), ["maruza"], "amaliy");
    const b = applyClassTypeFilter(scoped(), ["amaliy"], "amaliy");
    const full = applyClassTypeFilter(scoped(), [], "amaliy");
    expect(a.teachingHour + b.teachingHour).toBe(full.teachingHour);
    expect(a.itemsSum + b.itemsSum).toBe(full.itemsSum);
  });
});

describe("classTypeSplit — splitOtherWork / nonAuditHourFor (B) va lectureNeedsStream (E)", () => {
  const { splitOtherWork, nonAuditHourFor, lectureNeedsStream } = require("./classTypeSplit");
  const block = () => ({
    otherWork: {
      items: [
        { slug: "yada_umumiy", value: 4 },
        { slug: "ochiq_integral", value: 3 },
        { slug: "qabul", value: 2 },
        { slug: "maslahatchilik", value: 1 },
        { slug: "eski", canonical: "open_department", value: 2 },
      ],
    },
    leadership: 5,
  });
  const planned = ["maruza", "seminar", "amaliy"];

  test("splitOtherWork — ma'ruza tabiatli (4+3+2 = 9) / egasi (2+1 + rahbarlik 5 = 8)", () => {
    expect(splitOtherWork(block())).toEqual({ lecture: 9, owner: 8, total: 17 });
    expect(splitOtherWork({})).toEqual({ lecture: 0, owner: 0, total: 0 });
  });

  test("bo'linmagan — ADR-005: birinchisiga to'liq (17); mavjud bo'linmagan/eski → 0; faqat bo'lingan qismlar mavjud → olinmaganini oladi", () => {
    const f = (existing) => nonAuditHourFor({ sourceBlock: block(), sameSourceBlocks: existing, classTypeSlugs: [], plannedSlugs: planned });
    expect(f([])).toBe(17);
    expect(f([{ classTypeSlugs: [] }])).toBe(0);
    expect(f([{}])).toBe(0);
    expect(f([{ classTypeSlugs: ["maruza"] }])).toBe(8);
    expect(f([{ classTypeSlugs: ["maruza"] }, { classTypeSlugs: ["amaliy"] }])).toBe(0);
  });

  test("bo'lingan — ma'ruza → 9, amaliy → 8; tartib ahamiyatsiz; ikkinchi ma'ruza 0; `[]` mavjud → 0", () => {
    const f = (slugs, existing) => nonAuditHourFor({ sourceBlock: block(), sameSourceBlocks: existing, classTypeSlugs: slugs, plannedSlugs: planned });
    expect(f(["maruza"], [])).toBe(9);
    expect(f(["amaliy"], [])).toBe(8);
    expect(f(["maruza"], [{ classTypeSlugs: ["amaliy"] }])).toBe(9);
    expect(f(["amaliy"], [{ classTypeSlugs: ["maruza"] }])).toBe(8);
    expect(f(["maruza", "amaliy"], [])).toBe(17);
    expect(f(["maruza"], [{ classTypeSlugs: ["maruza"] }])).toBe(0);
    expect(f(["amaliy"], [{ classTypeSlugs: [] }])).toBe(0);
    expect(f(["amaliy"], [{}])).toBe(0);
    expect(f(["seminar"], [])).toBe(0);
  });

  test("blokda ma'ruza rejalanmagan — ma'ruza tabiatli qism ham egasiga", () => {
    expect(nonAuditHourFor({ sourceBlock: block(), sameSourceBlocks: [], classTypeSlugs: ["amaliy"], plannedSlugs: ["seminar", "amaliy"] })).toBe(17);
  });

  test("lectureNeedsStream — faqat bo'lingan + ma'ruza + guruhli oqim yo'q", () => {
    expect(lectureNeedsStream(["maruza"], [])).toBe(true);
    expect(lectureNeedsStream(["maruza"], [{ number: 1, groups: [] }])).toBe(true);
    expect(lectureNeedsStream(["maruza"], [{ number: 1, groups: ["g1"] }])).toBe(false);
    expect(lectureNeedsStream(["amaliy"], [])).toBe(false);
    expect(lectureNeedsStream([], [])).toBe(false);
  });
});

describe("classTypeSplit — classTypeLabel (PDF/ekran yorlig'i, SHART #7)", () => {
  test("bo'linmagan blok → ''; bo'lingan → blokning o'z title'lari, vergul bilan", () => {
    expect(classTypeLabel({ classTypeSlugs: [], studyWork: scoped() })).toBe("");
    expect(classTypeLabel({ studyWork: scoped() })).toBe("");
    expect(classTypeLabel({ classTypeSlugs: ["maruza"], studyWork: scoped() })).toBe("Ma'ruza");
    expect(classTypeLabel({ classTypeSlugs: ["maruza", "amaliy"], studyWork: scoped() })).toBe(
      "Ma'ruza, Amaliy mashg'ulot",
    );
    expect(classTypeLabel({ classTypeSlugs: ["x"], studyWork: { classTypes: [] } })).toBe("x");
  });
});
