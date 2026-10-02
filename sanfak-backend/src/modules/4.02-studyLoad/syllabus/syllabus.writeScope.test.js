jest.mock("./syllabus.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const KAFEDRA_MUDIRI_ID = "dddddddddddddddddddddddd";
const ARM_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

const DEPARTMENT_SCOPE = { "author.teacher": { $in: [OWNER_ID, "member2"] } };
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

describe("syllabus — yozuv route'lari scope bilan (S-3 fix)", () => {
  describe("updateSyllabus", () => {
    test("scope ichidagi (draft) hujjat — 200 va findOne req.scope bilan chaqiriladi", async () => {
      const doc = { _id: DOC_ID, status: "draft", author: { teacher: OWNER_ID } };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
      const res = createRes();

      await Controller.updateSyllabus(
        {
          params: { id: DOC_ID },
          body: { title: "Yangi" },
          scope: DEPARTMENT_SCOPE,
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
        },
        res,
        jest.fn(),
      );

      expect(Syllabus.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { status: 1, "author.teacher": 1 },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — findOne null qaytaradi → 404 (regression guard)", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.updateSyllabus(
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

  describe("deleteSyllabus", () => {
    test("scope ichidagi hujjat — o'chiriladi (200)", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        author: { teacher: OWNER_ID },
        softDelete: jest.fn().mockResolvedValue(undefined),
      };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteSyllabus(
        {
          params: { id: DOC_ID },
          body: {},
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(Syllabus.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(doc.softDelete).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.deleteSyllabus(
        {
          params: { id: DOC_ID },
          body: {},
          user: { _id: OWNER_ID, role: { title: ROLES.OQITUVCHI } },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("archiveSyllabus / restoreSyllabus", () => {
    test("archive — scope tashqarisida 404", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.archiveSyllabus(
        { params: { id: DOC_ID }, body: {}, user: {}, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(Syllabus.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("restore — findOneWithDeleted req.scope bilan chaqiriladi, topilmasa 404", async () => {
      Syllabus.findOneWithDeleted = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.restoreSyllabus(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(Syllabus.findOneWithDeleted).toHaveBeenCalledWith({
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
        author: { teacher: OWNER_ID },
        archive: jest.fn().mockResolvedValue(undefined),
      };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.archiveSyllabus(
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
        author: { teacher: OWNER_ID },
        archive: jest.fn().mockResolvedValue(undefined),
      };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.archiveSyllabus(
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
        author: { teacher: OWNER_ID },
        archive: jest.fn().mockResolvedValue(undefined),
      };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const next = jest.fn();

      await Controller.archiveSyllabus(
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
        author: { teacher: OWNER_ID },
        archive: jest.fn().mockResolvedValue(undefined),
      };
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.archiveSyllabus(
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
      author: { teacher: OWNER_ID },
      approvalSteps: [
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    test("approve — scope tashqarisidagi hujjat 404 (findOne req.scope bilan)", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
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

      expect(Syllabus.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    test("ZANJIR QULFI: global scope'li ARM begona o'qituvchi sillabusini tasdiqlaydi (200, zanjir buzilmagan)", async () => {
      const doc = baseDoc("in_review", {
        approvalSteps: [{ step: "arm", status: "pending" }],
      });
      Syllabus.findOne = jest.fn().mockResolvedValue(doc);
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

      expect(Syllabus.findOne).toHaveBeenCalledWith({ _id: DOC_ID });
      expect(next).not.toHaveBeenCalled();
      expect(doc.approvalSteps[0].status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("reject — findOne req.scope bilan chaqiriladi, topilmasa 404", async () => {
      Syllabus.findOne = jest.fn().mockResolvedValue(null);
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

      expect(Syllabus.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});
