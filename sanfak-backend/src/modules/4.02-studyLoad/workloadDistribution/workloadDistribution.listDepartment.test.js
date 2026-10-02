jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const req = () => ({ query: {}, scope: {}, user: { _id: "u1", role: { title: "kafedra_mudiri" } } });

beforeEach(() => jest.clearAllMocks());

describe("workloadDistribution — ro'yxatda kafedra (P-29)", () => {
  test("paginate: `department` select'dan chiqarilmaydi va `title` bilan populate qilinadi", async () => {
    WorkloadDistribution.paginate = jest.fn().mockResolvedValue({ docs: [] });
    const spy = WorkloadDistribution.paginate;
    await Controller.paginateWorkloadDistributions(req(), createRes(), jest.fn());

    const options = spy.mock.calls[0][1];
    expect(options.select).not.toMatch(/-department\b/);
    expect(options.populate).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "department", select: "title" })]),
    );
  });

  test("findAll: `department` populate qilinadi", async () => {
    const populate = jest.fn().mockReturnThis();
    const select = jest.fn().mockReturnThis();
    WorkloadDistribution.find = jest.fn().mockReturnValue({
      select,
      populate,
      exec: jest.fn().mockResolvedValue([]),
    });
    await Controller.findAllWorkloadDistributions(req(), createRes(), jest.fn());

    expect(select.mock.calls[0][0]).not.toMatch(/-department\b/);
    expect(populate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "department", select: "title" }),
    );
  });
});
