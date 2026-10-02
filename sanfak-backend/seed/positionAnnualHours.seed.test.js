const fs = require("fs");
const path = require("path");

const { POSITION_HOURS, resolveWriteMode, decidePositionHoursChange } = require("./positionAnnualHours.seed");

const SEED_PATH = path.join(__dirname, "positionAnnualHours.seed.js");
const SRC = fs.readFileSync(SEED_PATH, "utf8");
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("positionAnnualHours.seed — resolveWriteMode (R-3 DRY-default)", () => {
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

  test("--dry-run aniq bayrog'i ham DRY", () => {
    const { WRITE, DRY } = resolveWriteMode(["--dry-run"]);
    expect(DRY).toBe(true);
    expect(WRITE).toBe(false);
  });

  test("--write VA --dry-run birga berilsa — DRY G'OLIB (xavfsiz tomon)", () => {
    const { WRITE, DRY } = resolveWriteMode(["--write", "--dry-run"]);
    expect(WRITE).toBe(true);
    expect(DRY).toBe(true);
  });
});

describe("positionAnnualHours.seed — yozish yo'li DRY bilan qo'riqlanadi, WRITE bilan EMAS (regressiya)", () => {
  test("kodda `if (WRITE)` UMUMAN yo'q — yozish yo'li faqat `if (DRY)`/`else` orqali", () => {
    expect(CODE).not.toMatch(/if\s*\(\s*WRITE\s*\)/);
  });

  test("`if (DRY)` aynan 1 marta — update qarori uchun", () => {
    expect(CODE.match(/if\s*\(\s*DRY\s*\)\s*\{/g)).toHaveLength(1);
  });

  test("`p.save()` chaqiruvi `if (DRY) {...} else {...}` ning ELSE shoxida", () => {
    expect(CODE).toMatch(/if\s*\(DRY\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?await p\.save\(/);
  });
});

describe("positionAnnualHours.seed — decidePositionHoursChange", () => {
  const config = POSITION_HOURS["Dotsent"];

  test("annualHours farq qilsa — \"update\", eski→yangi ko'rsatiladi", () => {
    const existing = {
      annualHours: 720,
      minAuditoriumHours: config.minAuditoriumHours,
      maxAuditoriumHours: config.maxAuditoriumHours,
      allowedStakes: config.allowedStakes,
    };
    const decision = decidePositionHoursChange(existing, config);
    expect(decision.action).toBe("update");
    expect(decision.changes).toContainEqual({ field: "annualHours", old: 720, new: 800 });
  });

  test("minAuditoriumHours/maxAuditoriumHours mustaqil trigger qiladi", () => {
    const existing = {
      annualHours: config.annualHours,
      minAuditoriumHours: 300,
      maxAuditoriumHours: 700,
      allowedStakes: config.allowedStakes,
    };
    const decision = decidePositionHoursChange(existing, config);
    expect(decision.changes).toContainEqual({ field: "minAuditoriumHours", old: 300, new: config.minAuditoriumHours });
    expect(decision.changes).toContainEqual({ field: "maxAuditoriumHours", old: 700, new: config.maxAuditoriumHours });
  });

  test("hech narsa farq qilmasa — \"unchanged\", changes bo'sh", () => {
    const existing = {
      annualHours: config.annualHours,
      minAuditoriumHours: config.minAuditoriumHours,
      maxAuditoriumHours: config.maxAuditoriumHours,
      allowedStakes: config.allowedStakes,
    };
    expect(decidePositionHoursChange(existing, config)).toEqual({ action: "unchanged", changes: [] });
  });

  test("allowedStakes YOLG'IZ farq qilsa (raqamli maydonlar bir xil) — trigger QILMAYDI (original xulq saqlangan)", () => {
    const existing = {
      annualHours: config.annualHours,
      minAuditoriumHours: config.minAuditoriumHours,
      maxAuditoriumHours: config.maxAuditoriumHours,
      allowedStakes: [9.99],
    };
    expect(decidePositionHoursChange(existing, config).action).toBe("unchanged");
  });

  test("raqamli maydon triggerlanganda allowedStakes farqi HAM diffga qo'shiladi (ma'lumot uchun)", () => {
    const existing = {
      annualHours: 720,
      minAuditoriumHours: config.minAuditoriumHours,
      maxAuditoriumHours: config.maxAuditoriumHours,
      allowedStakes: [9.99],
    };
    const decision = decidePositionHoursChange(existing, config);
    expect(decision.changes).toContainEqual({ field: "allowedStakes", old: [9.99], new: config.allowedStakes });
  });

  test("\"create\" qarori HECH QACHON qaytmaydi (bu funksiya faqat mavjud hujjat uchun chaqiriladi)", () => {
    expect(SRC).not.toMatch(/action:\s*"create"/);
  });
});

describe("positionAnnualHours.seed — require.main qulfi (DB'siz import)", () => {
  test("seed() faqat require.main === module ichida chaqiriladi", () => {
    expect(SRC).toMatch(/if\s*\(\s*require\.main\s*===\s*module\s*\)/);
  });

  test("sof funksiyalar va POSITION_HOURS eksport qilingan", () => {
    expect(typeof resolveWriteMode).toBe("function");
    expect(typeof decidePositionHoursChange).toBe("function");
    expect(POSITION_HOURS).toBeInstanceOf(Object);
    expect(POSITION_HOURS["Dotsent"]).toBeDefined();
  });
});

describe("positionAnnualHours.seed — DRY hisoboti", () => {
  test("DRY yangilash qatorida \"yangilanardi\" so'zi bor", () => {
    expect(SRC).toMatch(/\[DRY\] yangilanardi/);
  });

  test("--write bo'lmasa yakuniy hisobot ogohlantirish beradi", () => {
    expect(SRC).toMatch(/DRY-RUN edi — bazaga hech narsa yozilmadi/);
  });
});
