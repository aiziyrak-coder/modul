const mongoose = require("mongoose");

jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const LearningProcess = require("./learningProcess.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { updateLearningProcessMonthWeeks } = require("./monthWeeks.service");
const Controller = require("./learningProcess.controller");

const MONTHS = [
  "Sentabr", "Oktabr", "Noyabr", "Dekabr", "Yanvar", "Fevral",
  "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust",
];
const LIVE = [5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const NEXT = [4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const counts = (arr) => MONTHS.map((month, i) => ({ month, count: arr[i] }));

const course = (id, label) => {
  const months = [];
  let n = 1;
  MONTHS.forEach((month, i) => {
    const weeks = [];
    for (let k = 0; k < LIVE[i]; k++) weeks.push({ week: n++, key: n === 2 ? "K" : " " });
    months.push({ month, weeks });
  });
  return { _id: id, course: label, months, weeks: {} };
};

const LP_ID = String(new mongoose.Types.ObjectId());
const lpDoc = () => ({ _id: LP_ID, courses: [course("c1", "I"), course("c2", "II")] });

const mockLp = (doc) =>
  jest.spyOn(LearningProcess, "findOne").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) }),
  });

const mockSchedules = (list) => {
  WorkingScheduleModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(list) }),
  });
  WorkingScheduleModel.updateOne = jest.fn().mockResolvedValue({ acknowledged: true });
};

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(LearningProcess, "updateOne").mockResolvedValue({ acknowledged: true });
});

describe("updateLearningProcessMonthWeeks", () => {
  test("barcha kurslar bitta updateOne bilan (faqat months, kurs _id bo'yicha); javob taqsimot", async () => {
    mockLp(lpDoc());
    mockSchedules([]);
    const out = await updateLearningProcessMonthWeeks({
      id: LP_ID,
      scope: { direction: { $in: ["d1"] } },
      counts: counts(NEXT),
    });
    expect(LearningProcess.findOne).toHaveBeenCalledWith({ _id: LP_ID, direction: { $in: ["d1"] } });
    expect(LearningProcess.updateOne).toHaveBeenCalledTimes(1);
    const [, update, opts] = LearningProcess.updateOne.mock.calls[0];
    expect(Object.keys(update.$set)).toEqual(["courses.$[c0].months", "courses.$[c1].months"]);
    expect(opts.arrayFilters).toEqual([{ "c0._id": "c1" }, { "c1._id": "c2" }]);
    expect(update.$set["courses.$[c0].months"][0].weeks).toHaveLength(4);
    expect(out.months.map((m) => m.count)).toEqual(NEXT);
    expect(out.updatedCourses).toBe(2);
    expect(out.schedules).toEqual({ updated: 0, skippedLocked: 0, errors: [] });
  });

  test("scope tashqarisi → 404, hech narsa yozilmaydi", async () => {
    mockLp(null);
    await expect(
      updateLearningProcessMonthWeeks({ id: LP_ID, scope: {}, counts: counts(NEXT) }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(LearningProcess.updateOne).not.toHaveBeenCalled();
  });

  test("yig'indi 52 emas → 400, yozuv yo'q", async () => {
    mockLp(lpDoc());
    await expect(
      updateLearningProcessMonthWeeks({ id: LP_ID, scope: {}, counts: counts([5, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]) }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/52 bo'lishi kerak \(hozir 53\)/) });
    expect(LearningProcess.updateOne).not.toHaveBeenCalled();
  });
});

describe("updateLearningProcessMonthWeeks — draft ishchi rejalarga tarqatish", () => {
  test("qulflanganlar o'tkazib yuboriladi va sanaladi", async () => {
    mockLp(lpDoc());
    mockSchedules([
      { _id: "ws1", status: "draft", title: "I bosqich", courses: [course("k1", "I")] },
      { _id: "ws2", status: "approved", title: "II bosqich", courses: [course("k2", "II")] },
      { _id: "ws3", status: "in_review", title: "III bosqich", courses: [course("k3", "III")] },
      { _id: "ws4", status: "rejected", title: "IV bosqich", courses: [course("k4", "IV")] },
    ]);
    const out = await updateLearningProcessMonthWeeks({ id: LP_ID, scope: {}, counts: counts(NEXT) });
    expect(WorkingScheduleModel.find).toHaveBeenCalledWith({ learningProcess: LP_ID });
    expect(WorkingScheduleModel.updateOne).toHaveBeenCalledTimes(2);
    expect(WorkingScheduleModel.updateOne.mock.calls.map((c) => c[0]._id)).toEqual(["ws1", "ws4"]);
    expect(out.schedules).toEqual({ updated: 2, skippedLocked: 2, errors: [] });
  });

  test("`applyToDraftSchedules: false` — ishchi rejalar umuman o'qilmaydi", async () => {
    mockLp(lpDoc());
    mockSchedules([{ _id: "ws1", status: "draft", courses: [course("k1", "I")] }]);
    const out = await updateLearningProcessMonthWeeks({
      id: LP_ID, scope: {}, counts: counts(NEXT), applyToDraftSchedules: false,
    });
    expect(WorkingScheduleModel.find).not.toHaveBeenCalled();
    expect(out.schedules.updated).toBe(0);
  });

  test("bitta ishchi reja taqsimoti mos kelmasa — boshqalari yoziladi, xabar errors[] da", async () => {
    mockLp(lpDoc());
    const odd = course("k2", "II");
    odd.months = odd.months.slice(0, 11);
    mockSchedules([
      { _id: "ws1", status: "draft", title: "I bosqich", courses: [course("k1", "I")] },
      { _id: "ws2", status: "draft", title: "II bosqich", courses: [odd] },
    ]);
    const out = await updateLearningProcessMonthWeeks({ id: LP_ID, scope: {}, counts: counts(NEXT) });
    expect(out.schedules.updated).toBe(1);
    expect(out.schedules.errors).toHaveLength(1);
    expect(out.schedules.errors[0]).toMatch(/^II bosqich: II kurs: oylar soni/);
  });
});

describe("Controller.updateMonthWeeks", () => {
  const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  test("200 + { message, data }", async () => {
    mockLp(lpDoc());
    mockSchedules([]);
    const res = createRes();
    const next = jest.fn();
    await Controller.updateMonthWeeks(
      { params: { id: LP_ID }, body: { counts: counts(NEXT), applyToDraftSchedules: true }, scope: {} },
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.updatedCourses).toBe(2);
  });

  test("invariant buzilsa — next(ErrorHandler 400), matn o'zbekcha", async () => {
    mockLp(lpDoc());
    const res = createRes();
    const next = jest.fn();
    await Controller.updateMonthWeeks(
      { params: { id: LP_ID }, body: { counts: counts(NEXT).slice(0, 11) }, scope: {} },
      res,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400, message: expect.stringMatching(/oylar soni mos emas/) });
  });
});
