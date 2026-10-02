jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");

const KAFEDRA_MUDIRI_USER = { role: { title: ROLES.KAFEDRA_MUDIRI } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDoc = (status) => ({
  _id: "dist1",
  status,
  deleteOne: jest.fn().mockResolvedValue(undefined),
});

describe("workloadDistribution.controller — delete (status darvozasi)", () => {
  afterEach(() => jest.resetAllMocks());

  test.each(["in_review", "approved"])(
    "status='%s' — o'chirish TAQIQLANADI (400) va hujjat saqlanadi",
    async (status) => {
      const doc = makeDoc(status);
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
      WorkloadDistribution.findOneAndDelete = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.deleteWorkloadDistribution(
        { params: { id: "dist1" }, scope: {}, user: KAFEDRA_MUDIRI_USER },
        res,
        next,
      );

      expect(WorkloadDistribution.findOneAndDelete).not.toHaveBeenCalled();
      expect(doc.deleteOne).not.toHaveBeenCalled();

      const via400 = res.status.mock.calls.some((c) => c[0] === 400);
      const viaNext = next.mock.calls.some((c) => c[0]?.statusCode === 400);
      expect(via400 || viaNext).toBe(true);
    },
  );

  test.each(["draft", "new", "rejected"])(
    "status='%s' — o'chirish RUXSAT ETILADI (200)",
    async (status) => {
      const doc = makeDoc(status);
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
      WorkloadDistribution.findOneAndDelete = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteWorkloadDistribution(
        { params: { id: "dist1" }, scope: {}, user: KAFEDRA_MUDIRI_USER },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(200);
    },
  );

  test("status='superseded' — o'chirish TAQIQLANADI (409, reason: superseded)", async () => {
    const doc = makeDoc("superseded");
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.deleteWorkloadDistribution(
      { params: { id: "dist1" }, scope: {}, user: KAFEDRA_MUDIRI_USER },
      res,
      next,
    );

    expect(doc.deleteOne).not.toHaveBeenCalled();
    expect(next.mock.calls[0][0].statusCode).toBe(409);
    expect(next.mock.calls[0][0].meta).toEqual({ reason: "superseded" });
  });

  test("hujjat topilmasa — 404", async () => {
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndDelete = jest.fn().mockResolvedValue(null);
    const res = createRes();

    await Controller.deleteWorkloadDistribution(
      { params: { id: "missing" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("scope tashqarisidagi hujjat — qidiruv req.scope bilan chaqiriladi", async () => {
    WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
    WorkloadDistribution.findOneAndDelete = jest.fn().mockResolvedValue(null);
    const res = createRes();
    const foreignScope = { department: { $in: ["own-dept"] } };

    await Controller.deleteWorkloadDistribution(
      {
        params: { id: "foreign-dist" },
        scope: foreignScope,
        user: KAFEDRA_MUDIRI_USER,
      },
      res,
      jest.fn(),
    );

    expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
      _id: "foreign-dist",
      ...foreignScope,
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
