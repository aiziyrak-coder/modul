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

const baseLp = (overrides = {}) => ({
  _id: "lp1",
  direction: "dir1",
  academicLevel: "al1",
  readingForm: "rf1",
  educationForm: "ef1",
  studyPeriod: "sp1",
  specialization: null,
  comment: null,
  keys: [],
  learningProcess: { keys: [], title: "Test LP" },
  ...overrides,
});

const baseCourse = () => ({
  course: "1",
  courseNum: 1,
  weeks: { "1": " " },
  months: [],
  total: 0,
  statistics: [],
});

const baseReja = () => ({ blocks: [], meta: undefined });

describe("workingSchedule — createOneCourseWorkingPlan: desc ← learningProcess.basisNote", () => {
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

  test("basisNote bor — ws.desc aynan shu matn bilan yoziladi", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp({ basisNote: "TDTU tomonidan 2025-yil tasdiqlangan o'quv reja asosida ishlab chiqilgan" }),
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    expect(written.desc).toBe(
      "TDTU tomonidan 2025-yil tasdiqlangan o'quv reja asosida ishlab chiqilgan",
    );
  });

  test("basisNote yo'q (undefined) — ws.desc null (bo'sh qavs chiqmasin)", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp(),
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    expect(written.desc).toBeNull();
  });

  test("basisNote model default (null) — ws.desc null", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp({ basisNote: null }),
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    expect(written.desc).toBeNull();
  });

  test("eski hujjat (basisNote maydoni umuman yo'q, backward-compat) — ws.desc null, portlamaydi", async () => {
    const legacyLp = baseLp();
    delete legacyLp.basisNote;

    await createOneCourseWorkingPlan({
      lp: legacyLp,
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    expect(written.desc).toBeNull();
  });
});
