jest.mock("#references/_services/educationActivityResolver", () => ({
  populateAllSlugRefs: jest.fn().mockResolvedValue(undefined),
}));

const WorkingScheduleModel = require("./workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const Controller = require("./workingSchedule.controller");
const { ROLES } = require("#config/constants");
const {
  buildChainVisibilityFilter,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const REKTOR_CHAIN_FRAGMENT = buildChainVisibilityFilter(
  "workingSchedule",
  ROLES.REKTOR,
);

const DOC_ID = "cccccccccccccccccccccccc";
const COURSE_ID = "691111111111111111111111";
const REKTOR_ID = "333333333333333333333333";

const USLUBI_USER = { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } };

const FACULTY_SCOPE = { direction: { $in: ["d1", "d2"] } };
const OUT_OF_SCOPE = { direction: { $in: [] } };
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  return res;
};

afterEach(() => jest.restoreAllMocks());

describe("workingSchedule — yozuv route'lari scope bilan (F4, S-3 fix)", () => {
  describe("updateWorkingProcess", () => {
    test("scope ichidagi hujjat — findOneAndUpdate req.scope bilan chaqiriladi (200)", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: DOC_ID, status: "draft" }),
      });
      const spy = jest
        .spyOn(WorkingScheduleModel, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });
      jest.spyOn(WorkingScheduleModel, "findById").mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateWorkingProcess(
        {
          params: { id: DOC_ID },
          body: { courseId: COURSE_ID, total: 5 },
          scope: FACULTY_SCOPE,
          user: USLUBI_USER,
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

    test("scope tashqarisidagi hujjat — findOne null → 404 (regression guard)", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const next = jest.fn();

      await Controller.updateWorkingProcess(
        {
          params: { id: DOC_ID },
          body: { courseId: COURSE_ID },
          scope: OUT_OF_SCOPE,
          user: USLUBI_USER,
        },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("updateComposition", () => {
    test("scope ichidagi hujjat — findOneAndUpdate req.scope bilan chaqiriladi (200)", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: DOC_ID, status: "draft" }),
      });
      const spy = jest
        .spyOn(WorkingScheduleModel, "findOneAndUpdate")
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateComposition(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: COURSE_ID, week: 2 }] } },
          scope: FACULTY_SCOPE,
          user: USLUBI_USER,
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
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const next = jest.fn();

      await Controller.updateComposition(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: COURSE_ID, week: 2 }] } },
          scope: OUT_OF_SCOPE,
          user: USLUBI_USER,
        },
        createRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    test("egasi bo'lmagan rol (prorektor) — 403, YOZILMAYDI", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: DOC_ID, status: "draft" }),
      });
      const writeSpy = jest.spyOn(WorkingScheduleModel, "findOneAndUpdate");
      const next = jest.fn();

      await Controller.updateComposition(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: COURSE_ID, week: 2 }] } },
          scope: GLOBAL_SCOPE,
          user: { role: { title: ROLES.PROREKTOR } },
        },
        createRes(),
        next,
      );

      expect(writeSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    test("approved holatdagi rejani O'UB ham tahrirlay olmaydi (400)", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: DOC_ID, status: "approved" }),
      });
      const writeSpy = jest.spyOn(WorkingScheduleModel, "findOneAndUpdate");
      const next = jest.fn();

      await Controller.updateComposition(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { keys: [{ _id: COURSE_ID, week: 2 }] } },
          scope: GLOBAL_SCOPE,
          user: USLUBI_USER,
        },
        createRes(),
        next,
      );

      expect(writeSpy).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe("updateCompositionTitle", () => {
    test("scope tashqarisidagi hujjat — 404, filtrida req.scope bor (regression guard)", async () => {
      const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const next = jest.fn();

      await Controller.updateCompositionTitle(
        {
          params: { id: DOC_ID },
          body: { learningProcess: { title: "Yangi" } },
          scope: OUT_OF_SCOPE,
          user: USLUBI_USER,
        },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...OUT_OF_SCOPE });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("delete", () => {
    test("scope ichidagi hujjat — o'chiriladi (200), findOne req.scope bilan", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      const spy = jest
        .spyOn(WorkingScheduleModel, "findOne")
        .mockResolvedValue(doc);
      jest.spyOn(WorkingPlanModel, "findOneAndDelete").mockResolvedValue(null);
      const res = createRes();

      await Controller.delete(
        { params: { id: DOC_ID }, scope: FACULTY_SCOPE, user: USLUBI_USER },
        res,
        jest.fn(),
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...FACULTY_SCOPE });
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(null);
      const res = createRes();

      await Controller.delete(
        { params: { id: DOC_ID }, scope: OUT_OF_SCOPE },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("egasi bo'lmagan rol (prorektor) — 403, O'CHIRILMAYDI (F-3 audit)", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.delete(
        {
          params: { id: DOC_ID },
          scope: GLOBAL_SCOPE,
          user: { role: { title: ROLES.PROREKTOR } },
        },
        createRes(),
        next,
      );

      expect(doc.deleteOne).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });

  describe("approve / reject — scope + ZANJIR QULFI", () => {
    const baseDoc = (status, overrides = {}) => ({
      _id: DOC_ID,
      status,
      approvalHistory: [
        { step: "methodical", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
      agreed: { viceRector: null, date: null },
      confirmation: { rector: null, date: null },
      methodicalHead: { leader: null, date: null },
      facultyDean: { dean: null, date: null },
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    test("approve — scope tashqarisidagi hujjat 404 (findOne req.scope bilan)", async () => {
      const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          body: {},
          scope: OUT_OF_SCOPE,
          user: { _id: REKTOR_ID, role: { title: ROLES.REKTOR } },
        },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...OUT_OF_SCOPE,
        ...REKTOR_CHAIN_FRAGMENT,
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    test("ZANJIR QULFI: global scope'li REKTOR begona fakultet rejasini tasdiqlaydi (200, zanjir buzilmagan)", async () => {
      const doc = baseDoc("in_review", {
        approvalHistory: [{ step: "rektor", status: "pending" }],
      });
      const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          body: {},
          scope: GLOBAL_SCOPE,
          user: { _id: REKTOR_ID, role: { title: ROLES.REKTOR } },
        },
        res,
        next,
      );

      expect(spy).toHaveBeenCalledWith({ _id: DOC_ID, ...REKTOR_CHAIN_FRAGMENT });
      expect(next).not.toHaveBeenCalled();
      expect(doc.approvalHistory[0].status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("reject — findOne req.scope bilan chaqiriladi, topilmasa 404", async () => {
      const spy = jest.spyOn(WorkingScheduleModel, "findOne").mockResolvedValue(null);
      const next = jest.fn();

      await Controller.reject(
        {
          params: { id: DOC_ID },
          body: { comment: "sabab" },
          scope: OUT_OF_SCOPE,
          user: { _id: REKTOR_ID, role: { title: ROLES.REKTOR } },
        },
        createRes(),
        next,
      );

      expect(spy).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...OUT_OF_SCOPE,
        ...REKTOR_CHAIN_FRAGMENT,
      });
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe("subAddWorkingPlanStream — SSE headerdan OLDIN scope tekshiruvi", () => {
    test("begona learningProcess — 404, SSE header YUBORILMAYDI", async () => {
      jest.spyOn(LearningProcess, "exists").mockResolvedValue(null);
      const res = createRes();

      await Controller.subAddWorkingPlanStream(
        {
          query: { learningProcess: "lp-foreign" },
          scope: OUT_OF_SCOPE,
          user: { _id: "u1" },
          on: jest.fn(),
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    test("learningProcess yo'q — 400, SSE header YUBORILMAYDI (exists chaqirilmaydi)", async () => {
      const existsSpy = jest.spyOn(LearningProcess, "exists");
      const res = createRes();

      await Controller.subAddWorkingPlanStream(
        { query: {}, scope: FACULTY_SCOPE, user: { _id: "u1" }, on: jest.fn() },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(existsSpy).not.toHaveBeenCalled();
    });

    test("o'z doirasidagi learningProcess — exists true, filtrda req.scope bor, SSE boshlanadi", async () => {
      const existsSpy = jest.spyOn(LearningProcess, "exists").mockResolvedValue(true);
      jest.spyOn(StudyPlanModel, "findOne").mockReturnValue({
        populate: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      const res = createRes();

      await Controller.subAddWorkingPlanStream(
        {
          query: { learningProcess: "lp-own" },
          scope: FACULTY_SCOPE,
          user: { _id: "u1" },
          on: jest.fn(),
        },
        res,
        jest.fn(),
      );

      expect(existsSpy).toHaveBeenCalledWith({
        _id: "lp-own",
        ...FACULTY_SCOPE,
      });
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "text/event-stream",
      );
    });
  });
});
