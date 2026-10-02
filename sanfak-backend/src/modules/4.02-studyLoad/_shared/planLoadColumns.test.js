const {
  LOAD_COLUMNS,
  PLAN_CANONICAL,
  LOAD_ZONE,
  withStandardLoadItems,
  resolveLoadColumns,
} = require("./planLoadColumns");

const liveItems = () => [
  { slug: "soat", title: "soat", canonical: "hour", colNum: 4 },
  { slug: "foiz", title: "%", canonical: "percent", colNum: 5 },
  { slug: "jami", title: "Jami", canonical: "total", colNum: 6 },
  { slug: "maruza", title: "Ma’ruza", canonical: "lecture", colNum: 7 },
  { slug: "amaliy", title: "Amaliy", canonical: "practical", colNum: 8 },
  { slug: "laboratoriya", title: "Laboratoriya", canonical: "laboratory", colNum: 9 },
  { slug: "seminar", title: "Seminar", canonical: "seminar", colNum: 10 },
  { slug: "mustaqil_talim", title: "Mustaqil ta’lim", canonical: "independent", colNum: 12 },
];

describe("LOAD_COLUMNS — tartib va zonalar", () => {
  test("10 ustun; Klinik o'quv amaliyoti va Kurs ishi Seminardan KEYIN, Mustaqil ta'limdan OLDIN", () => {
    const slugs = LOAD_COLUMNS.map((c) => c.slug);
    expect(slugs).toEqual([
      "soat",
      "foiz",
      "jami",
      "maruza",
      "amaliy",
      "laboratoriya",
      "seminar",
      "klinik_oquv_amaliyoti",
      "kurs_ishi",
      "mustaqil_talim",
    ]);
  });

  test("yangi ikkitasi auditoriya zonasida va ixtiyoriy; kanonik nomlar parser bilan bir xil", () => {
    const klinik = LOAD_COLUMNS.find((c) => c.slug === "klinik_oquv_amaliyoti");
    const kurs = LOAD_COLUMNS.find((c) => c.slug === "kurs_ishi");
    expect(klinik).toMatchObject({
      zone: LOAD_ZONE.AUDITORIYA,
      optional: true,
      canonical: PLAN_CANONICAL.CLINICAL_PRACTICE,
    });
    expect(kurs).toMatchObject({
      zone: LOAD_ZONE.AUDITORIYA,
      optional: true,
      canonical: PLAN_CANONICAL.COURSE_WORK,
    });
    expect(PLAN_CANONICAL.COURSE_WORK).toBe("courseWork");
    expect(PLAN_CANONICAL.CLINICAL_PRACTICE).toBe("clinicalPractice");
  });
});

describe("withStandardLoadItems — o'qishda to'ldirish (additiv)", () => {
  test("jonli 8 ustunli hujjat → 10 ustun, yangilari Seminardan keyin `synthetic`", () => {
    const out = withStandardLoadItems(liveItems());
    expect(out.map((i) => i.slug)).toEqual(LOAD_COLUMNS.map((c) => c.slug));
    const klinik = out[7];
    const kurs = out[8];
    expect(klinik).toMatchObject({ slug: "klinik_oquv_amaliyoti", synthetic: true, colNum: null });
    expect(kurs).toMatchObject({ slug: "kurs_ishi", synthetic: true, colNum: null });
    expect(out[9]).toEqual(liveItems()[7]);
    expect(out[0]).toEqual(liveItems()[0]);
  });

  test("hujjatda ustun BOR bo'lsa — qo'shilmaydi (sarlavha bo'yicha ham taniladi)", () => {
    const items = liveItems();
    items.splice(7, 0, { slug: "kurs_ishi_x", title: "Kurs ishi", colNum: 11 });
    const out = withStandardLoadItems(items);
    const kurs = out.filter((i) => /kurs/i.test(i.title));
    expect(kurs).toHaveLength(1);
    expect(kurs[0]).toMatchObject({ slug: "kurs_ishi_x", colNum: 11 });
    expect(kurs[0].synthetic).toBeUndefined();
  });

  test("bo'sh/yo'q ro'yxat → 10 ta standart ustun; kirish o'zgartirilmaydi", () => {
    expect(withStandardLoadItems([]).map((i) => i.slug)).toEqual(LOAD_COLUMNS.map((c) => c.slug));
    expect(withStandardLoadItems(undefined)).toHaveLength(10);
    const src = liveItems();
    withStandardLoadItems(src);
    expect(src).toHaveLength(8);
  });

  test("noma'lum qo'shimcha ustun oxirida saqlanadi", () => {
    const out = withStandardLoadItems([...liveItems(), { slug: "boshqa", title: "Boshqa", colNum: 40 }]);
    expect(out).toHaveLength(11);
    expect(out[10].slug).toBe("boshqa");
  });
});

describe("resolveLoadColumns — PDF uchun", () => {
  test("hujjat sarlavhasi/colNum'i olinadi, yo'qlari standart + synthetic", () => {
    const cols = resolveLoadColumns(liveItems());
    expect(cols).toHaveLength(10);
    expect(cols[3]).toMatchObject({ slug: "maruza", title: "Ma’ruza", colNum: 7, synthetic: false });
    expect(cols[7]).toMatchObject({
      slug: "klinik_oquv_amaliyoti",
      title: "Klinik o'quv amaliyoti",
      colNum: null,
      synthetic: true,
      optional: true,
    });
    expect(cols[9]).toMatchObject({ slug: "mustaqil_talim", zone: LOAD_ZONE.MUSTAQIL });
  });
});
