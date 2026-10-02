const WorkloadModel = require("./workload.model");
const Controller = require("./workload.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("workload.controller — deleteWorkload (status gate fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test.each(["draft", "new", "rejected"])(
    "status='%s' — o'chirish RUXSAT ETILADI (200)",
    async (status) => {
      const doc = {
        _id: "wl1",
        status,
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(WorkloadModel, "findOne").mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteWorkload(
        { params: { id: "wl1" }, scope: {} },
        res,
        jest.fn(),
      );

      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    },
  );

  test.each(["in_review", "approved"])(
    "status='%s' — o'chirish TAQIQLANADI (400)",
    async (status) => {
      const doc = {
        _id: "wl1",
        status,
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(WorkloadModel, "findOne").mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteWorkload(
        { params: { id: "wl1" }, scope: {} },
        res,
        jest.fn(),
      );

      expect(doc.deleteOne).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    },
  );

  test("hujjat topilmasa — 404", async () => {
    jest.spyOn(WorkloadModel, "findOne").mockResolvedValue(null);
    const res = createRes();

    await Controller.deleteWorkload(
      { params: { id: "missing" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("scope tashqarisidagi hujjat — findOne req.scope bilan chaqiriladi (404 yo'l)", async () => {
    jest.spyOn(WorkloadModel, "findOne").mockResolvedValue(null);
    const res = createRes();
    const foreignScope = { department: { $in: ["own-dept"] } };

    await Controller.deleteWorkload(
      { params: { id: "foreign-wl" }, scope: foreignScope },
      res,
      jest.fn(),
    );

    expect(WorkloadModel.findOne).toHaveBeenCalledWith({
      _id: "foreign-wl",
      ...foreignScope,
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
