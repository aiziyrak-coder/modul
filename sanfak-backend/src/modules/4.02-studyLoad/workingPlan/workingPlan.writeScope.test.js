const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("./workingPlan.model");
const Controller = require("./workingPlan.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const putReq = (id, scope) => ({
  params: { id },
  body: { courseId: "507f1f77bcf86cd799439011", total: 42 },
  scope,
});

describe("updateWorkingPlan — P-10 yozuv scope'i (WorkingScheduleModel)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisidagi hujjat → 404, YOZUV BAJARILMAYDI", async () => {
    const existsSpy = jest
      .spyOn(WorkingScheduleModel, "exists")
      .mockResolvedValue(null);
    const updateSpy = jest.spyOn(WorkingScheduleModel, "findByIdAndUpdate");
    const next = jest.fn();

    await Controller.updateWorkingPlan(
      putReq("foreign", { direction: { $in: [] } }),
      createRes(),
      next,
    );

    expect(existsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "foreign", direction: { $in: [] } }),
    );
    expect(updateSpy).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  test("doira ichidagi hujjat → yozuv bajariladi (200)", async () => {
    jest.spyOn(WorkingScheduleModel, "exists").mockResolvedValue(true);
    jest
      .spyOn(WorkingScheduleModel, "findByIdAndUpdate")
      .mockResolvedValue({ _id: "ws1" });
    jest.spyOn(WorkingScheduleModel, "findById").mockResolvedValue({ _id: "ws1" });
    const res = createRes();

    await Controller.updateWorkingPlan(
      putReq("ws1", { direction: { $in: ["d1"] } }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("REGRESSION-GUARD: scope kaliti `direction` bo'lsin (`workingSchedule` EMAS)", async () => {
    const existsSpy = jest
      .spyOn(WorkingScheduleModel, "exists")
      .mockResolvedValue(true);
    jest
      .spyOn(WorkingScheduleModel, "findByIdAndUpdate")
      .mockResolvedValue({ _id: "ws1" });
    jest.spyOn(WorkingScheduleModel, "findById").mockResolvedValue({ _id: "ws1" });

    await Controller.updateWorkingPlan(
      putReq("ws1", { direction: { $in: ["d1"] } }),
      createRes(),
      jest.fn(),
    );

    const filter = existsSpy.mock.calls[0][0];
    expect(filter).toHaveProperty("direction");
    expect(filter).not.toHaveProperty("workingSchedule");
  });

  test("global scope (bo'sh `{}`) — yozuvni bloklamaydi", async () => {
    jest.spyOn(WorkingScheduleModel, "exists").mockResolvedValue(true);
    jest
      .spyOn(WorkingScheduleModel, "findByIdAndUpdate")
      .mockResolvedValue({ _id: "ws1" });
    jest.spyOn(WorkingScheduleModel, "findById").mockResolvedValue({ _id: "ws1" });
    const res = createRes();

    await Controller.updateWorkingPlan(putReq("ws1", {}), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("deleteWorkingPlan — P-10 yozuv scope'i (WorkingPlanModel)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisidagi hujjat → 404, o'chirilmaydi", async () => {
    const spy = jest
      .spyOn(WorkingPlanModel, "findOneAndDelete")
      .mockResolvedValue(null);
    const res = createRes();

    await Controller.deleteWorkingPlan(
      { params: { id: "foreign" }, scope: { workingSchedule: { $in: [] } } },
      res,
      jest.fn(),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: "foreign",
        workingSchedule: { $in: [] },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("doira ichidagi hujjat → o'chiriladi (200)", async () => {
    jest
      .spyOn(WorkingPlanModel, "findOneAndDelete")
      .mockResolvedValue({ _id: "wp1" });
    const res = createRes();

    await Controller.deleteWorkingPlan(
      { params: { id: "wp1" }, scope: { workingSchedule: { $in: ["ws1"] } } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("REGRESSION-GUARD: `findByIdAndDelete` ga qaytilmasin (scope'ni e'tiborsiz qoldiradi)", async () => {
    const byIdSpy = jest.spyOn(WorkingPlanModel, "findByIdAndDelete");
    jest
      .spyOn(WorkingPlanModel, "findOneAndDelete")
      .mockResolvedValue({ _id: "wp1" });

    await Controller.deleteWorkingPlan(
      { params: { id: "wp1" }, scope: { workingSchedule: { $in: ["ws1"] } } },
      createRes(),
      jest.fn(),
    );

    expect(byIdSpy).not.toHaveBeenCalled();
  });

  test("REGRESSION-GUARD: scope kaliti `workingSchedule` bo'lsin (`direction` EMAS)", async () => {
    const spy = jest
      .spyOn(WorkingPlanModel, "findOneAndDelete")
      .mockResolvedValue({ _id: "wp1" });

    await Controller.deleteWorkingPlan(
      { params: { id: "wp1" }, scope: { workingSchedule: { $in: ["ws1"] } } },
      createRes(),
      jest.fn(),
    );

    const filter = spy.mock.calls[0][0];
    expect(filter).toHaveProperty("workingSchedule");
    expect(filter).not.toHaveProperty("direction");
  });
});
