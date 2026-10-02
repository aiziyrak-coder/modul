const LearningProcess = require("./learningProcess.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const Controller = require("./learningProcess.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const COURSE_ID = "691111111111111111111111";
const KEY_ID = "692222222222222222222222";
const USLUBI_ID = "111111111111111111111111";

const FACULTY_SCOPE = { direction: { $in: ["d1", "d2"] } };
const OUT_OF_SCOPE = { direction: { $in: [] } };
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => jest.restoreAllMocks());

describe("learningProcess — yozuv route'lari scope bilan (F4, S-3 fix)", () => {
  describe("fullUpdate", () => {
    test("scope ichidagi hujjat — birinchi findOne filtrida req.scope bor", async () => {
      const spy = jest
        .spyOn(LearningProcess, "findOne")
        .mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: DOC_ID, status: "new" }) });
      jest.spyOn(DirectionModel, "findById").mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      const next = jest.fn();

      await Controller.fullUpdate(
        { params: { id: DOC_ID }, body: { direction: "d1" }, scope: FACULTY_SCOPE, user: {} },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ _id: DOC_ID, status: "new", ...FACULTY_SCOPE }),
      );
    });

    test("scope tashqarisidagi hujjat — findOne null qaytaradi → 400 (pre-existing xulq, regression guard)", async () => {
      jest
        .spyOn(LearningProcess, "findOne")
        .mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const next = jest.fn();

      await Controller.fullUpdate(
        { params: { id: DOC_ID }, body: {}, scope: OUT_OF_SCOPE, user: {} },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe("update", () => {
    test("scope ichidagi hujjat — davom etadi (exists filtrida req.scope bor)", async () => {
      const existsSpy = jest.spyOn(LearningProcess, "exists").mockResolvedValue(true);
      jest.spyOn(LearningProcess, "findByIdAndUpdate").mockResolvedValue({ _id: DOC_ID });
      jest.spyOn(LearningProcess, "findById").mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.update(
        {
          params: { id: DOC_ID },
          body: { courseId: COURSE_ID, total: 5 },
          scope: FACULTY_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(existsSpy).toHaveBeenCalledWith({ _id: DOC_ID, ...FACULTY_SCOPE });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — exists false → 404 (regression guard)", async () => {
      jest.spyOn(LearningProcess, "exists").mockResolvedValue(false);
      const next = jest.fn();

      await Controller.update(
        { params: { id: DOC_ID }, body: { courseId: COURSE_ID }, scope: OUT_OF_SCOPE },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("updateSpecialParts", () => {
    test("scope ichidagi hujjat — findOneAndUpdate req.scope bilan chaqiriladi", async () => {
      const spy = jest
        .spyOn(LearningProcess, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateSpecialParts(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: KEY_ID, week: 2 }] } },
          scope: FACULTY_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith(
        { _id: DOC_ID, ...FACULTY_SCOPE },
        expect.anything(),
        expect.anything(),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      jest.spyOn(LearningProcess, "findOneAndUpdate").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.updateSpecialParts(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: KEY_ID, week: 2 }] } },
          scope: OUT_OF_SCOPE,
        },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("updateSpecialPartsTitle", () => {
    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      jest.spyOn(LearningProcess, "findOneAndUpdate").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.updateSpecialPartsTitle(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { title: "Yangi" } },
          scope: OUT_OF_SCOPE,
        },
        createRes(),
        next,
      );

      expect(LearningProcess.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: DOC_ID, ...OUT_OF_SCOPE },
        expect.anything(),
        expect.anything(),
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("updateStudyPlanScince", () => {
    test("StudyPlan mavjud, lekin ota hujjat scope tashqarisida — 404", async () => {
      jest
        .spyOn(StudyPlanModel, "findById")
        .mockReturnValue({ lean: jest.fn().mockResolvedValue({ learningProcess: "lp-foreign" }) });
      const existsSpy = jest.spyOn(LearningProcess, "exists").mockResolvedValue(null);
      const res = createRes();

      await Controller.updateStudyPlanScince(
        {
          params: { id: "sp1" },
          body: { parentId: "b1", _id: "sc1" },
          scope: OUT_OF_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(existsSpy).toHaveBeenCalledWith({ _id: "lp-foreign", ...OUT_OF_SCOPE });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("StudyPlan o'zi topilmasa — 404 (LearningProcess.exists chaqirilmaydi)", async () => {
      jest.spyOn(StudyPlanModel, "findById").mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const existsSpy = jest.spyOn(LearningProcess, "exists");
      const res = createRes();

      await Controller.updateStudyPlanScince(
        { params: { id: "missing" }, body: {}, scope: FACULTY_SCOPE },
        res,
        jest.fn(),
      );

      expect(existsSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("delete", () => {
    test("scope ichidagi hujjat — softDelete chaqiriladi (200)", async () => {
      const doc = {
        _id: DOC_ID,
        status: "new",
        softDelete: jest.fn().mockResolvedValue(undefined),
      };
      const spy = jest.spyOn(LearningProcess, "findOne").mockResolvedValue(doc);
      const res = createRes();

      await Controller.delete(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: FACULTY_SCOPE },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...FACULTY_SCOPE });
      expect(doc.softDelete).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      jest.spyOn(LearningProcess, "findOne").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.delete(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: OUT_OF_SCOPE },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("archive / restore", () => {
    test("archive — scope tashqarisida 404", async () => {
      const spy = jest.spyOn(LearningProcess, "findOne").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.archive(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: OUT_OF_SCOPE },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...OUT_OF_SCOPE });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    test("restore — findOneWithDeleted req.scope bilan chaqiriladi, topilmasa 404", async () => {
      const spy = jest.spyOn(LearningProcess, "findOneWithDeleted").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.restore(
        { params: { id: DOC_ID }, scope: OUT_OF_SCOPE },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...OUT_OF_SCOPE });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("approve", () => {
    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      const spy = jest.spyOn(LearningProcess, "findOneAndUpdate").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.approve(
        { params: { id: DOC_ID }, scope: OUT_OF_SCOPE },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith(
        { _id: DOC_ID, ...OUT_OF_SCOPE },
        expect.anything(),
        expect.anything(),
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    test("ZANJIR QULFI: global scope'li O'UB istalgan yo'nalish/fakultet rejasini tasdiqlaydi (200)", async () => {
      const spy = jest
        .spyOn(LearningProcess, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID, status: "created" });
      const res = createRes();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          scope: GLOBAL_SCOPE,
          user: { _id: USLUBI_ID, role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
        },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith(
        { _id: DOC_ID },
        expect.anything(),
        expect.anything(),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
