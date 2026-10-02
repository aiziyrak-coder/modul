jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createChain = (resolved) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolved);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ro'yxat projection'i — `createdAt` saqlanadi", () => {
  test("findAllWorkPlans `createdAt` ni proyeksiyadan CHIQARMAYDI", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const [, projection] = PersonalWorkPlanModel.find.mock.calls[0];
    expect(projection).not.toHaveProperty("createdAt");
  });

  test("findAllWorkPlans `academicYear` ni populate qiladi (F-2 qo'riqchisi)", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });

  test("paginateWorkPlans `select` ida `-createdAt` YO'Q", async () => {
    PersonalWorkPlanModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const [, options] = PersonalWorkPlanModel.paginate.mock.calls[0];
    expect(options.select).not.toMatch(/-createdAt/);
  });
});
