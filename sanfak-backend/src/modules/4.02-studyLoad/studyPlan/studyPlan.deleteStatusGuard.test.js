jest.mock("./studyPlan.derivationGuard");

const StudyPlanModel = require("./studyPlan.model");
const {
  countDerivedWorkingPlans,
} = require("./studyPlan.derivationGuard");
const Controller = require("./studyPlan.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("studyPlan.controller — deleteStudyPlan (derivation gate)", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test("hosila YO'Q (status='new') — o'chirish RUXSAT ETILADI (200, doc.deleteOne chaqiriladi)", async () => {
    const doc = {
      _id: "sp1",
      status: "new",
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(doc);
    countDerivedWorkingPlans.mockResolvedValue(0);
    const res = createRes();

    await Controller.deleteStudyPlan(
      { params: { id: "sp1" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(countDerivedWorkingPlans).toHaveBeenCalledWith("sp1");
    expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("hosila BOR (status='new' bo'lsa ham!) — o'chirish TAQIQLANADI (409), doc.deleteOne CHAQIRILMAYDI", async () => {
    const doc = {
      _id: "sp-live-hole",
      status: "new",
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(doc);
    countDerivedWorkingPlans.mockResolvedValue(6);
    const res = createRes();

    await Controller.deleteStudyPlan(
      { params: { id: "sp-live-hole" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(doc.deleteOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("6") }),
    );
  });

  test("hosila YO'Q (status='created' bo'lsa ham) — o'chirish endi RUXSAT ETILADI (200)", async () => {
    const doc = {
      _id: "sp-stale-created",
      status: "created",
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(doc);
    countDerivedWorkingPlans.mockResolvedValue(0);
    const res = createRes();

    await Controller.deleteStudyPlan(
      { params: { id: "sp-stale-created" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(doc.deleteOne).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("hujjat topilmasa — 404 (derivation tekshiruvigacha yetib bormaydi)", async () => {
    jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(null);
    const res = createRes();

    await Controller.deleteStudyPlan(
      { params: { id: "missing" }, scope: {} },
      res,
      jest.fn(),
    );

    expect(countDerivedWorkingPlans).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("begona fakultet (scope tashqarisidagi) hujjat — findOne req.scope bilan chaqiriladi, 404", async () => {
    jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(null);
    const res = createRes();
    const foreignScope = { learningProcess: { $in: ["own-lp"] } };

    await Controller.deleteStudyPlan(
      { params: { id: "foreign-sp" }, scope: foreignScope },
      res,
      jest.fn(),
    );

    expect(StudyPlanModel.findOne).toHaveBeenCalledWith({
      _id: "foreign-sp",
      ...foreignScope,
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
