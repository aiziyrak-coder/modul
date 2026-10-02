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

const createOneCourseWorkingPlan = Controller._createOneCourseWorkingPlan;

const lpWith = (extra) => ({
  _id: "lp1",
  direction: "dir1",
  keys: [],
  learningProcess: { keys: [], title: "Test LP" },
  ...extra,
});

const run = (lp) =>
  createOneCourseWorkingPlan({
    lp,
    reja: { blocks: [], meta: undefined },
    course: { course: "1", courseNum: 1, weeks: { 1: " " }, months: [], total: 0, statistics: [] },
    year: "2025",
    directionTitle: "Test yo'nalish",
  });

describe("workingSchedule — attestationNote surati (ADR-038)", () => {
  let createSpy;

  beforeEach(() => {
    jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    createSpy = jest
      .spyOn(WorkingScheduleModel, "create")
      .mockImplementation(async (data) => ({ ...data, _id: "sched1" }));
    jest.spyOn(WorkingPlanModel, "create").mockResolvedValue({ _id: "plan1" });
    jest.spyOn(AcademicYearModel, "findOne").mockResolvedValue({ _id: "year1" });
  });

  afterEach(() => jest.restoreAllMocks());

  test("LP'da matn bor — ishchi rejaga ko'chiriladi", async () => {
    await run(lpWith({ attestationNote: "Integrallashgan attestatsiya" }));
    expect(createSpy.mock.calls[0][0].attestationNote).toBe("Integrallashgan attestatsiya");
  });

  test("eski LP (maydon yo'q) — null", async () => {
    await run(lpWith({}));
    expect(createSpy.mock.calls[0][0].attestationNote).toBeNull();
  });
});
