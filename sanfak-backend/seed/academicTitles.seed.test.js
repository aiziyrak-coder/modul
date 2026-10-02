const fs = require("fs");
const path = require("path");

const { TITLES, resolveWriteMode, decideAcademicTitleChange } = require("./academicTitles.seed");

const SEED_PATH = path.join(__dirname, "academicTitles.seed.js");
const SRC = fs.readFileSync(SEED_PATH, "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("academicTitles.seed — resolveWriteMode (R-2 DRY-default)", () => {
  test("argumentsiz chaqiruv — DRY flag true, WRITE false (yozish yo'li tanlanmaydi)", () => {
    const { WRITE, DRY } = resolveWriteMode([]);
    expect(DRY).toBe(true);
    expect(WRITE).toBe(false);
  });

  test("--write berilsa — WRITE true, DRY false (yozish yo'li tanlanadi)", () => {
    const { WRITE, DRY } = resolveWriteMode(["--write"]);
    expect(WRITE).toBe(true);
    expect(DRY).toBe(false);
  });

  test("--dry-run aniq bayrog'i ham DRY (WRITE berilmagan holatda kutilgan default bilan bir xil)", () => {
    const { WRITE, DRY } = resolveWriteMode(["--dry-run"]);
    expect(DRY).toBe(true);
    expect(WRITE).toBe(false);
  });

  test("--write VA --dry-run birga berilsa — DRY G'OLIB (xavfsiz tomon)", () => {
    const { WRITE, DRY } = resolveWriteMode(["--write", "--dry-run"]);
    expect(WRITE).toBe(true);
    expect(DRY).toBe(true);
  });

  test("boshqa notanish bayroqlar ta'sir qilmaydi", () => {
    expect(resolveWriteMode(["--verbose", "--foo"]).DRY).toBe(true);
  });
});

describe("academicTitles.seed — yozish yo'li DRY bilan qo'riqlanadi, WRITE bilan EMAS (regressiya)", () => {
  test("kodda `if (WRITE)` UMUMAN yo'q — yozish yo'li faqat `if (DRY)`/`else` orqali", () => {
    expect(CODE).not.toMatch(/if\s*\(\s*WRITE\s*\)/);
  });

  test("`if (DRY)` aynan 2 marta — create va update qarorlari uchun", () => {
    expect(CODE.match(/if\s*\(\s*DRY\s*\)\s*\{/g)).toHaveLength(2);
  });

  test("`AcademicTitle.create(...)` chaqiruvi `if (DRY) {...} else {...}` ning ELSE shoxida", () => {
    expect(CODE).toMatch(/if\s*\(DRY\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?await AcademicTitle\.create\(/);
  });

  test("`existing.save()` chaqiruvi `if (DRY) {...} else {...}` ning ELSE shoxida", () => {
    expect(CODE).toMatch(/if\s*\(DRY\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?await existing\.save\(/);
  });
});

describe("academicTitles.seed — decideAcademicTitleChange", () => {
  const target = { title: "Dotsent", rateTime: 800, hourMultiplier: 1.15, desc: "Associate Professor (PhD)" };

  test("mavjud yozuv yo'q — \"create\" qarori", () => {
    expect(decideAcademicTitleChange(null, target)).toEqual({ action: "create" });
  });

  test("rateTime farq qilsa — \"update\", eski→yangi ko'rsatiladi", () => {
    const existing = { rateTime: 350, hourMultiplier: 1.15, active: true };
    const decision = decideAcademicTitleChange(existing, target);
    expect(decision.action).toBe("update");
    expect(decision.changes).toContainEqual({ field: "rateTime", old: 350, new: 800 });
  });

  test("hourMultiplier farq qilsa — \"update\" ro'yxatiga tushadi", () => {
    const existing = { rateTime: 800, hourMultiplier: 1.0, active: true };
    const decision = decideAcademicTitleChange(existing, target);
    expect(decision.changes).toContainEqual({ field: "hourMultiplier", old: 1.0, new: 1.15 });
  });

  test("active=false bo'lsa — \"update\" (true ga qaytariladi)", () => {
    const existing = { rateTime: 800, hourMultiplier: 1.15, active: false };
    const decision = decideAcademicTitleChange(existing, target);
    expect(decision.changes).toContainEqual({ field: "active", old: false, new: true });
  });

  test("hech narsa farq qilmasa — \"unchanged\", changes bo'sh", () => {
    const existing = { rateTime: 800, hourMultiplier: 1.15, active: true };
    expect(decideAcademicTitleChange(existing, target)).toEqual({ action: "unchanged" });
  });

  test("desc farqi \"update\" TRIGGER QILMAYDI (model'da desc maydoni yo'q — hech qachon persist bo'lmaydi)", () => {
    const existing = { rateTime: 800, hourMultiplier: 1.15, active: true, desc: undefined };
    const decision = decideAcademicTitleChange(existing, { ...target, desc: "Butunlay boshqa matn" });
    expect(decision.action).toBe("unchanged");
  });
});

describe("academicTitles.seed — require.main qulfi (DB'siz import)", () => {
  test("seed() faqat require.main === module ichida chaqiriladi", () => {
    expect(SRC).toMatch(/if\s*\(\s*require\.main\s*===\s*module\s*\)/);
  });

  test("sof funksiyalar va TITLES eksport qilingan", () => {
    expect(typeof resolveWriteMode).toBe("function");
    expect(typeof decideAcademicTitleChange).toBe("function");
    expect(Array.isArray(TITLES)).toBe(true);
    expect(TITLES).toHaveLength(4);
  });
});

describe("academicTitles.seed — DRY hisoboti CREATE/UPDATE'ni ajratadi", () => {
  test("DRY yaratish qatorida \"yaratilardi\" so'zi bor", () => {
    expect(SRC).toMatch(/\[DRY\] yaratilardi/);
  });

  test("DRY yangilash qatorida \"yangilanardi\" so'zi bor", () => {
    expect(SRC).toMatch(/\[DRY\] yangilanardi/);
  });

  test("--write bo'lmasa yakuniy hisobot ogohlantirish beradi", () => {
    expect(SRC).toMatch(/DRY-RUN edi — bazaga hech narsa yozilmadi/);
  });
});
