jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#references/_services/courseResolver", () => ({
  resolveCourse: jest.fn().mockResolvedValue(null),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const WorkingScheduleJob = require("#modules/4.02-studyLoad/_shared/workingScheduleJob.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const DirectionModel = require("#references/direction/direction.model");
const Controller = require("./workingSchedule.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

const eventsOf = (res) => {
  const out = [];
  const writes = res.write.mock.calls.map((c) => c[0]);
  for (let i = 0; i < writes.length; i++) {
    const m = /^event: (\w+)\n$/.exec(writes[i]);
    if (m) out.push({ event: m[1], data: JSON.parse(writes[i + 1].slice(6)) });
  }
  return out;
};

const lpWithCourses = (nums) => ({
  _id: "lp1",
  year: "2025",
  direction: "dir1",
  keys: [],
  learningProcess: { keys: [], title: "LP" },
  courses: nums.map((n) => ({
    course: String(n),
    courseNum: n,
    weeks: {},
    months: [],
    total: 0,
    statistics: [],
  })),
});

let wsCreate;
let jobCreate;

const setup = (courseNums) => {
  jest.spyOn(LearningProcess, "exists").mockResolvedValue(true);
  jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
    populate: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: "sp1",
        blocks: [],
        meta: undefined,
        learningProcess: lpWithCourses(courseNums),
      }),
    }),
  });
  jest.spyOn(DirectionModel, "findById").mockReturnValue({
    lean: () => ({ exec: jest.fn().mockResolvedValue({ title: "Davolash ishi" }) }),
  });
  jobCreate = jest
    .spyOn(WorkingScheduleJob, "create")
    .mockImplementation(async (d) => ({ ...d, _id: "job1" }));
  jest.spyOn(WorkingScheduleJob, "updateOne").mockResolvedValue({});
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    select: jest.fn().mockResolvedValue([]),
  });
  wsCreate = jest
    .spyOn(WorkingScheduleModel, "create")
    .mockImplementation(async (d) => ({ ...d, _id: `ws${d.currentCourse}` }));
  jest.spyOn(WorkingPlanModel, "create").mockResolvedValue({ _id: "wp" });
  jest.spyOn(AcademicYearModel, "findOne").mockResolvedValue({ _id: "y1" });
  jest.spyOn(LearningProcess, "updateOne").mockResolvedValue({});
  jest.spyOn(StudyPlanModel, "updateOne").mockResolvedValue({});
};

const run = async (query) => {
  const res = createRes();
  await Controller.subAddWorkingPlanStream(
    { query: { learningProcess: "lp1", ...query }, scope: {}, user: { _id: "u1" }, on: jest.fn() },
    res,
    jest.fn(),
  );
  return res;
};

afterEach(() => jest.restoreAllMocks());

describe("subAddWorkingPlanStream — ?courses= tanlovi", () => {
  test("courses=1,2 → faqat 1 va 2-kurs yaratiladi, job totalCourses=2", async () => {
    setup([1, 2, 3, 4, 5, 6]);
    const res = await run({ courses: "1,2" });

    expect(wsCreate.mock.calls.map((c) => c[0].currentCourse)).toEqual([1, 2]);
    expect(jobCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCourses: 2,
        courses: [
          { courseNum: 1, status: "pending" },
          { courseNum: 2, status: "pending" },
        ],
      }),
    );
    const evs = eventsOf(res);
    expect(evs.find((e) => e.event === "start").data.totalCourses).toBe(2);
    const done = evs.find((e) => e.event === "done").data;
    expect(done.totalCreated).toBe(2);
    expect(done.created.map((c) => c.courseNum)).toEqual([1, 2]);
    expect(
      WorkingScheduleModel.find.mock.calls.map((c) => c[0].currentCourse),
    ).toEqual([1, 2]);
  });

  test("rejada yo'q kurs → error event, hech narsa yaratilmaydi, lock olinmaydi", async () => {
    setup([1, 2, 3, 4]);
    const res = await run({ courses: ["4", "5", "6"] });

    const evs = eventsOf(res);
    expect(evs).toHaveLength(1);
    expect(evs[0].event).toBe("error");
    expect(evs[0].data.message).toMatch(/o'quv rejada yo'q: 5, 6/);
    expect(jobCreate).not.toHaveBeenCalled();
    expect(wsCreate).not.toHaveBeenCalled();
    expect(LearningProcess.updateOne).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
  });

});

describe("subAddWorkingPlanStream — ?courses= yo'q / noto'g'ri", () => {
  test("param yo'q → HAMMA kurslar (regressiya)", async () => {
    setup([1, 2, 3]);
    const res = await run({});

    expect(wsCreate.mock.calls.map((c) => c[0].currentCourse)).toEqual([1, 2, 3]);
    expect(jobCreate).toHaveBeenCalledWith(
      expect.objectContaining({ totalCourses: 3 }),
    );
    expect(eventsOf(res).find((e) => e.event === "done").data.totalCreated).toBe(3);
  });

  test.each([["0"], ["a"], [{ $ne: "" }]])(
    "noto'g'ri courses=%p → 400, SSE header YUBORILMAYDI",
    async (courses) => {
      setup([1, 2]);
      const res = await run({ courses });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(LearningProcess.exists).not.toHaveBeenCalled();
    },
  );
});
