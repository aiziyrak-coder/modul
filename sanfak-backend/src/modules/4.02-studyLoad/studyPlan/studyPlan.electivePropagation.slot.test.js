"use strict";

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model", () => ({
  find: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model", () => ({
  find: jest.fn(),
}));

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { propagateElectiveRow, retractElectiveRow } = require("./studyPlan.electivePropagation");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
const { isEmptySlotRow } = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");

const BLOCK = {
  blockCode: "TF2",
  serialNumber: "2",
  code: "TF2",
  title: "Tanlov fanlar",
  totalCredit: 8,
  particle: [
    { slug: "soat", title: "soat", value: 240, canonical: "hour", colNum: 4 },
    { slug: "jami", title: "Jami", value: 120, canonical: "total", colNum: 6 },
    { slug: "mustaqil_talim", title: "Mustaqil ta'lim", value: 120, canonical: "independent", colNum: 12 },
  ],
  semesters: { 3: { hour: 3, credit: 3 }, 4: { hour: 5, credit: 5 } },
  sciences: [],
};

const slotRow = (over = {}) => ({
  _id: "slot-1",
  serialNumber: "2.01",
  code: null,
  title: EMPTY_SLOT_TITLE,
  science: null,
  department: null,
  particle: [
    { slug: "soat", value: 150 },
    { slug: "jami", value: 75 },
    { slug: "mustaqil_talim", value: 75 },
  ],
  totalCredit: 5,
  weeklyHours: 5,
  evaluationType: null,
  alternatives: [],
  ...over,
});

const ROW = {
  serialNumber: "2.01",
  code: "FA2001",
  title: "Tibbiy statistika",
  science: "sci-stat",
  department: "dep-2",
  particle: [],
  semesters: { 4: { hour: 2, credit: 2, particles: [], assessmentType: null } },
  totalCredit: 2,
  alternatives: [{ science: "sci-alt", code: "ALT1", title: "Alt", department: null }],
};

function makePlan({ id, scheduleId, semesters }) {
  const map = new Map();
  for (const [k, v] of Object.entries(semesters)) map.set(k, v);
  return {
    _id: id,
    workingSchedule: scheduleId,
    semesters: map,
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}
function mockDerived(plans, schedules) {
  WorkingPlanModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue(plans) });
  WorkingScheduleModel.find.mockReturnValue({
    select: () => ({ lean: jest.fn().mockResolvedValue(schedules) }),
  });
}
const sched = (id, status = "draft") => ({
  _id: id,
  status,
  currentCourse: 2,
  academicYear: "ay",
  year: "2026/2027",
  direction: "dir",
});

beforeEach(() => jest.clearAllMocks());

describe("propagateElectiveRow — slot JOYIDA to'ldiriladi", () => {
  test("qator soni o'zgarmaydi, `_id` saqlanadi, fan maydonlari katalogdan, qoldiq alohida slot", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [slotRow()] }] } },
    });
    mockDerived([plan], [sched("s1")]);

    const res = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });
    expect(res).toEqual({ propagated: 1, skippedLocked: 0 });

    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      _id: "slot-1",
      code: "FA2001",
      title: "Tibbiy statistika",
      science: "sci-stat",
      department: "dep-2",
      totalCredit: 2,
      weeklyHours: 2,
      alternatives: [{ science: "sci-alt", code: "ALT1" }],
    });
    expect(isEmptySlotRow(rows[0])).toBe(false);
    expect(rows[0].particle.map((p) => `${p.slug}=${p.value}`)).toEqual([
      "soat=60",
      "jami=30",
      "mustaqil_talim=30",
    ]);
    expect(rows[1]).toMatchObject({ title: EMPTY_SLOT_TITLE, totalCredit: 3, weeklyHours: 3, serialNumber: "2.02" });
    expect(isEmptySlotRow(rows[1])).toBe(true);
    expect(rows.reduce((s, r) => s + r.totalCredit, 0)).toBe(5);
    expect(plan.save).toHaveBeenCalledTimes(1);
  });

  test("qator slotning butun kvotasini olsa — qoldiq slot YO'Q (bitta qator qoladi)", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [slotRow()] }] } },
    });
    mockDerived([plan], [sched("s1")]);
    const full = { ...ROW, semesters: { 4: { hour: 5, credit: 5, particles: [], assessmentType: null } }, totalCredit: 5 };
    await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: full });
    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: "slot-1", code: "FA2001", totalCredit: 5 });
  });

});

describe("propagateElectiveRow — slot yo'q / qulflangan holatlar", () => {
  test("slot yo'q blok (eski ishchi reja) — avvalgidek qator PUSH qilinadi", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [] }] } },
    });
    mockDerived([plan], [sched("s1")]);
    await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });
    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ code: "FA2001", totalCredit: 2 });
  });

  test("qulflangan (in_review) reja — slot TEGILMAYDI, skippedLocked", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [slotRow()] }] } },
    });
    mockDerived([plan], [sched("s1", "in_review")]);
    const res = await propagateElectiveRow({ studyPlanId: "sp1", block: BLOCK, row: ROW });
    expect(res).toEqual({ propagated: 0, skippedLocked: 1 });
    expect(isEmptySlotRow(plan.semesters.get("2").blocks[0].sciences[0])).toBe(true);
    expect(plan.save).not.toHaveBeenCalled();
  });
});

const filledRow = () => ({
  _id: "slot-1",
  serialNumber: "2.01",
  code: "FA2001",
  title: "Tibbiy statistika",
  science: "sci-stat",
  department: "dep-2",
  particle: [{ slug: "soat", value: 60 }],
  totalCredit: 2,
  weeklyHours: 2,
  alternatives: [],
});

describe("retractElectiveRow — kvota slotga QAYTADI", () => {
  test("qoldiq slot bor → olib tashlangan qator kvotasi unga QO'SHILADI (3+2 = 5), particle qayta", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: {
        2: {
          semester: "2",
          blocks: [
            {
              blockCode: "TF2",
              serialNumber: "2",
              sciences: [filledRow(), slotRow({ _id: "slot-2", serialNumber: "2.02", totalCredit: 3, weeklyHours: 3 })],
            },
          ],
        },
      },
    });
    mockDerived([plan], [sched("s1")]);
    const res = await retractElectiveRow({ studyPlanId: "sp1", blockCode: "TF2", row: ROW, block: BLOCK });
    expect(res).toEqual({ retracted: 1, skippedLocked: 0 });
    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: "slot-2", totalCredit: 5, weeklyHours: 5 });
    expect(rows[0].particle.map((p) => `${p.slug}=${p.value}`)).toEqual(["soat=150", "jami=75", "mustaqil_talim=75"]);
  });

});

describe("retractElectiveRow — slot yo'q bo'lsa yaratiladi", () => {
  test("slot yo'q → yangi slot yaratiladi (kvota yo'qolmaydi)", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [filledRow()] }] } },
    });
    mockDerived([plan], [sched("s1")]);
    await retractElectiveRow({ studyPlanId: "sp1", blockCode: "TF2", row: ROW, block: BLOCK });
    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: EMPTY_SLOT_TITLE, totalCredit: 2, weeklyHours: 2, serialNumber: "2.01" });
    expect(isEmptySlotRow(rows[0])).toBe(true);
  });

  test("`block` berilmasa (eski chaqiruvchi) — zaxira nisbatlar bilan slot baribir tiklanadi", async () => {
    const plan = makePlan({
      id: "wp1",
      scheduleId: "s1",
      semesters: { 2: { semester: "2", blocks: [{ blockCode: "TF2", serialNumber: "2", sciences: [filledRow()] }] } },
    });
    mockDerived([plan], [sched("s1")]);
    await retractElectiveRow({ studyPlanId: "sp1", blockCode: "TF2", row: ROW });
    const rows = plan.semesters.get("2").blocks[0].sciences;
    expect(rows[0]).toMatchObject({ title: EMPTY_SLOT_TITLE, totalCredit: 2 });
    expect(rows[0].particle.find((p) => p.slug === "soat").value).toBe(60);
  });
});
