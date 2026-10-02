const fs = require("node:fs");
const path = require("node:path");

const CONTROLLER = path.join(__dirname, "workingSchedule.controller.js");
const SRC = fs.readFileSync(CONTROLLER, "utf8");

const BREAKDOWN = path.join(
  __dirname,
  "..",
  "_services",
  "semesterBreakdown.js",
);
const BREAKDOWN_SRC = fs.readFileSync(BREAKDOWN, "utf8");

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

const PROJECTION_MARK = "science: link.science,";
const PRIORITY =
  "evaluationType: semData.assessmentType || s.evaluationType || null,";

describe("generatsiya — baholash turi snapshoti", () => {
  test("fan qatori proyeksiyasi hamon ikki joyda (skaner mo'ljalni yo'qotmadi)", () => {
    expect(countOf(SRC, PROJECTION_MARK)).toBe(2);
  });

  test("har bir proyeksiya AYNI ustuvorlik ifodasini yozadi", () => {
    expect(countOf(SRC, PRIORITY)).toBe(countOf(SRC, PROJECTION_MARK));
  });

  test("o'lik `assessmentType:` yozuvi QAYTIB KELMAYDI", () => {
    expect(SRC).not.toContain("assessmentType: semData.assessmentType");
  });

  test("ustuvorlik `_services/semesterBreakdown.js` bilan bir xil (drift qulfi)", () => {
    expect(BREAKDOWN_SRC).toContain(
      "evaluationType: sem.assessmentType || sci.evaluationType || null,",
    );
  });
});

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");

describe("WorkingPlan ScienceSchema — durable nom faqat `evaluationType`", () => {
  const build = (sci) =>
    new WorkingPlanModel({
      workingSchedule: "aaaaaaaaaaaaaaaaaaaaaa01",
      semesters: {
        1: { semester: "1", blocks: [{ blockCode: "MFI", sciences: [sci] }] },
      },
    }).semesters.get("1").blocks[0].sciences[0];

  test("`assessmentType` sxemada yo'q — mongoose uni JIMGINA tashlaydi", () => {
    const row = build({ title: "Fan", assessmentType: "imtihon (yozma)" });
    expect(row.assessmentType).toBeUndefined();
  });

  test("`evaluationType` saqlanadi", () => {
    const row = build({ title: "Fan", evaluationType: "imtihon (yozma)" });
    expect(row.evaluationType).toBe("imtihon (yozma)");
  });
});
