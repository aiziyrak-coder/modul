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

const LP_KEYS = [
  { key: " ", title: "Nazariy va amaliy ta'lim" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish" },
  { key: "M", title: "Malakaviy amaliyot" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
  { key: "T", title: "Ta'til" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash" },
];

const LP_PROCESS_KEYS = [
  ...LP_KEYS.map((k) => ({ ...k, semester: null })),
  { key: "J", title: "JAMI", semester: null },
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
  learningProcess: { keys: LP_PROCESS_KEYS, title: "Test LP" },
});

const baseCourse = () => ({
  course: "1",
  courseNum: 1,
  weeks: { "1": " ", "2": " ", "3": "A", "4": "M", "5": "D", "6": "T" },
  months: [],
  total: 0,
  statistics: [],
});

const baseReja = () => ({ blocks: [], meta: undefined });

describe("workingSchedule — createOneCourseWorkingPlan: keys filtri yo'q", () => {
  let createSpy;

  beforeEach(() => {
    jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    createSpy = jest
      .spyOn(WorkingScheduleModel, "create")
      .mockImplementation(async (data) => ({ ...data, _id: "sched1" }));
    jest
      .spyOn(WorkingPlanModel, "create")
      .mockResolvedValue({ _id: "plan1" });
    jest
      .spyOn(AcademicYearModel, "findOne")
      .mockResolvedValue({ _id: "year1" });
  });

  afterEach(() => jest.restoreAllMocks());

  test("ws.keys — HAMMA 7 belgi qaytadi (K va G ham), shu kursda ishlatilmagan bo'lsa ham", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp(),
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const written = createSpy.mock.calls[0][0];

    expect(written.keys).toHaveLength(7);
    expect(written.keys.map((k) => k.key)).toEqual(
      expect.arrayContaining([" ", "A", "K", "M", "D", "T", "G"]),
    );
  });

  test("ws.learningProcessData.keys — ishlatilmagan belgi uchun week: 0, ishlatilgan uchun to'g'ri hisob, JAMI = totalWeeks", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp(),
      reja: baseReja(),
      course: baseCourse(),
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    const lpKeys = written.learningProcessData.keys;

    expect(lpKeys).toHaveLength(8);

    const byKey = Object.fromEntries(lpKeys.map((k) => [k.key, k]));

    expect(byKey.K).toMatchObject({ title: "Kredit ta'lim tizimiga kirish", week: 0 });
    expect(byKey.G).toMatchObject({
      title: "GPA ko'rsatkichini hisoblash",
      week: 0,
    });

    expect(byKey[" "]).toMatchObject({ week: 2 });
    expect(byKey.A).toMatchObject({ week: 1 });
    expect(byKey.M).toMatchObject({ week: 1 });
    expect(byKey.D).toMatchObject({ week: 1 });
    expect(byKey.T).toMatchObject({ week: 1 });

    expect(byKey.J).toMatchObject({ title: "JAMI", week: 6 });
  });

  test("shu kursda HECH belgi ishlatilmasa ham (bo'sh weeks) — keys hamon to'liq qaytadi", async () => {
    await createOneCourseWorkingPlan({
      lp: baseLp(),
      reja: baseReja(),
      course: { ...baseCourse(), weeks: {} },
      year: "2025",
      directionTitle: "Test yo'nalish",
    });

    const written = createSpy.mock.calls[0][0];
    expect(written.keys).toHaveLength(7);
    const byKey = Object.fromEntries(
      written.learningProcessData.keys.map((k) => [k.key, k]),
    );
    expect(byKey.K.week).toBe(0);
    expect(byKey.G.week).toBe(0);
    expect(byKey[" "].week).toBe(0);
    expect(byKey.J).toMatchObject({ title: "JAMI", week: 0 });
  });
});
