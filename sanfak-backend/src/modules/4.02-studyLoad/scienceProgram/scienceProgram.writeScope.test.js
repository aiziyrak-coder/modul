jest.mock("./scienceProgram.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const ScienceProgram = require("./scienceProgram.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const KAFEDRA_MUDIRI_ID = "dddddddddddddddddddddddd";
const ARM_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const DEPARTMENT_SCOPE = { user: { $in: [OWNER_ID, "member2"] } };
const GLOBAL_SCOPE = {};

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("scienceProgram — yozuv route'lari scope bilan (S-4 fix)", () => {
  describe("updateScienceProgram", () => {
    test("scope ichidagi (draft) hujjat — 200 va findOne req.scope bilan chaqiriladi", async () => {
      const doc = { _id: DOC_ID, status: "draft", user: OWNER_ID };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      ScienceProgram.findByIdAndUpdate = jest.fn().mockResolvedValue({});
      const res = createRes();
      const next = jest.fn();

      await Controller.updateScienceProgram(
        {
          params: { id: DOC_ID },
          body: { title: "Yangi" },
          scope: DEPARTMENT_SCOPE,
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
        },
        res,
        next,
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { status: 1, user: 1, formVersion: 1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — findOne null qaytaradi → 404 (regression guard)", async () => {
      ScienceProgram.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.updateScienceProgram(
        {
          params: { id: DOC_ID },
          body: { title: "X" },
          scope: DEPARTMENT_SCOPE,
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteScienceProgram", () => {
    test("scope ichidagi hujjat — o'chiriladi (200)", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        user: OWNER_ID,
        softDelete: jest.fn().mockResolvedValue(undefined),
      };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteScienceProgram(
        {
          params: { id: DOC_ID },
          body: {},
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(doc.softDelete).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      ScienceProgram.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.deleteScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("archiveScienceProgram / restoreScienceProgram", () => {
    test("archive — scope tashqarisida 404", async () => {
      ScienceProgram.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.archiveScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("restore — findOneWithDeleted req.scope bilan chaqiriladi, topilmasa 404", async () => {
      ScienceProgram.findOneWithDeleted = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.restoreScienceProgram(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(ScienceProgram.findOneWithDeleted).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    const OWNER_USER = { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } };

    test("draft holatdagi hujjat — arxivlanadi (200), archive() chaqiriladi", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        archivedAt: null,
        user: OWNER_ID,
        archive: jest.fn().mockResolvedValue(undefined),
      };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.archiveScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: OWNER_USER, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(doc.archive).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("approved holatdagi hujjat — 400, archive() chaqirilmaydi", async () => {
      const doc = {
        _id: DOC_ID,
        status: "approved",
        archivedAt: null,
        user: OWNER_ID,
        archive: jest.fn().mockResolvedValue(undefined),
      };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.archiveScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: OWNER_USER, scope: DEPARTMENT_SCOPE },
        createRes(),
        next,
      );

      expect(doc.archive).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    test("in_review holatdagi hujjat — 400, archive() chaqirilmaydi", async () => {
      const doc = {
        _id: DOC_ID,
        status: "in_review",
        archivedAt: null,
        user: OWNER_ID,
        archive: jest.fn().mockResolvedValue(undefined),
      };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.archiveScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: OWNER_USER, scope: DEPARTMENT_SCOPE },
        createRes(),
        next,
      );

      expect(doc.archive).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    test("rejected holatdagi hujjat — arxivlanadi (200), guard bloklamaydi", async () => {
      const doc = {
        _id: DOC_ID,
        status: "rejected",
        archivedAt: null,
        user: OWNER_ID,
        archive: jest.fn().mockResolvedValue(undefined),
      };
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.archiveScienceProgram(
        { params: { id: DOC_ID }, body: {}, user: OWNER_USER, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(doc.archive).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("approve / reject — scope + ZANJIR QULFI", () => {
    const baseDoc = (status, overrides = {}) => ({
      _id: DOC_ID,
      status,
      user: OWNER_ID,
      approvalSteps: [
        { step: "teacher", status: "pending" },
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    test("approve — scope tashqarisidagi hujjat 404 (findOne req.scope bilan)", async () => {
      ScienceProgram.findOne = jest.fn().mockResolvedValue(null);
      const next = jest.fn();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          body: {},
          scope: DEPARTMENT_SCOPE,
          user: { _id: KAFEDRA_MUDIRI_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
        },
        createRes(),
        next,
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    test("ZANJIR QULFI: global scope'li ARM begona o'qituvchi hujjatini tasdiqlaydi (200, zanjir buzilmagan)", async () => {
      const doc = baseDoc("in_review", {
        approvalSteps: [{ step: "arm", status: "pending" }],
      });
      ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          body: {},
          scope: GLOBAL_SCOPE,
          user: { _id: ARM_ID, role: { title: ROLES.ARM } },
        },
        res,
        next,
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith({ _id: DOC_ID });
      expect(next).not.toHaveBeenCalled();
      expect(doc.approvalSteps[0].status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("reject — findOne req.scope bilan chaqiriladi, topilmasa 404", async () => {
      ScienceProgram.findOne = jest.fn().mockResolvedValue(null);
      const next = jest.fn();

      await Controller.reject(
        {
          params: { id: DOC_ID },
          body: { comment: "sabab" },
          scope: DEPARTMENT_SCOPE,
          user: { _id: KAFEDRA_MUDIRI_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
        },
        createRes(),
        next,
      );

      expect(ScienceProgram.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});
