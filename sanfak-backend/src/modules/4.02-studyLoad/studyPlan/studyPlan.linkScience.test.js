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
const ScienceModel = require("#references/science/science.model");
const Controller = require("./studyPlan.controller");

const DOC_ID = "cccccccccccccccccccccccc";
const SCI_ID = "dddddddddddddddddddddddd";
const DEPT_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const FACULTY_SCOPE = { learningProcess: { $in: ["lp1", "lp2"] } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockCatalog = (value) =>
  jest.spyOn(ScienceModel, "findById").mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(value) }),
  });

afterEach(() => jest.restoreAllMocks());

describe("linkStudyPlanScience (D-120 · B)", () => {
  test("valid — 200; science/department KATALOGDAN, filtr $elemMatch + scope", async () => {
    mockCatalog({ _id: SCI_ID, department: DEPT_ID });
    const spy = jest
      .spyOn(StudyPlanModel, "findOneAndUpdate")
      .mockResolvedValue({ _id: DOC_ID });
    const res = createRes();

    await Controller.linkStudyPlanScience(
      {
        params: { id: DOC_ID },
        body: { blockCode: "b1", scienceCode: "s1", scienceId: SCI_ID, department: "HACK" },
        scope: FACULTY_SCOPE,
      },
      res,
      jest.fn(),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: DOC_ID,
        ...FACULTY_SCOPE,
        blocks: { $elemMatch: { blockCode: "b1", "sciences.code": "s1" } },
      }),
      expect.anything(),
      expect.anything(),
    );

    const update = spy.mock.calls[0][1];
    expect(update.$set["blocks.$[block].sciences.$[science].science"]).toBe(SCI_ID);
    expect(update.$set["blocks.$[block].sciences.$[science].department"]).toBe(DEPT_ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("begona/xato scienceId — 404, hujjatga yozuv urinilmaydi", async () => {
    mockCatalog(null);
    const spy = jest.spyOn(StudyPlanModel, "findOneAndUpdate");
    const next = jest.fn();
    const res = createRes();

    await Controller.linkStudyPlanScience(
      {
        params: { id: DOC_ID },
        body: { blockCode: "b1", scienceCode: "s1", scienceId: SCI_ID },
        scope: FACULTY_SCOPE,
      },
      res,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("mos fan qatori yo'q — 404 not found (jim 200 emas)", async () => {
    mockCatalog({ _id: SCI_ID, department: DEPT_ID });
    jest.spyOn(StudyPlanModel, "findOneAndUpdate").mockResolvedValue(null);
    const res = createRes();

    await Controller.linkStudyPlanScience(
      {
        params: { id: DOC_ID },
        body: { blockCode: "b1", scienceCode: "s1", scienceId: SCI_ID },
        scope: FACULTY_SCOPE,
      },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
