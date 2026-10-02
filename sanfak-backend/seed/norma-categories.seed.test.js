"use strict";

const {
  NORMA_CATEGORIES,
  resolveWriteMode,
  decideCategoryChanges,
} = require("./norma-categories.seed");
const {
  resolvePositionSlug,
} = require("../src/modules/4.02-studyLoad/_shared/positionSlug");

describe("norma-categories.seed — resolveWriteMode (DRY-default)", () => {
  test("argumentsiz chaqiruv — DRY true, WRITE false (yozish yo'li tanlanmaydi)", () => {
    const { WRITE, DRY } = resolveWriteMode([]);
    expect(DRY).toBe(true);
    expect(WRITE).toBe(false);
  });

  test("--write berilsa — WRITE true, DRY false", () => {
    const { WRITE, DRY } = resolveWriteMode(["--write"]);
    expect(WRITE).toBe(true);
    expect(DRY).toBe(false);
  });

  test("--write VA --dry-run birga — DRY G'OLIB (xavfsiz tomon)", () => {
    const { WRITE, DRY } = resolveWriteMode(["--write", "--dry-run"]);
    expect(WRITE).toBe(true);
    expect(DRY).toBe(true);
  });
});

describe("norma-categories.seed — decideCategoryChanges (MERGE)", () => {
  test("bo'sh baza — barcha kanonik kategoriyalar CREATE, o'chirish yo'q", () => {
    const d = decideCategoryChanges([]);
    expect(d.create.map((c) => c.slug)).toEqual([
      "professor",
      "docent",
      "senior_teacher",
      "assistant",
      "trainee",
    ]);
    expect(d.update).toHaveLength(0);
    expect(d.unchanged).toHaveLength(0);
    expect(d.extra).toHaveLength(0);
  });

  test("`categories` maydoni umuman yo'q (undefined) — yiqilmaydi, CREATE qaytaradi", () => {
    expect(decideCategoryChanges(undefined).create).toHaveLength(NORMA_CATEGORIES.length);
  });

  test("baza to'liq va mos — hammasi unchanged (idempotent, qayta yurgizish 0 o'zgarish)", () => {
    const d = decideCategoryChanges(NORMA_CATEGORIES.map((c) => ({ ...c })));
    expect(d.unchanged).toHaveLength(NORMA_CATEGORIES.length);
    expect(d.create).toHaveLength(0);
    expect(d.update).toHaveLength(0);
  });

  test("qiymat noto'g'ri (test4 D-1: trainee=54) — UPDATE, old→new diffi bilan", () => {
    const d = decideCategoryChanges([{ slug: "trainee", title: "Stajyor o'qituvchi", value: 54 }]);
    expect(d.update).toEqual([
      { slug: "trainee", changes: [{ field: "value", old: 54, new: 400 }] },
    ]);
    expect(d.create.map((c) => c.slug)).toEqual([
      "professor",
      "docent",
      "senior_teacher",
      "assistant",
    ]);
  });

  test("title BO'SH bo'lsa to'ldiriladi, mavjud title QAYTA YOZILMAYDI", () => {
    const d = decideCategoryChanges([
      { slug: "docent", title: null, value: 350 },
      { slug: "professor", title: "Профессор", value: 300 },
    ]);
    expect(d.update).toEqual([
      { slug: "docent", changes: [{ field: "title", old: null, new: "Dotsent" }] },
    ]);
    expect(d.unchanged).toContain("professor");
  });

  test("ro'yxatda YO'Q slug — `extra` da hisobotga tushadi, o'chirish/yangilash QARORI YO'Q", () => {
    const d = decideCategoryChanges([
      ...NORMA_CATEGORIES.map((c) => ({ ...c })),
      { slug: "visiting_professor", title: "Taklif etilgan professor", value: 120 },
    ]);
    expect(d.extra).toEqual([{ slug: "visiting_professor", value: 120 }]);
    expect(d.update).toHaveLength(0);
    expect(d.create).toHaveLength(0);
  });

  test("qiymat string bo'lib saqlangan bo'lsa ham raqam bilan solishtiriladi (soxta UPDATE yo'q)", () => {
    const d = decideCategoryChanges([{ slug: "assistant", title: "Assistent", value: "400" }]);
    expect(d.unchanged).toContain("assistant");
  });
});

describe("norma-categories.seed — slug'lar positionSlug bilan mos", () => {
  test.each([
    ["Professor", "professor"],
    ["Dotsent", "docent"],
    ["Katta o'qituvchi", "senior_teacher"],
    ["Assistent", "assistant"],
    ["Stajyor o'qituvchi", "trainee"],
  ])("lavozim «%s» → slug «%s» kanonik ro'yxatda bor", (title, slug) => {
    expect(resolvePositionSlug(title)).toBe(slug);
    expect(NORMA_CATEGORIES.some((c) => c.slug === slug)).toBe(true);
  });
});

describe("norma-categories.seed — kanonik qiymatlar qulfi", () => {
  test("professor 300 · docent 350 · senior_teacher 380 · assistant 400 · trainee 400", () => {
    expect(Object.fromEntries(NORMA_CATEGORIES.map((c) => [c.slug, c.value]))).toEqual({
      professor: 300,
      docent: 350,
      senior_teacher: 380,
      assistant: 400,
      trainee: 400,
    });
  });

  test("slug'lar takrorlanmaydi", () => {
    const slugs = NORMA_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
