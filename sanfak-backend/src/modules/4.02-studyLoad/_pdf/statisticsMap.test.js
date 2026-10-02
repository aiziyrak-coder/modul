const { statisticsMap } = require("./statisticsMap");

const dbArray = [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 6 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit ta'lim tizimiga kirish", value: 1 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 4 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: 0 },
  { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til haftalari soni", value: 10 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA ko'rsatkichini hisoblash", value: 1 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 52 },
];

describe("statisticsMap — bazadagi MASSIV shakli", () => {
  test("sakkizala slug kanonik kalitlarga o'giriladi", () => {
    expect(statisticsMap(dbArray)).toEqual({
      theoreticalPractical: 30,
      certification: 6,
      creditSystem: 1,
      qualification: 4,
      final: 0,
      vacation: 10,
      gpa: 1,
      all: 52,
      total: 52,
    });
  });

  test("'hammasi' ham `all`, ham `total` bo'lib tushadi (kod ikkala nomni o'qiydi)", () => {
    const m = statisticsMap(dbArray);
    expect(m.all).toBe(52);
    expect(m.total).toBe(52);
  });

  test("qiymati 0 bo'lgan element SAQLANADI — `?? ''` uni yo'qotmasin", () => {
    expect(statisticsMap(dbArray).final).toBe(0);
  });

  test("slug bo'lmasa legend harfi bo'yicha topiladi (parser eski chiqishi)", () => {
    const legacy = [
      { key: "A", slug: "", value: 7 },
      { key: "T", slug: undefined, value: 12 },
    ];
    expect(statisticsMap(legacy)).toEqual({ certification: 7, vacation: 12 });
  });

  test("P2-09: bazadagi haqiqiy `tatil_xaftalar_soni` slug'i legend harfisiz ham topiladi", () => {
    const real = [{ key: "", slug: "tatil_xaftalar_soni", title: "Ta’til xaftalar soni", value: 10 }];
    expect(statisticsMap(real)).toEqual({ vacation: 10 });
  });

  test("noma'lum slug e'tiborsiz qoldiriladi — yiqilmaydi", () => {
    expect(statisticsMap([{ key: "X", slug: "yangi_ustun", value: 3 }])).toEqual({});
  });

  test("null element va bo'sh massiv — bo'sh obyekt", () => {
    expect(statisticsMap([null, undefined])).toEqual({});
    expect(statisticsMap([])).toEqual({});
  });
});

describe("statisticsMap — legacy OBYEKT shakli (eski hujjatlar buzilmasin)", () => {
  test("obyekt kelsa o'zgarishsiz qaytariladi", () => {
    const legacyObj = { theoreticalPractical: 30, certification: 6, total: 41 };
    expect(statisticsMap(legacyObj)).toBe(legacyObj);
  });

  test("null / undefined — bo'sh obyekt", () => {
    expect(statisticsMap(null)).toEqual({});
    expect(statisticsMap(undefined)).toEqual({});
  });
});
