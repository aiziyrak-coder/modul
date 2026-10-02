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
const ROWS = [
  { key: "M", title: "Amaliyot" },
  { key: " ", title: "Nazariy va amaliy ta'lim" },
];

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

describe("workingSchedule — summaryRows surati (ADR-040)", () => {
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

  test("LP'da summaryRows bor — ishchi rejaga ko'chiriladi", async () => {
    await run(lpWith({ summaryRows: ROWS }));
    expect(createSpy.mock.calls[0][0].summaryRows).toEqual(ROWS);
  });

  test("eski LP (maydon yo'q) — null", async () => {
    await run(lpWith({}));
    expect(createSpy.mock.calls[0][0].summaryRows).toBeNull();
  });
});

describe("workingSchedule.model — summaryRows sxemasi (ADR-040)", () => {
  test("maydon yo'q hujjat — undefined (default yo'q); qator _id'siz", () => {
    expect(new WorkingScheduleModel({}).summaryRows).toBeUndefined();
    const doc = new WorkingScheduleModel({ summaryRows: ROWS });
    expect(doc.toObject().summaryRows).toEqual(ROWS);
  });
});
