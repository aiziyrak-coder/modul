jest.mock("#modules/4.02-studyLoad/_pdf/workingPlan.pdf", () => ({
  generateWorkingPlanPdf: jest.fn(),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const { updateWorkingScheduleMonthWeeks } = require("./monthWeeks.service");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");

const MONTHS = [
  "Sentabr", "Oktabr", "Noyabr", "Dekabr", "Yanvar", "Fevral",
  "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust",
];
const LIVE = [5, 4, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const NEXT = [4, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4];
const counts = (arr) => MONTHS.map((month, i) => ({ month, count: arr[i] }));

const course = () => {
  const months = [];
  let n = 1;
  MONTHS.forEach((month, i) => {
    const weeks = [];
    for (let k = 0; k < LIVE[i]; k++) weeks.push({ week: n++, key: " " });
    months.push({ month, weeks });
  });
  return { _id: "k1", course: "III", months, weeks: {} };
};

const mockWs = (doc) =>
  jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(doc) }),
  });

beforeEach(() => {
  jest.restoreAllMocks();
  jest.spyOn(WorkingScheduleModel, "updateOne").mockResolvedValue({ acknowledged: true });
});

describe("updateWorkingScheduleMonthWeeks", () => {
  test("draft — months yoziladi (kurs _id bo'yicha), javob taqsimot", async () => {
    mockWs({ _id: "ws1", status: "draft", courses: [course()] });
    const out = await updateWorkingScheduleMonthWeeks({
      id: "ws1",
      filter: { direction: { $in: ["d1"] } },
      counts: counts(NEXT),
    });
    expect(WorkingScheduleModel.findOne).toHaveBeenCalledWith({ _id: "ws1", direction: { $in: ["d1"] } });
    const [, update, opts] = WorkingScheduleModel.updateOne.mock.calls[0];
    expect(Object.keys(update.$set)).toEqual(["courses.$[c0].months"]);
    expect(opts.arrayFilters).toEqual([{ "c0._id": "k1" }]);
    expect(out).toEqual({ months: counts(NEXT), updatedCourses: 1 });
  });

  test.each(["in_review", "approved"])("%s — 400 qulf, yozuv yo'q", async (status) => {
    mockWs({ _id: "ws1", status, courses: [course()] });
    await expect(
      updateWorkingScheduleMonthWeeks({ id: "ws1", filter: {}, counts: counts(NEXT) }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(new RegExp(status)) });
    expect(WorkingScheduleModel.updateOne).not.toHaveBeenCalled();
  });

  test("rejected — tahrirlanadi (qulf faqat in_review/approved)", async () => {
    mockWs({ _id: "ws1", status: "rejected", courses: [course()] });
    await expect(
      updateWorkingScheduleMonthWeeks({ id: "ws1", filter: {}, counts: counts(NEXT) }),
    ).resolves.toMatchObject({ updatedCourses: 1 });
  });

  test("topilmadi / ko'rinish tashqarisi — 404", async () => {
    mockWs(null);
    await expect(
      updateWorkingScheduleMonthWeeks({ id: "ws1", filter: {}, counts: counts(NEXT) }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("Controller.updateMonthWeeks (ishchi reja)", () => {
  const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const req = (role, body) => ({
    params: { id: "ws1" },
    body,
    scope: {},
    user: { role: { title: role } },
  });

  test("O'UB — 200", async () => {
    mockWs({ _id: "ws1", status: "draft", courses: [course()] });
    const res = createRes();
    const next = jest.fn();
    await Controller.updateMonthWeeks(req(ROLES.OQUV_USLUBIY_BOSHQARMA, { counts: counts(NEXT) }), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].data.updatedCourses).toBe(1);
  });

  test("dekan — 403 (faqat O'UB/super admin), hujjat o'qilmaydi ham", async () => {
    const spy = mockWs({ _id: "ws1", status: "draft", courses: [course()] });
    const res = createRes();
    const next = jest.fn();
    await Controller.updateMonthWeeks(req(ROLES.DEKAN, { counts: counts(NEXT) }), res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(spy).not.toHaveBeenCalled();
  });

  test("yig'indi 52 emas — next(400) o'zbekcha matn", async () => {
    mockWs({ _id: "ws1", status: "draft", courses: [course()] });
    const res = createRes();
    const next = jest.fn();
    await Controller.updateMonthWeeks(
      req(ROLES.SUPER_ADMIN, { counts: counts([5, 5, 5, 4, 5, 4, 5, 4, 4, 4, 4, 4]) }),
      res,
      next,
    );
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400, message: expect.stringMatching(/hozir 53/) });
  });
});
