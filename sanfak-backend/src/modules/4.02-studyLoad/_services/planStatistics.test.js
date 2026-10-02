const { academicStatistics } = require("./planStatistics");

const course = (statistics) => ({
  course: "I",
  courseNum: 1,
  statistics,
});

const baseKeys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "M", title: "Malakaviy amaliyot" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
  { key: "T", title: "Ta'til" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash" },
];

const baseStatistics = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 180 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 35 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 27 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy Davlat attestatsiyasi", value: 4 },
  { key: "T", slug: "tatil", title: "Ta'til", value: 56 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit ta'lim tizimiga kirish", value: 1 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA ko'rsatkichini hisoblash", value: 5 },
];

const summaryFixture = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", weeks: 180, semester: "1-12", note: null },
  { key: "M", title: "Amaliyot", weeks: 27, semester: "2-11", note: null },
  { key: "A", title: "Attestatsiyalar", weeks: 35, semester: "1-12", note: null },
  { key: "D", title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", weeks: 4, semester: 12, note: "Ixtisoslik fanlaridan integrallashgan yakuniy davlat attestatsiyasi" },
  { key: "T", title: "Ta'til haftalari", weeks: 56, semester: "1-12", note: null },
  { key: "K", title: "Kredit ta'lim tizimiga kirish", weeks: 1, semester: 1, note: null },
  { key: "G", title: "GPA ko'rsatkichini hisoblash", weeks: 5, semester: "2,4,6,8,10", note: null },
];

const byKey = (keys, key) => keys.find((k) => k.key === key);

describe("academicStatistics — Semestr ustuni (Q-5)", () => {
  test("`data.summary` bo'lsa — har kalitga mos semestr matni yoziladi (matn qiymatlar ham)", () => {
    const data = {
      keys: baseKeys(),
      courses: [course(baseStatistics())],
      summary: summaryFixture(),
    };

    const { keys } = academicStatistics(data);

    expect(byKey(keys, " ").semester).toBe("1-12");
    expect(byKey(keys, "M").semester).toBe("2-11");
    expect(byKey(keys, "A").semester).toBe("1-12");
    expect(byKey(keys, "D").semester).toBe("12");
    expect(byKey(keys, "T").semester).toBe("1-12");
    expect(byKey(keys, "K").semester).toBe("1");
    expect(byKey(keys, "G").semester).toBe("2,4,6,8,10");

    expect(byKey(keys, " ").week).toBe(180);
    expect(byKey(keys, "G").week).toBe(5);
  });

  test("JAMI qatorida Semestr har doim `null` (blanketda '—')", () => {
    const data = {
      keys: baseKeys(),
      courses: [course(baseStatistics())],
      summary: summaryFixture(),
    };
    const { keys } = academicStatistics(data);
    const jami = keys.find((k) => k.title === "JAMI");
    expect(jami).toBeDefined();
    expect(jami.semester).toBeNull();
  });

  test("`data.summary` yo'q (eski fayl) — semestr `null`, `0` EMAS (backward-compat)", () => {
    const data = {
      keys: baseKeys(),
      courses: [course(baseStatistics())],
    };
    const { keys } = academicStatistics(data);
    for (const k of keys) {
      expect(k.semester).toBeNull();
    }
  });

  test("`data.summary` bo'sh massiv bo'lsa — yiqilmaydi, semestr `null`", () => {
    const data = {
      keys: baseKeys(),
      courses: [course(baseStatistics())],
      summary: [],
    };
    expect(() => academicStatistics(data)).not.toThrow();
    const { keys } = academicStatistics(data);
    expect(byKey(keys, "A").semester).toBeNull();
  });

  test("summary qatorida `key` topilmagan (null) bo'lsa — shu qator e'tiborsiz qoldiriladi", () => {
    const data = {
      keys: baseKeys(),
      courses: [course(baseStatistics())],
      summary: [
        { key: null, title: "Noma'lum qator", weeks: 3, semester: "5", note: null },
        { key: "A", title: "Attestatsiyalar", weeks: 35, semester: "1-12", note: null },
      ],
    };
    const { keys } = academicStatistics(data);
    expect(byKey(keys, "A").semester).toBe("1-12");
    expect(byKey(keys, "M").semester).toBeNull();
  });
});
