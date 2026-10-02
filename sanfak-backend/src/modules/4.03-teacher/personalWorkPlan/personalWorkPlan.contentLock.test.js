jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");

const ITEM_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makePlan = (status) => {
  const item = { _id: ITEM_ID, title: "bor", verification: {} };
  const arr = [item];
  arr.id = jest.fn().mockReturnValue(item);
  arr.pull = jest.fn();
  return { status, researchWork: arr, save: jest.fn().mockResolvedValue(true) };
};

const reqFor = (body = {}) => ({
  params: { id: "p1", activityId: ITEM_ID },
  body: { section: "researchWork", ...body },
  scope: {},
  user: { _id: "u1" },
});

beforeEach(() => jest.clearAllMocks());

describe.each(["submitted", "approved", "completed"])(
  "`%s` holatidagi reja mazmuni QULFLANGAN",
  (status) => {
    beforeEach(() => {
      PersonalWorkPlanModel.findOne = jest
        .fn()
        .mockResolvedValue(makePlan(status));
    });

    test("addActivity → 400", async () => {
      const res = createRes();
      await Controller.addActivity(
        reqFor({ item: { title: "yangi" } }),
        res,
        jest.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("updateActivity → 400", async () => {
      const res = createRes();
      await Controller.updateActivity(reqFor({ title: "o'zgardi" }), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("deleteActivity → 400", async () => {
      const res = createRes();
      await Controller.deleteActivity(reqFor(), res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  },
);

describe.each(["draft", "rejected"])(
  "`%s` holatida mazmun tahrirlanadi",
  (status) => {
    beforeEach(() => {
      PersonalWorkPlanModel.findOne = jest
        .fn()
        .mockResolvedValue(makePlan(status));
    });

    test("addActivity → 200", async () => {
      const res = createRes();
      await Controller.addActivity(
        reqFor({ item: { title: "yangi" } }),
        res,
        jest.fn(),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  },
);

describe("completeActivity — tasdiqlangan rejada ATAYIN ochiq (TZ 4.3.4)", () => {
  test("`approved` holatda ham 200 qaytaradi", async () => {
    PersonalWorkPlanModel.findOne = jest
      .fn()
      .mockResolvedValue(makePlan("approved"));
    const res = createRes();

    await Controller.completeActivity(
      reqFor({ actualCount: 2 }),
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
