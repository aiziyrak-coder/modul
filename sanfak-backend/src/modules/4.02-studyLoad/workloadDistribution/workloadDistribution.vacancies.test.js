jest.mock("./workloadDistribution.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = (scope = { department: "dept-1" }) => ({
  scope,
  user: { _id: "user-1" },
});

describe("GET /vacancies — getVacancies", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("birinchi $match bosqichida req.scope kalitlari bor (+ active: true)", async () => {
    const execMock = jest.fn().mockResolvedValue([]);
    WorkloadDistribution.aggregate = jest.fn().mockReturnValue({ exec: execMock });

    const req = createReq({ department: "dept-1" });
    await Controller.getVacancies(req, createRes(), jest.fn());

    expect(WorkloadDistribution.aggregate).toHaveBeenCalled();
    const [pipeline] = WorkloadDistribution.aggregate.mock.calls[0];
    const firstMatch = pipeline[0];

    expect(firstMatch).toEqual({
      $match: expect.objectContaining({
        department: "dept-1",
        active: true,
      }),
    });
  });

  test("teachers.isVacant filtri pipeline'da mavjud", async () => {
    const execMock = jest.fn().mockResolvedValue([]);
    WorkloadDistribution.aggregate = jest.fn().mockReturnValue({ exec: execMock });

    const req = createReq();
    await Controller.getVacancies(req, createRes(), jest.fn());

    const [pipeline] = WorkloadDistribution.aggregate.mock.calls[0];
    const vacantMatchStage = pipeline.find(
      (stage) => stage.$match && stage.$match["teachers.isVacant"] === true,
    );

    expect(vacantMatchStage).toBeDefined();
  });

  test("bo'sh natija → 200 + res.json([]), xato emas", async () => {
    const execMock = jest.fn().mockResolvedValue([]);
    WorkloadDistribution.aggregate = jest.fn().mockReturnValue({ exec: execMock });

    const res = createRes();
    const next = jest.fn();
    await Controller.getVacancies(createReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("aggregate xato bersa — next(ErrorHandler) chaqiriladi", async () => {
    const execMock = jest.fn().mockRejectedValue(new Error("db xatosi"));
    WorkloadDistribution.aggregate = jest.fn().mockReturnValue({ exec: execMock });

    const res = createRes();
    const next = jest.fn();
    await Controller.getVacancies(createReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("GET /vacancies — D-6 ta'til muddati", () => {
  beforeEach(() => jest.clearAllMocks());

  test("yozuvni bo'shatgan tasdiqlangan ariza (tur + muddat) `leave` sifatida qaytadi", async () => {
    const execMock = jest.fn().mockResolvedValue([]);
    WorkloadDistribution.aggregate = jest.fn().mockReturnValue({ exec: execMock });

    await Controller.getVacancies(createReq(), createRes(), jest.fn());

    const [pipeline] = WorkloadDistribution.aggregate.mock.calls[0];
    const leaveLookup = pipeline.find((s) => s.$lookup?.from === "teacherleaves");
    expect(leaveLookup).toBeDefined();
    expect(leaveLookup.$lookup.let).toEqual({ distId: "$_id", entryId: "$teachers._id" });
    const conds = leaveLookup.$lookup.pipeline[0].$match.$expr.$and;
    expect(conds).toEqual(
      expect.arrayContaining([
        { $eq: ["$distribution", "$$distId"] },
        { $eq: ["$teacherEntryId", "$$entryId"] },
        { $eq: ["$status", "approved"] },
      ]),
    );
    const project = pipeline.find((s) => s.$project)?.$project;
    expect(project.leave).toEqual({ $ifNull: [{ $arrayElemAt: ["$_leaveDocs", 0] }, null] });
  });
});
