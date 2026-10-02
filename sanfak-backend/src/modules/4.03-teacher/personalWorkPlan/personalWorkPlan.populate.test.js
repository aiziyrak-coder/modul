jest.mock("./personalWorkPlan.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const Controller = require("./personalWorkPlan.controller");

const DOC_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createChain = (resolvedValue) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedValue);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("populate('academicYear', 'title') — F-2", () => {
  test("findAllWorkPlans — academicYear populate qilinadi", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);

    await Controller.findAllWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });

  test("findOneWorkPlan — academicYear populate qilinadi", async () => {
    const chain = createChain({ _id: DOC_ID });
    PersonalWorkPlanModel.findOne = jest.fn().mockReturnValue(chain);

    await Controller.findOneWorkPlan(
      { params: { id: DOC_ID }, scope: {} },
      createRes(),
      jest.fn(),
    );

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });

  test("paginateWorkPlans — populate ro'yxatida academicYear bor", async () => {
    PersonalWorkPlanModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const options = PersonalWorkPlanModel.paginate.mock.calls[0][1];
    const yearPopulate = options.populate.find((p) => p.path === "academicYear");
    expect(yearPopulate).toEqual({ path: "academicYear", select: "title" });
  });

  test("getMonitoring — academicYear populate qilinadi", async () => {
    const chain = createChain([]);
    PersonalWorkPlanModel.find = jest.fn().mockReturnValue(chain);

    await Controller.getMonitoring({ query: {}, scope: {} }, createRes(), jest.fn());

    expect(chain.populate).toHaveBeenCalledWith("academicYear", "title");
  });
});

describe("paginateWorkPlans — F-4: `effectiveStatus` virtual jimgina yo'qolmasin", () => {
  test("`leanWithVirtuals: true` bilan chaqiriladi", async () => {
    PersonalWorkPlanModel.paginate = jest
      .fn()
      .mockResolvedValue({ docs: [], totalDocs: 0 });

    await Controller.paginateWorkPlans(
      { query: {}, scope: {} },
      createRes(),
      jest.fn(),
    );

    const options = PersonalWorkPlanModel.paginate.mock.calls[0][1];
    expect(options.lean).toBe(true);
    expect(options.leanWithVirtuals).toBe(true);
  });
});
