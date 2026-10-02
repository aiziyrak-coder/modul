"use strict";

const fs = require("fs");
const path = require("path");

jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#references/_services/courseResolver", () => ({
  resolveCourse: jest.fn().mockResolvedValue(null),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const Controller = require("./workingSchedule.controller");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const { isEmptySlotRow } = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");

const createOneCourseWorkingPlan = Controller._createOneCourseWorkingPlan;

const CONTROLLER = path.join(__dirname, "workingSchedule.controller.js");
const SRC = fs.readFileSync(CONTROLLER, "utf8");
const count = (re) => (SRC.match(re) || []).length;

describe("ADR-032 — slot yordamchisi IKKALA generatsiya nusxasida", () => {
  test("fan qatori proyeksiyasi hamon ikki joyda (skaner mo'ljalni yo'qotmadi)", () => {
    expect(count(/const semSciences = \(block\.sciences \|\| \[\]\)/g)).toBe(2);
  });
  test("`buildQuotaSlotRow(block, globalSemKey` — aynan 2 chaqiruv", () => {
    expect(count(/buildQuotaSlotRow\(block, globalSemKey/g)).toBe(2);
  });
  test("legacy bo'sh slot (`isEmptySlotRow(s)`) ikkala nusxada o'tkazib yuboriladi", () => {
    expect(count(/if \(isEmptySlotRow\(s\)\) return null;/g)).toBe(2);
  });
  test("slot mantiqi controller'da DUBLIKAT qilinmagan (faqat import)", () => {
    expect(count(/EMPTY_SLOT_TITLE/g)).toBe(0);
  });
});

const LP_KEYS = [
  { key: " ", title: "Nazariy va amaliy ta'lim" },
  { key: "T", title: "Ta'til" },
];
const baseLp = () => ({
  _id: "lp1",
  direction: "dir1",
  academicLevel: "al1",
  readingForm: "rf1",
  educationForm: "ef1",
  studyPeriod: "sp1",
  specialization: null,
  comment: null,
  keys: LP_KEYS,
  learningProcess: { keys: LP_KEYS.map((k) => ({ ...k, semester: null })), title: "Test LP" },
});
const course2 = () => ({
  course: "2",
  courseNum: 2,
  weeks: { "1": " ", "2": "T" },
  months: [],
  total: 0,
  statistics: [],
});

const particle = (soat, jami) => [
  { slug: "soat", title: "soat", value: soat, canonical: "hour", colNum: 4 },
  { slug: "jami", title: "Jami", value: jami, canonical: "total", colNum: 6 },
  { slug: "mustaqil_talim", title: "Mustaqil ta'lim", value: soat - jami, canonical: "independent", colNum: 12 },
];

const mf1 = () => ({
  blockCode: "MF1",
  serialNumber: "1",
  code: "MF1",
  title: "Majburiy fanlar",
  particle: particle(120, 60),
  semesters: { 3: { hour: 4, credit: 4 } },
  totalCredit: 4,
  sciences: [
    {
      _id: "row-1",
      serialNumber: "1.01",
      code: "FS1104",
      title: "Falsafa",
      science: "sci-fs",
      department: "dep-1",
      particle: particle(120, 60),
      semesters: { 3: { hour: 4, credit: 4 } },
      totalCredit: 4,
    },
  ],
});

const tf2 = (sciences = []) => ({
  blockCode: "TF2",
  serialNumber: "2",
  code: "TF2",
  title: "Tanlov fanlar",
  particle: particle(240, 120),
  semesters: { 3: { hour: 3, credit: 3 }, 4: { hour: 5, credit: 5 } },
  totalCredit: 8,
  sciences,
});

const reja = (blocks) => ({ _id: "sp1", blocks, meta: undefined });

let planCreate;
beforeEach(() => {
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  });
  jest
    .spyOn(WorkingScheduleModel, "create")
    .mockImplementation(async (data) => ({ ...data, _id: "sched1" }));
  planCreate = jest.spyOn(WorkingPlanModel, "create").mockResolvedValue({ _id: "plan1" });
  jest.spyOn(AcademicYearModel, "findOne").mockResolvedValue({ _id: "year1" });
});
afterEach(() => jest.restoreAllMocks());

const generate = async (blocks) => {
  await createOneCourseWorkingPlan({
    lp: baseLp(),
    reja: reja(blocks),
    course: course2(),
    year: "2026",
    directionTitle: "Test yo'nalish",
  });
  expect(planCreate).toHaveBeenCalledTimes(1);
  return planCreate.mock.calls[0][0].semesters;
};

describe("ADR-032 — createOneCourseWorkingPlan: kvota-faqat blok", () => {
  test("kvota-faqat TF2 → har semestrda blok CHIQADI, bitta slot (3/3 va 5/5), particle bo'sh emas", async () => {
    const sems = await generate([mf1(), tf2()]);
    const tfSem1 = sems["1"].blocks.find((b) => b.blockCode === "TF2");
    const tfSem2 = sems["2"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem1.sciences).toHaveLength(1);
    expect(tfSem1.sciences[0]).toMatchObject({
      serialNumber: "2.01",
      title: EMPTY_SLOT_TITLE,
      code: null,
      science: null,
      department: null,
      totalCredit: 3,
      weeklyHours: 3,
    });
    expect(isEmptySlotRow(tfSem1.sciences[0])).toBe(true);
    expect(tfSem1.sciences[0].particle.map((p) => `${p.slug}=${p.value}`)).toEqual([
      "soat=90",
      "jami=45",
      "mustaqil_talim=45",
    ]);
    expect(tfSem2.sciences).toHaveLength(1);
    expect(tfSem2.sciences[0]).toMatchObject({ totalCredit: 5, weeklyHours: 5 });
    expect(sems["1"].blocks.find((b) => b.blockCode === "MF1").sciences).toHaveLength(1);
    expect(sems["2"].blocks.find((b) => b.blockCode === "MF1")).toBeUndefined();
  });

});

describe("ADR-032 — createOneCourseWorkingPlan: qisman/to'liq kvota, legacy slot", () => {
  test("o'quv rejada tanlangan fan (ADR-025 qatori) + qoldiq → fan qatori + qoldiq slot (2.02)", async () => {
    const chosen = {
      _id: "row-e",
      serialNumber: "2.01",
      code: "FA2001",
      title: "Tibbiy statistika",
      science: "sci-stat",
      department: "dep-2",
      particle: [],
      semesters: { 4: { hour: 2, credit: 2, particles: [] } },
      totalCredit: 2,
      alternatives: [],
    };
    const sems = await generate([tf2([chosen])]);
    const tfSem2 = sems["2"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem2.sciences.map((s) => [s.code, s.totalCredit, s.serialNumber])).toEqual([
      ["FA2001", 2, "2.01"],
      [null, 3, "2.02"],
    ]);
    expect(isEmptySlotRow(tfSem2.sciences[1])).toBe(true);
  });

  test("Nigora S1: 3-semestrda 2.01, 4-semestrda 2.02 → 4-semestr sloti 2.03 (dublikat yo'q)", async () => {
    const r301 = { _id: "r1", serialNumber: "2.01", code: "FA2001", title: "A", science: "s1", department: "d", particle: [], semesters: { 3: { hour: 1, credit: 1, particles: [] } }, totalCredit: 1, alternatives: [] };
    const r402 = { _id: "r2", serialNumber: "2.02", code: "FA2002", title: "B", science: "s2", department: "d", particle: [], semesters: { 4: { hour: 2, credit: 2, particles: [] } }, totalCredit: 2, alternatives: [] };
    const sems = await generate([tf2([r301, r402])]);
    const tfSem2 = sems["2"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem2.sciences.map((s) => s.serialNumber)).toEqual(["2.02", "2.03"]);
  });

  test("kvota TO'LIQ band → slot yo'q (faqat fan qatori)", async () => {
    const full = {
      _id: "row-f",
      serialNumber: "2.01",
      code: "FA2001",
      title: "Tibbiy statistika",
      science: "sci-stat",
      department: "dep-2",
      particle: [],
      semesters: { 4: { hour: 5, credit: 5, particles: [] } },
      totalCredit: 5,
      alternatives: [],
    };
    const sems = await generate([tf2([full])]);
    const tfSem2 = sems["2"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem2.sciences).toHaveLength(1);
    expect(tfSem2.sciences[0].code).toBe("FA2001");
  });

});

describe("ADR-032 — createOneCourseWorkingPlan: legacy bo'sh slot (R-4.02-47)", () => {
  test("o'quv rejadagi LEGACY bo'sh slot qatori ko'chirilmaydi — kvotadan BITTA slot", async () => {
    const legacy = {
      _id: "row-legacy",
      serialNumber: null,
      code: null,
      title: EMPTY_SLOT_TITLE,
      science: null,
      department: null,
      particle: [],
      semesters: { 4: { hour: 5, credit: 5 } },
      totalCredit: 5,
    };
    const sems = await generate([tf2([legacy])]);
    const tfSem2 = sems["2"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem2).toBeUndefined();
    const tfSem1 = sems["1"].blocks.find((b) => b.blockCode === "TF2");
    expect(tfSem1.sciences).toHaveLength(1);
    expect(isEmptySlotRow(tfSem1.sciences[0])).toBe(true);
  });
});
