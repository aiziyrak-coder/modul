jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(null) }) })),
}));

jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#references/direction/direction.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#modules/4.02-studyLoad/_services/groupStatsResolver");

const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const { getGroupStats } = require("#modules/4.02-studyLoad/_services/groupStatsResolver");
const Controller = require("./workload.controller");

const ACADEMIC_YEAR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPARTMENT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const schedule = (id, status) => ({
  _id: id,
  direction: "dddddddddddddddddddddddd",
  year: "2023",
  academicYear: ACADEMIC_YEAR_ID,
  groups: ["eeeeeeeeeeeeeeeeeeeeeeee"],
  currentCourse: 1,
  courseRef: "ffffffffffffffffffffffff",
  status,
});

const run = async (schedules) => {
  WorkingScheduleModel.find = jest.fn().mockResolvedValue(schedules);
  WorkingPlanModel.findOne = jest.fn().mockResolvedValue({
    _id: "111111111111111111111111",
    studyPlan: null,
    semesters: { 1: { blocks: [{ title: "I. Fanlar", sciences: [] }] } },
  });
  DirectionModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({}),
  });
  AcademicYearModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
  AcademicYearModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({ title: "2023/2024" }),
  });
  getGroupStats.mockResolvedValue({ groupCount: 1, studentCount: 10, streamCount: 1 });

  const res = createRes();
  const next = jest.fn();
  await Controller.addWorkload(
    { body: { department: DEPARTMENT_ID, academicYear: ACADEMIC_YEAR_ID } },
    res,
    next,
  );
  return { err: next.mock.calls[0]?.[0], res };
};

beforeEach(() => jest.clearAllMocks());

describe("addWorkload — P-01: tasdiqlangan ishchi jadval darvozasi", () => {
  test("faqat draft jadvallar → 409, status kesimi xabarda, WP so'ralmaydi", async () => {
    const { err } = await run([schedule("s1", "draft"), schedule("s2", "draft"), schedule("s3", "in_review")]);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/TASDIQLANMAGAN/);
    expect(err.message).toMatch(/draft ×2/);
    expect(err.message).toMatch(/in_review ×1/);
    expect(WorkingPlanModel.findOne).not.toHaveBeenCalled();
  });

  test("statussiz (eski yozuv) jadval ham tasdiqlanmagan hisoblanadi → 409", async () => {
    const s = schedule("s1", undefined);
    delete s.status;
    const { err } = await run([s]);
    expect(err.statusCode).toBe(409);
    expect(err.message).toMatch(/draft ×1/);
  });

  test("aralash: faqat approved jadval uchun WP so'raladi, draft chetlab o'tiladi (409 EMAS)", async () => {
    const { err } = await run([schedule("draft1", "draft"), schedule("ok1", "approved")]);
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Bu kafedra uchun tegishli fanlar topilmadi");
    expect(WorkingPlanModel.findOne).toHaveBeenCalledTimes(1);
    expect(WorkingPlanModel.findOne).toHaveBeenCalledWith({ workingSchedule: "ok1" });
  });

  test("jadval umuman yo'q → avvalgidek 404 'WorkingSchedule topilmadi'", async () => {
    const { err } = await run([]);
    expect(err.statusCode).toBe(404);
    expect(err.message).toMatch(/WorkingSchedule topilmadi/);
  });

  test("WS so'rovi `status` proyeksiyasini so'raydi (darvoza uchun kerak)", async () => {
    await run([schedule("s1", "draft")]);
    const [, projection] = WorkingScheduleModel.find.mock.calls[0];
    expect(projection).toEqual(expect.objectContaining({ status: 1 }));
  });
});
