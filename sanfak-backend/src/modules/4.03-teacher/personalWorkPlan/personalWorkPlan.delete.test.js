jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockStatus = (status) => {
  PersonalWorkPlanModel.findOne = jest.fn().mockReturnValue({
    lean: () => Promise.resolve(status ? { _id: PLAN_ID, status } : null),
  });
};

const callDelete = async () => {
  const res = createRes();
  const next = jest.fn();
  await Controller.deleteWorkPlan({ params: { id: PLAN_ID }, scope: {} }, res, next);
  return { res, next };
};

beforeEach(() => {
  jest.clearAllMocks();
  PersonalWorkPlanModel.findOneAndDelete = jest
    .fn()
    .mockResolvedValue({ _id: PLAN_ID });
});

describe("deleteWorkPlan — status qulfi", () => {
  test.each(["draft", "rejected"])("%s — o'chiriladi", async (status) => {
    mockStatus(status);
    const { res } = await callDelete();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(PersonalWorkPlanModel.findOneAndDelete).toHaveBeenCalled();
  });

  test.each(["submitted", "approved", "completed"])(
    "🔴 %s — O'CHIRILMAYDI (400) va DB'dan o'chirish CHAQIRILMAYDI",
    async (status) => {
      mockStatus(status);
      const { res } = await callDelete();

      expect(res.status).toHaveBeenCalledWith(400);
      expect(PersonalWorkPlanModel.findOneAndDelete).not.toHaveBeenCalled();
    },
  );

  test("reja topilmasa — 404, o'chirish chaqirilmaydi", async () => {
    mockStatus(null);
    const { res } = await callDelete();

    expect(res.status).toHaveBeenCalledWith(404);
    expect(PersonalWorkPlanModel.findOneAndDelete).not.toHaveBeenCalled();
  });
});
