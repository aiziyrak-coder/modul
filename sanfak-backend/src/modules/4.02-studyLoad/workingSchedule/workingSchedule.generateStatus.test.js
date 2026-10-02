const fs = require("node:fs");
const path = require("node:path");

const CONTROLLER = path.join(__dirname, "workingSchedule.controller.js");
const SRC = fs.readFileSync(CONTROLLER, "utf8");

const sliceFinalBlock = (src) => {
  const start = src.indexOf("const statusUpdated = created.length > 0;");
  const end = src.indexOf('sseSend(res, "done"', start);
  return start === -1 || end === -1 ? "" : src.slice(start, end);
};

const FINAL_BLOCK = sliceFinalBlock(SRC);

describe("subAddWorkingPlanStream — yakunlash bloki statuslarni yangilaydi", () => {
  test("blok topildi (skaner mo'ljalni yo'qotmadi)", () => {
    expect(FINAL_BLOCK.length).toBeGreaterThan(0);
  });

  test("LearningProcess statusi 'created' ga o'tkaziladi", () => {
    expect(FINAL_BLOCK).toMatch(/LearningProcess\.updateOne\(/);
    expect(FINAL_BLOCK).toMatch(/status:\s*"created"/);
  });

  test("StudyPlan statusi HAM 'created' ga o'tkaziladi (asosiy regressiya)", () => {
    expect(FINAL_BLOCK).toMatch(/StudyPlanModel\.updateOne\(/);
    const lp = (FINAL_BLOCK.match(/LearningProcess\.updateOne\(/g) || []).length;
    const sp = (FINAL_BLOCK.match(/StudyPlanModel\.updateOne\(/g) || []).length;
    expect(lp).toBeGreaterThanOrEqual(1);
    expect(sp).toBeGreaterThanOrEqual(1);
  });

  test("StudyPlan allaqachon yuklangan hujjat _id si bilan yangilanadi", () => {
    expect(FINAL_BLOCK).toMatch(/StudyPlanModel\.updateOne\(\s*\{\s*_id:\s*reja\._id\s*\}/);
  });

  test("xato yutilmaydi — winston.warn bilan qayd etiladi", () => {
    expect(FINAL_BLOCK).toMatch(/catch\s*\(statusErr\)/);
    expect(FINAL_BLOCK).toMatch(/winston\.warn/);
  });

  test("skaner haqiqatan ishlaydi (o'z-o'zini tekshirish)", () => {
    const buzilgan = FINAL_BLOCK.replace(/StudyPlanModel\.updateOne\(/g, "NOOP(");
    expect(buzilgan).not.toMatch(/StudyPlanModel\.updateOne\(/);
    expect(sliceFinalBlock("// boshqa fayl")).toBe("");
  });
});

describe("StudyPlan modeli 'created' statusini qabul qiladi", () => {
  test("status enum'ida 'created' bor — aks holda yuqoridagi yozuv jimgina tushardi", () => {
    const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
    const statusPath = StudyPlanModel.schema.path("status");
    expect(statusPath).toBeDefined();
    expect(statusPath.enumValues).toEqual(expect.arrayContaining(["new", "created"]));
  });
});
