const fs = require("node:fs");
const path = require("node:path");

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const Controller = require("./workingSchedule.controller");

const CONTROLLER = path.join(__dirname, "workingSchedule.controller.js");
const SRC = fs.readFileSync(CONTROLLER, "utf8");

const sliceFinalBlock = (src) => {
  const start = src.indexOf("const statusUpdated = created.length > 0;");
  const end = src.indexOf('sseSend(res, "done"', start);
  return start === -1 || end === -1 ? "" : src.slice(start, end);
};

const sliceGuardedBranch = (block) => {
  const start = block.indexOf("if (statusUpdated) {");
  if (start === -1) return "";
  const end = block.indexOf("} else {", start);
  return end === -1 ? "" : block.slice(start, end);
};

const FINAL_BLOCK = sliceFinalBlock(SRC);
const GUARDED = sliceGuardedBranch(FINAL_BLOCK);

describe("AD-1b — status guard: hech nima yaratilmasa status o'tmaydi", () => {
  test("blok topildi (skaner mo'ljalni yo'qotmadi)", () => {
    expect(FINAL_BLOCK.length).toBeGreaterThan(0);
  });

  test("guard mavjud: statusUpdated = created.length > 0", () => {
    expect(FINAL_BLOCK).toMatch(
      /const\s+statusUpdated\s*=\s*created\.length\s*>\s*0\s*;/,
    );
  });

  test("LearningProcess statusi FAQAT guard ichida yangilanadi", () => {
    expect(GUARDED).toMatch(/LearningProcess\.updateOne\(/);
    const outside = FINAL_BLOCK.replace(GUARDED, "");
    expect(outside).not.toMatch(/LearningProcess\.updateOne\(/);
  });

  test("StudyPlan statusi ham FAQAT guard ichida yangilanadi", () => {
    expect(GUARDED).toMatch(/StudyPlanModel\.updateOne\(/);
    const outside = FINAL_BLOCK.replace(GUARDED, "");
    expect(outside).not.toMatch(/StudyPlanModel\.updateOne\(/);
  });

  test("0 holat jimgina o'tmaydi — winston.warn bilan qayd etiladi", () => {
    const elseBranch = FINAL_BLOCK.slice(FINAL_BLOCK.indexOf("} else {"));
    expect(elseBranch).toMatch(/winston\.warn/);
  });

  test("skaner haqiqatan ishlaydi (o'z-o'zini tekshirish)", () => {
    expect(sliceGuardedBranch("// guard yo'q")).toBe("");
    expect(sliceFinalBlock("// boshqa fayl")).toBe("");
    expect(GUARDED.length).toBeGreaterThan(0);
  });
});

describe("AD-1b — done xabari 0 holatda 'yaratildi' DEMAYDI", () => {
  const build = Controller._buildDoneMessage;

  test("0 yaratilgan, 0 o'tkazilgan — 'yaratildi' so'zi yo'q", () => {
    const msg = build({
      totalCreated: 0,
      totalReplaced: 0,
      totalLockedReplaced: 0,
      totalSkipped: 0,
    });
    expect(msg).not.toMatch(/yaratildi/);
    expect(msg).toMatch(/yaratilmadi/);
  });

  test("0 yaratilgan, 5 o'tkazilgan — o'tkazilganlar soni ko'rinadi", () => {
    const msg = build({
      totalCreated: 0,
      totalReplaced: 0,
      totalLockedReplaced: 0,
      totalSkipped: 5,
    });
    expect(msg).not.toMatch(/yaratildi/);
    expect(msg).toMatch(/5 ta kurs o'tkazib yuborildi/);
  });

  test("5 yaratildi, 5 almashtirildi, 5 tasi tasdiqlangan edi — hammasi aytiladi", () => {
    const msg = build({
      totalCreated: 5,
      totalReplaced: 5,
      totalLockedReplaced: 5,
      totalSkipped: 0,
    });
    expect(msg).toMatch(/5 ta kurs uchun ishchi o'quv reja yaratildi/);
    expect(msg).toMatch(/almashtirildi/);
    expect(msg).toMatch(/tasdiqlangan edi/);
  });

  test("almashtirish bo'lmasa — ortiqcha qavs qo'shilmaydi", () => {
    const msg = build({
      totalCreated: 3,
      totalReplaced: 0,
      totalLockedReplaced: 0,
      totalSkipped: 0,
    });
    expect(msg).toBe("3 ta kurs uchun ishchi o'quv reja yaratildi");
  });

  test("almashtirilgan bor, lekin qulflangani yo'q — 'tasdiqlangan' deyilmaydi", () => {
    const msg = build({
      totalCreated: 2,
      totalReplaced: 2,
      totalLockedReplaced: 0,
      totalSkipped: 0,
    });
    expect(msg).toMatch(/almashtirildi/);
    expect(msg).not.toMatch(/tasdiqlangan/);
  });
});
