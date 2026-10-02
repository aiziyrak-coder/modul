jest.mock("#modules/4.02-studyLoad/_pdf/studyPlan.pdf", () => ({
  generateStudyPlanPdf: jest.fn((req, res) => res.status(200).json({ pdf: true })),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  enrichMetaWithSlugRefs: jest.fn(),
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_services/semesterBreakdown", () => ({
  buildSemesterTable: jest.fn().mockReturnValue({ fans: [] }),
  buildBlocksTable: jest.fn().mockReturnValue({ blocks: [] }),
}));

const StudyPlanModel = require("./studyPlan.model");
const Controller = require("./studyPlan.controller");
const { generateStudyPlanPdf } = require("#modules/4.02-studyLoad/_pdf/studyPlan.pdf");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const leanQuery = (resolvedDoc) => {
  const q = {};
  q.lean = jest.fn().mockReturnValue(q);
  q.exec = jest.fn().mockResolvedValue(resolvedDoc);
  q.then = (resolve) => Promise.resolve(resolvedDoc).then(resolve);
  return q;
};

const populateLeanQuery = (resolvedDoc) => {
  const q = {};
  q.populate = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(resolvedDoc);
  return q;
};

describe("studyPlan.controller — findOneStudyPlan (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("scope doirasidagi _id → topiladi (200), filtrda req.scope kalitlari bor", async () => {
    const doc = { _id: "sp1" };
    const spy = jest
      .spyOn(StudyPlanModel, "findOne")
      .mockReturnValue(leanQuery(doc));
    const res = createRes();
    const req = {
      params: { id: "sp1" },
      scope: { learningProcess: { $in: ["lp1"] } },
    };

    await Controller.findOneStudyPlan(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "sp1", learningProcess: { $in: ["lp1"] } }),
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("doira tashqarisidagi _id → 404", async () => {
    jest.spyOn(StudyPlanModel, "findOne").mockReturnValue(leanQuery(null));
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { learningProcess: { $in: [] } } };

    await Controller.findOneStudyPlan(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("studyPlan.controller — getBySemester / getByBlocks (NB-1 scope fix)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("getBySemester — doira tashqarisida → 404 (next chaqiriladi)", async () => {
    jest.spyOn(StudyPlanModel, "findOne").mockReturnValue(populateLeanQuery(null));
    const next = jest.fn();
    const req = {
      params: { id: "foreign", n: "1" },
      scope: { learningProcess: { $in: [] } },
    };

    await Controller.getBySemester(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err?.statusCode).toBe(404);
  });

  test("getByBlocks — doira ichida → filtrda req.scope bor, natija qaytadi", async () => {
    const doc = { _id: "sp1", file: "f.pdf" };
    const spy = jest
      .spyOn(StudyPlanModel, "findOne")
      .mockReturnValue(populateLeanQuery(doc));
    const res = createRes();
    const req = { params: { id: "sp1" }, scope: { learningProcess: { $in: ["lp1"] } } };

    await Controller.getByBlocks(req, res, jest.fn());

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "sp1", learningProcess: { $in: ["lp1"] } }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("studyPlan.controller — generatePdf (NB-1 scope fix, exists-guard)", () => {
  afterEach(() => jest.restoreAllMocks());

  test("doira tashqarisida — exists false → 404, generator CHAQIRILMAYDI", async () => {
    jest.spyOn(StudyPlanModel, "exists").mockResolvedValue(null);
    const res = createRes();
    const req = { params: { id: "foreign" }, scope: { learningProcess: { $in: [] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(generateStudyPlanPdf).not.toHaveBeenCalled();
  });

  test("doira ichida — exists true → generator chaqiriladi", async () => {
    jest.spyOn(StudyPlanModel, "exists").mockResolvedValue(true);
    const res = createRes();
    const req = { params: { id: "sp1" }, scope: { learningProcess: { $in: ["lp1"] } } };

    await Controller.generatePdf(req, res, jest.fn());

    expect(generateStudyPlanPdf).toHaveBeenCalledWith(req, res, expect.any(Function));
  });
});
