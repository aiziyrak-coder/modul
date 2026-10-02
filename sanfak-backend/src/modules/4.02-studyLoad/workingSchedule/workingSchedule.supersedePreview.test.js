jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const Controller = require("./workingSchedule.controller");

const DIRECTION = "6a75b7a35e352d74b10737fd";
const LP_ID = "6a85a66d5e352d74b1073700";

const mockLearningProcess = (doc) =>
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({
    select: () => ({ lean: () => ({ exec: async () => doc }) }),
  });

const mockSchedules = (docs) =>
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    select: () => ({ lean: () => ({ exec: async () => docs }) }),
  });

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const run = async (req) => {
  const res = makeRes();
  const next = jest.fn();
  await Controller.supersedePreview(req, res, next);
  return {
    res,
    next,
    body: res.json.mock.calls[0]?.[0],
    err: next.mock.calls[0]?.[0],
  };
};

const LP_DOC = {
  _id: LP_ID,
  direction: DIRECTION,
  year: "2025",
  courses: [{ courseNum: 1 }, { courseNum: 2 }, { courseNum: 3 }],
};

describe("supersedePreview — sanoq", () => {
  afterEach(() => jest.restoreAllMocks());

  test("mavjud hujjat yo'q — bo'sh ogohlantirish", async () => {
    mockLearningProcess(LP_DOC);
    mockSchedules([]);

    const { body, next } = await run({
      query: { learningProcess: LP_ID },
      scope: {},
    });

    expect(next).not.toHaveBeenCalled();
    expect(body).toEqual({ affected: [], totalExisting: 0, totalLocked: 0 });
  });

  test("kurs bo'yicha guruhlaydi va qulflanganini alohida sanaydi", async () => {
    mockLearningProcess(LP_DOC);
    mockSchedules([
      { currentCourse: 1, status: "approved" },
      { currentCourse: 1, status: "draft" },
      { currentCourse: 2, status: "in_review" },
      { currentCourse: 3, status: "rejected" },
    ]);

    const { body } = await run({
      query: { learningProcess: LP_ID },
      scope: {},
    });

    expect(body).toEqual({
      affected: [
        { courseNum: 1, existing: 2, locked: 1 },
        { courseNum: 2, existing: 1, locked: 1 },
        { courseNum: 3, existing: 1, locked: 0 },
      ],
      totalExisting: 4,
      totalLocked: 2,
    });
  });

  test("hujjati yo'q kurs `affected` ga kirmaydi", async () => {
    mockLearningProcess(LP_DOC);
    mockSchedules([{ currentCourse: 2, status: "approved" }]);

    const { body } = await run({
      query: { learningProcess: LP_ID },
      scope: {},
    });

    expect(body.affected).toEqual([{ courseNum: 2, existing: 1, locked: 1 }]);
    expect(body.totalExisting).toBe(1);
    expect(body.totalLocked).toBe(1);
  });

  test("kalit `supersedePreviousSchedules` bilan bir xil (dir + yil(String) + kurs)", async () => {
    mockLearningProcess({ ...LP_DOC, year: 2025 });
    const find = mockSchedules([]);

    await run({ query: { learningProcess: LP_ID }, scope: {} });

    expect(find).toHaveBeenCalledWith({
      direction: DIRECTION,
      enrollmentYear: "2025",
      currentCourse: { $in: [1, 2, 3] },
    });
  });

  test("kurslari yo'q learningProcess — DB'ga umuman so'rov ketmaydi", async () => {
    mockLearningProcess({ ...LP_DOC, courses: [] });
    const find = mockSchedules([]);

    const { body } = await run({
      query: { learningProcess: LP_ID },
      scope: {},
    });

    expect(body).toEqual({ affected: [], totalExisting: 0, totalLocked: 0 });
    expect(find).not.toHaveBeenCalled();
  });
});

describe("supersedePreview — HECH NARSA o'zgartirmaydi (asosiy invariant)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("deleteMany / create / updateOne chaqirilmaydi", async () => {
    mockLearningProcess(LP_DOC);
    mockSchedules([
      { currentCourse: 1, status: "approved" },
      { currentCourse: 2, status: "approved" },
    ]);

    const schedDel = jest.spyOn(WorkingScheduleModel, "deleteMany");
    const planDel = jest.spyOn(WorkingPlanModel, "deleteMany");
    const schedCreate = jest.spyOn(WorkingScheduleModel, "create");
    const schedUpdate = jest.spyOn(WorkingScheduleModel, "updateOne");
    const lpUpdate = jest.spyOn(LearningProcess, "updateOne");

    await run({ query: { learningProcess: LP_ID }, scope: {} });

    expect(schedDel).not.toHaveBeenCalled();
    expect(planDel).not.toHaveBeenCalled();
    expect(schedCreate).not.toHaveBeenCalled();
    expect(schedUpdate).not.toHaveBeenCalled();
    expect(lpUpdate).not.toHaveBeenCalled();
  });
});

describe("supersedePreview — kirish va doira (scope)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("learningProcess yo'q — 400", async () => {
    const { err } = await run({ query: {}, scope: {} });

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("query-obyekt injection (`?learningProcess[$ne]=null`) — 400, DB'ga bormaydi", async () => {
    const findOne = jest.spyOn(LearningProcess, "findOne");

    const { err } = await run({
      query: { learningProcess: { $ne: null } },
      scope: {},
    });

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  test("ObjectId bo'lmagan matn — 400", async () => {
    const findOne = jest.spyOn(LearningProcess, "findOne");

    const { err } = await run({ query: { learningProcess: "abc" }, scope: {} });

    expect(err.statusCode).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  test("doiradan tashqari / mavjud emas — 404 (mavjudligi oshkor bo'lmaydi)", async () => {
    mockLearningProcess(null);

    const { err } = await run({
      query: { learningProcess: LP_ID },
      scope: { direction: { $in: [] } },
    });

    expect(err).toBeDefined();
    expect(err.statusCode).toBe(404);
  });

  test("req.scope filtrga QO'SHILADI — begona doira o'tib ketmaydi", async () => {
    const findOne = mockLearningProcess(LP_DOC);
    mockSchedules([]);
    const scope = { direction: { $in: [DIRECTION] } };

    await run({ query: { learningProcess: LP_ID }, scope });

    expect(findOne).toHaveBeenCalledWith({
      _id: LP_ID,
      direction: { $in: [DIRECTION] },
    });
  });
});
