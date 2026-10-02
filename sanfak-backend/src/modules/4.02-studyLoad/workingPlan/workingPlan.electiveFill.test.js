"use strict";

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.service", () => ({
  addElectiveRow: jest.fn(),
}));

const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const ScienceModel = require("#references/science/science.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const studyPlanService = require("#modules/4.02-studyLoad/studyPlan/studyPlan.service");
const service = require("./workingPlan.service");
const { swapElectiveScienceSchema } = require("./workingPlan.validation");
const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaa01";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbb01";
const SP_ID = "cccccccccccccccccccccc01";
const BLOCK_ID = "111111111111111111111101";
const SLOT_ID = "222222222222222222222201";
const NEW_SCI = "444444444444444444444401";
const NEW_DEPT = "666666666666666666666601";
const ALT_SCI = "999999999999999999999901";

const slotRow = () => ({
  _id: SLOT_ID,
  serialNumber: "2.01",
  code: null,
  title: EMPTY_SLOT_TITLE,
  science: null,
  department: null,
  totalCredit: 5,
  weeklyHours: 5,
  particle: [{ slug: "soat", value: 150 }],
  alternatives: [],
});

const makePlan = () => {
  const block = { _id: BLOCK_ID, blockCode: "TF2", title: "Tanlov fanlar", sciences: [slotRow()] };
  return {
    _id: PLAN_ID,
    studyPlan: SP_ID,
    workingSchedule: WS_ID,
    semesters: new Map([["2", { semester: "2", blocks: [block] }]]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
};

const TARGET = { _id: NEW_SCI, title: "Tibbiy statistika", scienceCode: "FA2001", department: NEW_DEPT, active: true, isElective: true };

const mockSelectLean = (value) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});
const mockLean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

const studyPlanWith = (spRows = []) => ({
  _id: SP_ID,
  blocks: [{ blockCode: "TF2", title: "Tanlov fanlar", semesters: { 4: { hour: 5, credit: 5 } }, sciences: spRows }],
});

const arrange = ({ status = "draft", currentCourse = 2, spRows = [] } = {}) => {
  const plan = makePlan();
  jest.spyOn(StudyPlanModel, "findById").mockReturnValue(mockSelectLean(studyPlanWith(spRows)));
  jest.spyOn(WorkingPlanModel, "findOne").mockResolvedValue(plan);
  jest.spyOn(WorkingPlanModel, "find").mockResolvedValue([]);
  jest
    .spyOn(WorkingScheduleModel, "findById")
    .mockReturnValue(mockSelectLean({ status, academicYear: "y1", currentCourse }));
  jest.spyOn(ScienceModel, "findOne").mockReturnValue(mockLean(TARGET));
  for (const Model of [ScienceProgramModel, SyllabusModel, WorkloadModel, WorkloadDistributionModel]) {
    jest.spyOn(Model, "countDocuments").mockResolvedValue(0);
  }
  studyPlanService.addElectiveRow.mockResolvedValue({
    row: { _id: "sp-row-1" },
    quota: { 4: { hour: 0, credit: 0 } },
    propagation: { propagated: 1, skippedLocked: 0 },
  });
  return plan;
};

const call = (over = {}) =>
  service.swapElectiveScience({
    planId: PLAN_ID,
    semKey: "2",
    blockId: BLOCK_ID,
    scienceRowId: SLOT_ID,
    scienceId: NEW_SCI,
    scope: { workingSchedule: WS_ID },
    ...over,
  });

const expectReject = async (promise, statusCode) => {
  let caught = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).not.toBeNull();
  expect(caught.statusCode).toBe(statusCode);
  return caught;
};

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("swapElectiveScience — bo'sh slot → TO'LDIRISH (ADR-032)", () => {
  test("yagona yozuvchi `addElectiveRow`: global semestr (II kurs, lokal 2 → 4), slot soat/krediti, scope {}", async () => {
    const plan = arrange();
    const res = await call();
    expect(studyPlanService.addElectiveRow).toHaveBeenCalledTimes(1);
    const arg = studyPlanService.addElectiveRow.mock.calls[0][0];
    expect(arg.id).toBe(SP_ID);
    expect(arg.scope).toEqual({});
    expect(arg.body).toEqual({
      blockCode: "TF2",
      science: NEW_SCI,
      serialNumber: "2.01",
      semesters: [{ semester: "4", hour: 5, credit: 5, particle: [] }],
      alternatives: [],
    });
    expect(plan.save).not.toHaveBeenCalled();
    expect(res).toMatchObject({
      workingPlan: PLAN_ID,
      filled: true,
      persisted: true,
      updatedPlans: 1,
      studyPlanRows: 1,
      science: { from: { science: null, code: null }, to: { science: NEW_SCI, code: "FA2001", department: NEW_DEPT } },
    });
  });

  test("Nigora S3: eskirgan slot (5/5) — qoldiq 3/3 bo'lsa so'rov KLAMPLANADI (3/3)", async () => {
    arrange({ spRows: [{ code: "FA9", science: "sci-9", semesters: { 4: { hour: 2, credit: 2 } }, totalCredit: 2 }] });
    await call();
    expect(studyPlanService.addElectiveRow.mock.calls[0][0].body.semesters).toEqual([
      { semester: "4", hour: 3, credit: 3, particle: [] },
    ]);
  });

  test("Nigora S3: qoldiq 0 — 400 sabab bilan, `addElectiveRow` chaqirilmaydi", async () => {
    arrange({ spRows: [{ code: "FA9", science: "sci-9", semesters: { 4: { hour: 5, credit: 5 } }, totalCredit: 5 }] });
    const err = await expectReject(call(), 400);
    expect(err.message).toMatch(/kvotasi qolmagan/);
    expect(studyPlanService.addElectiveRow).not.toHaveBeenCalled();
  });

  test("alternativlar (ixtiyoriy) `addElectiveRow` ga uzatiladi", async () => {
    arrange();
    await call({ alternatives: [{ scienceId: ALT_SCI }] });
    expect(studyPlanService.addElectiveRow.mock.calls[0][0].body.alternatives).toEqual([{ scienceId: ALT_SCI }]);
  });

});

describe("swapElectiveScience — fill rad etiladigan holatlar", () => {
  test("qulflangan (in_review) — 400, `addElectiveRow` chaqirilmaydi", async () => {
    arrange({ status: "in_review" });
    await expectReject(call(), 400);
    expect(studyPlanService.addElectiveRow).not.toHaveBeenCalled();
  });

  test("ADR-042: «Tanlov fani» deb belgilanmagan fan — 400, `addElectiveRow` chaqirilmaydi", async () => {
    arrange();
    jest.spyOn(ScienceModel, "findOne").mockReturnValue(mockLean({ ...TARGET, isElective: false }));
    const err = await expectReject(call(), 400);
    expect(err.message).toMatch(/Tanlov fani/);
    expect(studyPlanService.addElectiveRow).not.toHaveBeenCalled();
  });

  test("kurs raqami yo'q (eski jadval) — 400, taxmin qilinmaydi", async () => {
    arrange({ currentCourse: null });
    const err = await expectReject(call(), 400);
    expect(err.message).toMatch(/Kurs raqami/);
    expect(studyPlanService.addElectiveRow).not.toHaveBeenCalled();
  });

  test("MAVJUD fan qatorida `alternatives` → 400 (jim e'tiborsiz qolmaydi)", async () => {
    const plan = arrange();
    const row = plan.semesters.get("2").blocks[0].sciences[0];
    Object.assign(row, { code: "FA1001", title: "Eski fan", science: "555555555555555555555501" });
    await expectReject(call({ alternatives: [{ scienceId: ALT_SCI }] }), 400);
    expect(studyPlanService.addElectiveRow).not.toHaveBeenCalled();
  });

  test("`addElectiveRow` kvota/dublikat xatosi (409) — o'zgarishsiz yuqoriga chiqadi", async () => {
    arrange();
    const boom = new Error("Bu fan blokda allaqachon bor");
    boom.statusCode = 409;
    studyPlanService.addElectiveRow.mockRejectedValue(boom);
    await expectReject(call(), 409);
  });
});

describe("swapElectiveScienceSchema — kontrakt o'zgarmadi", () => {
  const base = { semKey: "2", parentId: BLOCK_ID, _id: SLOT_ID, scienceId: NEW_SCI };
  test("eski body (alternativsiz) — to'g'ri", () => {
    expect(swapElectiveScienceSchema.validate(base).error).toBeUndefined();
  });
  test("`alternatives` ixtiyoriy, ≤ 2, faqat scienceId", () => {
    expect(swapElectiveScienceSchema.validate({ ...base, alternatives: [{ scienceId: ALT_SCI }] }).error).toBeUndefined();
    expect(swapElectiveScienceSchema.validate({ ...base, alternatives: [{ scienceId: "a" }, { scienceId: "b" }, { scienceId: "c" }] }).error).toBeDefined();
    expect(swapElectiveScienceSchema.validate({ ...base, alternatives: [{ scienceId: "a", code: "X" }] }).error).toBeDefined();
  });
  test("`rowId` kabi yangi kalit — 400 (fork yo'q)", () => {
    expect(swapElectiveScienceSchema.validate({ ...base, rowId: SLOT_ID }).error).toBeDefined();
  });
});
