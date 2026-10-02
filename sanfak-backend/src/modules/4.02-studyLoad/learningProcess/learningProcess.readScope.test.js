const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const Controller = require("./learningProcess.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const chainQuery = (resolvedDoc) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return q;
};

describe("learningProcess.controller — findOne (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200), filtrda req.scope (direction) bor", async () => {
    const doc = {
      _id: "lp1",
      toObject: () => ({ _id: "lp1" }),
    };
    const spy = jest.spyOn(LearningProcess, "findOne").mockReturnValue(chainQuery(doc));
    jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
      select: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    });
    const res = createRes();
    const req = { params: { id: "lp1" }, scope: { direction: { $in: ["d1"] } } };

    await Controller.findOne(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "lp1", direction: { $in: ["d1"] } }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi _id → 404 (next chaqiriladi)", async () => {
    jest.spyOn(LearningProcess, "findOne").mockReturnValue(chainQuery(null));
    const next = jest.fn();
    const req = { params: { id: "foreign" }, scope: { direction: { $in: [] } } };

    await Controller.findOne(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(404);
  });
});
