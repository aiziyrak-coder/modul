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
jest.mock("./studyPlan.derivationGuard");

const StudyPlanModel = require("./studyPlan.model");
const {
  countDerivedWorkingPlans,
} = require("./studyPlan.derivationGuard");
const Controller = require("./studyPlan.controller");

const DOC_ID = "cccccccccccccccccccccccc";

const FACULTY_SCOPE = { learningProcess: { $in: ["lp1", "lp2"] } };
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => jest.restoreAllMocks());

describe("studyPlan — yozuv route'lari scope bilan (F4, S-3 fix)", () => {
  describe("updateStudyPlan", () => {
    test("scope ichidagi hujjat — 200, findOneAndUpdate filtrida req.scope bor", async () => {
      const spy = jest
        .spyOn(StudyPlanModel, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateStudyPlan(
        {
          params: { id: DOC_ID },
          body: { blockCode: "b1", scienceCode: "s1", title: "Yangi" },
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
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("filtr `$elemMatch` bilan quriladi — mustaqil dot-notation shartlari qaytmaydi", async () => {
      const spy = jest
        .spyOn(StudyPlanModel, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });

      await Controller.updateStudyPlan(
        {
          params: { id: DOC_ID },
          body: { blockCode: "b1", scienceCode: "s1", title: "Yangi" },
          scope: GLOBAL_SCOPE,
        },
        createRes(),
        jest.fn(),
      );

      const filter = spy.mock.calls[0][0];
      expect(filter.blocks).toEqual({
        $elemMatch: { blockCode: "b1", "sciences.code": "s1" },
      });
      expect(filter["blocks.blockCode"]).toBeUndefined();
      expect(filter["blocks.sciences.code"]).toBeUndefined();
    });

    test("scope tashqarisidagi hujjat — findOneAndUpdate null qaytaradi → 404 (regression guard)", async () => {
      jest.spyOn(StudyPlanModel, "findOneAndUpdate").mockResolvedValue(null);
      const res = createRes();

      await Controller.updateStudyPlan(
        {
          params: { id: DOC_ID },
          body: { blockCode: "b1", scienceCode: "s1" },
          scope: { learningProcess: { $in: [] } },
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("global scope — cheklovsiz filtr bilan chaqiriladi (zanjir buzilmagan)", async () => {
      const spy = jest
        .spyOn(StudyPlanModel, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateStudyPlan(
        {
          params: { id: DOC_ID },
          body: { blockCode: "b1", scienceCode: "s1" },
          scope: GLOBAL_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ _id: DOC_ID }),
        expect.anything(),
        expect.anything(),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("deleteStudyPlan", () => {
    test("scope ichidagi, hosila yo'q hujjat — o'chiriladi (200), findOne req.scope bilan", async () => {
      const doc = {
        _id: DOC_ID,
        status: "new",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      const spy = jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(doc);
      countDerivedWorkingPlans.mockResolvedValue(0);
      const res = createRes();

      await Controller.deleteStudyPlan(
        { params: { id: DOC_ID }, scope: FACULTY_SCOPE },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...FACULTY_SCOPE });
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      jest.spyOn(StudyPlanModel, "findOne").mockResolvedValue(null);
      const res = createRes();

      await Controller.deleteStudyPlan(
        { params: { id: DOC_ID }, scope: { learningProcess: { $in: [] } } },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
