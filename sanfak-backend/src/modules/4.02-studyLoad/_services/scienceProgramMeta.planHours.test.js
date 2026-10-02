const {
  AUDITORIUM_SLUG_ORDER,
  orderAuditoriumItems,
  isClinicalSubject,
  applyClinicalHourSplit,
  buildPlanHours,
  buildScienceProgramMeta,
} = require("./scienceProgramMeta");
const {
  CLINICAL_PRACTICE_SHARE,
} = require("#modules/4.02-studyLoad/workload/workload.model");

const item = (slug, value, title = slug) => ({ slug, title, value });

describe("AUDITORIUM_SLUG_ORDER — Kengash #4(a) allowlist", () => {
  test("aynan 5 slug, aynan shu tartibda; `mustaqil` YO'Q", () => {
    expect([...AUDITORIUM_SLUG_ORDER]).toEqual([
      "maruza",
      "amaliy",
      "seminar",
      "laboratoriya",
      "klinik_amaliyot",
    ]);
    expect(AUDITORIUM_SLUG_ORDER).not.toContain("mustaqil");
    expect(Object.isFrozen(AUDITORIUM_SLUG_ORDER)).toBe(true);
  });
});

describe("orderAuditoriumItems — filtr + tartib", () => {
  test("aralash tartibdagi hourItems kanonik tartibga tushadi", () => {
    const out = orderAuditoriumItems([
      item("laboratoriya", 8),
      item("maruza", 12),
      item("klinik_amaliyot", 0),
      item("seminar", 4),
      item("amaliy", 40),
    ]);
    expect(out.map((i) => i.slug)).toEqual([
      "maruza",
      "amaliy",
      "seminar",
      "laboratoriya",
      "klinik_amaliyot",
    ]);
  });

  test("`mustaqil`, `soat`, `jami`, noma'lum slug — TUSHIB QOLADI (xom hourItems ishlatilmaydi)", () => {
    const out = orderAuditoriumItems([
      item("mustaqil", 60),
      item("soat", 120),
      item("jami", 60),
      item("kurs_ishi", 1),
      item("maruza", 12),
    ]);
    expect(out).toEqual([item("maruza", 12)]);
  });

  test("0 qiymatli tur SAQLANADI ('rejada bor, 0 soat' ≠ 'rejada yo'q' — FE `0/0` vs `unplanned`)", () => {
    const out = orderAuditoriumItems([item("laboratoriya", 0), item("maruza", 10)]);
    expect(out).toEqual([item("maruza", 10), item("laboratoriya", 0)]);
  });

  test("bo'sh/null/buzuq kirish → []", () => {
    expect(orderAuditoriumItems([])).toEqual([]);
    expect(orderAuditoriumItems(null)).toEqual([]);
    expect(orderAuditoriumItems(undefined)).toEqual([]);
    expect(orderAuditoriumItems([null, {}, { slug: "maruza" }])).toEqual([
      { slug: "maruza", title: "", value: 0 },
    ]);
  });

  test("qiymat Number ga majburlanadi, title yo'q bo'lsa ''", () => {
    expect(orderAuditoriumItems([{ slug: "amaliy", value: "40" }])).toEqual([
      { slug: "amaliy", title: "", value: 40 },
    ]);
  });
});

describe("isClinicalSubject — workload.controller bilan bir xil qoida", () => {
  const header = (serialNumber, title) => ({ serialNumber, code: "", title });
  const subject = (serialNumber, code, title) => ({ serialNumber, code, title });

  const block = {
    sciences: [
      header("1.2.", "Klinika oldi fanlari moduli"),
      subject("1.2.01", "TBUG1106", "Tibbiy biologiya"),
      header("1.3.", "Klinik modullar"),
      header("1.3.1", "Terapiya yo'nalishi"),
      subject("1.3.1.01", "TKK1104", "Tibbiyot kasbiga kirish"),
    ],
  };

  test("'1.3.' Klinik modullar ostidagi fan → true (kichik sarlavha '1.3.1' orqali ham)", () => {
    expect(isClinicalSubject({ foundSci: block.sciences[4], foundBlock: block })).toBe(true);
  });

  test("'1.2.' Klinika oldi ostidagi fan → false (negative lookahead)", () => {
    expect(isClinicalSubject({ foundSci: block.sciences[1], foundBlock: block })).toBe(false);
  });

  test("sarlavhasiz tekis blok → false", () => {
    const flat = { sciences: [subject("1", "A1", "Anatomiya"), subject("2", "B1", "Biologiya")] };
    expect(isClinicalSubject({ foundSci: flat.sciences[0], foundBlock: flat })).toBe(false);
  });

  test("signal YO'Q (`foundBlock.sciences` massiv emas / blok yo'q) → null (taxmin qilinmaydi)", () => {
    expect(isClinicalSubject({ foundSci: {}, foundBlock: {} })).toBeNull();
    expect(isClinicalSubject({ foundSci: {}, foundBlock: null })).toBeNull();
    expect(isClinicalSubject({})).toBeNull();
  });
});

describe("applyClinicalHourSplit — ADR-018 qoidasi qayta ishlatiladi", () => {
  test("isClinical=false → faqat allowlist/tartib, klinik element YO'Q, derived=false", () => {
    const out = applyClinicalHourSplit([item("amaliy", 62), item("maruza", 10), item("mustaqil", 54)]);
    expect(out).toEqual({
      items: [item("maruza", 10), item("amaliy", 62)],
      clamped: false,
      derived: false,
    });
  });

  test("GOLDEN (ADR-018 / workload.model izohi): aud 72 = ma'ruza 10 + amaliy 62 → klinik 36, amaliy 26", () => {
    const out = applyClinicalHourSplit([item("maruza", 10), item("amaliy", 62)], {
      isClinical: true,
    });
    expect(out.items).toEqual([
      item("maruza", 10),
      item("amaliy", 26),
      { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", value: 36 },
    ]);
    expect(out.derived).toBe(true);
    expect(out.clamped).toBe(false);
  });

  test("default share = CLINICAL_PRACTICE_SHARE (workload.model) — ikkinchi konstanta yo'q", () => {
    const items = [item("maruza", 10), item("amaliy", 62)];
    const byDefault = applyClinicalHourSplit(items, { isClinical: true });
    const explicit = applyClinicalHourSplit(items, { isClinical: true, share: CLINICAL_PRACTICE_SHARE });
    expect(byDefault).toEqual(explicit);
    expect(CLINICAL_PRACTICE_SHARE).toBe(0.5);
  });

  test("INVARIANT: Σ auditoriya ajratishdan keyin ham o'zgarmaydi (seminar/lab ham bazaga kiradi, tegilmaydi)", () => {
    const input = [item("maruza", 12), item("amaliy", 40), item("seminar", 4), item("laboratoriya", 8)];
    const out = applyClinicalHourSplit(input, { isClinical: true });
    const before = input.reduce((a, i) => a + i.value, 0);
    const after = out.items.reduce((a, i) => a + i.value, 0);

    expect(after).toBe(before);
    expect(out.items.find((i) => i.slug === "klinik_amaliyot").value).toBe(32);
    expect(out.items.find((i) => i.slug === "amaliy").value).toBe(8);
    expect(out.items.find((i) => i.slug === "seminar").value).toBe(4);
    expect(out.items.find((i) => i.slug === "laboratoriya").value).toBe(8);
    expect(out.items.map((i) => i.slug)).toEqual(["maruza", "amaliy", "seminar", "laboratoriya", "klinik_amaliyot"]);
  });

  test("CLAMPED: klinik > amaliy → amaliy bilan chegaralanadi (amaliy 0 ga tushadi), clamped=true", () => {
    const out = applyClinicalHourSplit([item("maruza", 30), item("amaliy", 10)], { isClinical: true });
    expect(out.clamped).toBe(true);
    expect(out.items).toEqual([
      item("maruza", 30),
      item("amaliy", 0),
      { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", value: 10 },
    ]);
  });

  test("rejada alohida klinik particle BOR (clinical > 0) → hosila hisob ustun kelmaydi, reja qiymati saqlanadi", () => {
    const out = applyClinicalHourSplit(
      [item("maruza", 10), item("amaliy", 40), item("klinik_amaliyot", 22, "Klinik")],
      { isClinical: true },
    );
    expect(out.derived).toBe(false);
    expect(out.items).toEqual([item("maruza", 10), item("amaliy", 40), item("klinik_amaliyot", 22, "Klinik")]);
  });

  test("klinik fan, lekin amaliy 0 → klinik element 0 bilan (fan klinik ekani ko'rinadi), clamped", () => {
    const out = applyClinicalHourSplit([item("maruza", 10)], { isClinical: true });
    expect(out.items).toEqual([
      item("maruza", 10),
      { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", value: 0 },
    ]);
    expect(out.clamped).toBe(true);
  });

  test("kirish massivi MUTATSIYA qilinmaydi (sof funksiya)", () => {
    const input = [item("maruza", 10), item("amaliy", 62)];
    const snapshot = JSON.stringify(input);
    applyClinicalHourSplit(input, { isClinical: true });
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("buildPlanHours — §1 proyeksiyasi + warnings", () => {
  const PARTICLE = [
    { slug: "soat", canonical: "hour", value: 120 },
    { slug: "jami", canonical: "total", value: 60 },
    { slug: "maruza", canonical: "lecture", title: "Ma'ruza", value: 12 },
    { slug: "mustaqil_ta_lim", canonical: "independent", title: "Mustaqil", value: 60 },
    { slug: "amaliy_mashg_ulot", canonical: "practical", title: "Amaliy", value: 48 },
  ];
  const foundSci = {
    science: "s1",
    serialNumber: "1.2.06",
    code: "AN11-312",
    title: "Anatomiya",
    totalCredit: 4,
    weeklyHours: 4,
    particle: PARTICLE,
  };
  const foundBlock = { blockCode: "MFI", title: "Majburiy fanlar", sciences: [foundSci] };
  const workingPlan = { workingSchedule: { academicYear: "ay1" } };
  const args = { workingPlan, foundSci, foundBlock, semesterKey: "3" };

  test("meta bilan BIR XIL manba: barcha §1 qiymatlari buildScienceProgramMeta natijasiga teng, academicYear YO'Q", () => {
    const meta = buildScienceProgramMeta(args);
    const ph = buildPlanHours(args);

    for (const key of ["classroomHours", "independentHours", "totalHours", "credits", "weeklyHours", "semester", "code", "serialNumber", "moduleType"]) {
      expect(ph[key]).toEqual(meta[key]);
    }
    expect(ph).not.toHaveProperty("academicYear");
    expect(ph).not.toHaveProperty("hourItems");
    expect(ph).not.toHaveProperty("clinicalUnknown");
  });

  test("items — allowlist bo'yicha, mustaqil yo'q; warnings [] (60 = 12 + 48)", () => {
    const ph = buildPlanHours(args);
    expect(ph.items).toEqual([
      { slug: "maruza", title: "Ma'ruza", value: 12 },
      { slug: "amaliy", title: "Amaliy", value: 48 },
    ]);
    expect(ph.independentHours).toBe(60);
    expect(ph.warnings).toEqual([]);
  });

  test("jami ≠ Σ turlar → ogohlantirish (Kengash #10), natija baribir qaytadi", () => {
    const skewed = PARTICLE.map((p) => (p.canonical === "total" ? { ...p, value: 66 } : p));
    const ph = buildPlanHours({ ...args, foundSci: { ...foundSci, particle: skewed } });
    expect(ph.classroomHours).toBe(66);
    expect(ph.items).toHaveLength(2);
    expect(ph.warnings).toHaveLength(1);
    expect(ph.warnings[0]).toMatch(/66/);
    expect(ph.warnings[0]).toMatch(/60/);
  });

  test("particle bo'sh → items [], 'soat ko'rsatilmagan' ogohlantirishi (nomutanosiblik xabari YO'Q)", () => {
    const ph = buildPlanHours({ ...args, foundSci: { ...foundSci, particle: [] } });
    expect(ph.items).toEqual([]);
    expect(ph.warnings).toHaveLength(1);
    expect(ph.warnings[0]).toMatch(/soat ko'rsatilmagan/);
  });

  test("klinik blok → klinik element + Σ invarianti, warnings []", () => {
    const clinicalBlock = {
      blockCode: "MFI",
      sciences: [
        { serialNumber: "1.3.", code: "", title: "Klinik modullar" },
        { ...foundSci, serialNumber: "1.3.01" },
      ],
    };
    const ph = buildPlanHours({ ...args, foundSci: clinicalBlock.sciences[1], foundBlock: clinicalBlock });
    expect(ph.items).toEqual([
      { slug: "maruza", title: "Ma'ruza", value: 12 },
      { slug: "amaliy", title: "Amaliy", value: 18 },
      { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", value: 30 },
    ]);
    expect(ph.items.reduce((a, i) => a + i.value, 0)).toBe(ph.classroomHours);
    expect(ph.warnings).toEqual([]);
    expect(ph).not.toHaveProperty("clinicalUnknown");
  });

  test("clamped klinik → ogohlantirish", () => {
    const clampParticle = [
      { slug: "jami", canonical: "total", value: 40 },
      { slug: "maruza", canonical: "lecture", title: "Ma'ruza", value: 30 },
      { slug: "amaliy_mashg_ulot", canonical: "practical", title: "Amaliy", value: 10 },
    ];
    const sci = { ...foundSci, serialNumber: "1.3.01", particle: clampParticle };
    const clinicalBlock = { sciences: [{ serialNumber: "1.3.", code: "", title: "Klinik modullar" }, sci] };
    const ph = buildPlanHours({ ...args, foundSci: sci, foundBlock: clinicalBlock });

    expect(ph.items.find((i) => i.slug === "klinik_amaliyot").value).toBe(10);
    expect(ph.items.find((i) => i.slug === "amaliy").value).toBe(0);
    expect(ph.warnings.some((w) => /chegaralandi/.test(w))).toBe(true);
    expect(ph.warnings.some((w) => /mos emas/.test(w))).toBe(false);
  });

  test("klinik signal YO'Q (blok qatorlari o'qib bo'lmadi) → clinicalUnknown:true, klinik element yo'q, ogohlantirish", () => {
    const ph = buildPlanHours({ ...args, foundBlock: { blockCode: "MFI" } });
    expect(ph.clinicalUnknown).toBe(true);
    expect(ph.items.map((i) => i.slug)).not.toContain("klinik_amaliyot");
    expect(ph.warnings.some((w) => /aniqlab bo'lmadi/.test(w))).toBe(true);
  });

  test("R-4.02-27 qulfi: hourItems'ga sun'iy slug kirsa ham items'ga TUSHMAYDI", () => {
    const poisoned = [...PARTICLE, { slug: "kurs_ishi", canonical: "courseWork", title: "Kurs ishi", value: 5 }];
    const ph = buildPlanHours({ ...args, foundSci: { ...foundSci, particle: poisoned } });
    expect(ph.items.map((i) => i.slug)).toEqual(["maruza", "amaliy"]);
  });
});
