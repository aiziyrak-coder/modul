jest.mock("./workload.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest
    .fn()
    .mockResolvedValue({ items: [], totalPositions: 0, hourly: 0 }),
}));

const WorkloadModel = require("./workload.model");
WorkloadModel.calculateBlockTotal =
  jest.requireActual("./workload.model").calculateBlockTotal;
const Controller = require("./workload.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const OWN_DEPARTMENT_ID = "dddddddddddddddddddddddd";
const OTHER_DEPARTMENT_ID = "fffffffffffffffffffffff1";
const KAFEDRA_MUDIRI_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const USLUBI_ID = "111111111111111111111111";

const DEPARTMENT_SCOPE = { department: OWN_DEPARTMENT_ID };
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

describe("workload — yozuv route'lari scope bilan (S-5/S-6 fix)", () => {
  describe("updateWorkload", () => {
    test("scope ichidagi DRAFT hujjat — 200, findOneAndUpdate req.scope + new/runValidators bilan", async () => {
      WorkloadModel.findOne = jest.fn().mockResolvedValue({ status: "draft" });
      WorkloadModel.findOneAndUpdate = jest
        .fn()
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateWorkload(
        { params: { id: DOC_ID }, body: { title: "Yangi" }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(WorkloadModel.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { status: 1 },
      );
      expect(WorkloadModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { title: "Yangi" },
        { new: true, runValidators: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — findOne null → 404, YOZUV UMUMAN BO'LMAYDI", async () => {
      WorkloadModel.findOne = jest.fn().mockResolvedValue(null);
      WorkloadModel.findOneAndUpdate = jest.fn();
      const res = createRes();

      await Controller.updateWorkload(
        {
          params: { id: DOC_ID },
          body: { title: "X" },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(WorkloadModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    describe("STATUS GUARD — imzolangan hujjat tahrirlanmaydi", () => {
      test.each(["in_review", "approved", "rejected"])(
        "%s holatdagi yuklama — 400 va YOZUV BO'LMAYDI",
        async (status) => {
          WorkloadModel.findOne = jest.fn().mockResolvedValue({ status });
          WorkloadModel.findOneAndUpdate = jest.fn();
          const res = createRes();

          await Controller.updateWorkload(
            { params: { id: DOC_ID }, body: { title: "HACK" }, scope: GLOBAL_SCOPE },
            res,
            jest.fn(),
          );

          expect(res.status).toHaveBeenCalledWith(400);
          expect(WorkloadModel.findOneAndUpdate).not.toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining(status) }),
          );
        },
      );

      test.each(["draft", "new"])("%s holatdagi yuklama — tahrirlash O'TADI", async (status) => {
        WorkloadModel.findOne = jest.fn().mockResolvedValue({ status });
        WorkloadModel.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: DOC_ID });
        const res = createRes();

        await Controller.updateWorkload(
          { params: { id: DOC_ID }, body: { title: "OK" }, scope: GLOBAL_SCOPE },
          res,
          jest.fn(),
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(WorkloadModel.findOneAndUpdate).toHaveBeenCalled();
      });
    });
  });

  describe("deleteWorkload", () => {
    test("scope ichidagi (draft) hujjat — o'chiriladi (200)", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteWorkload(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(WorkloadModel.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(doc.deleteOne).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      WorkloadModel.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.deleteWorkload(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("approve / reject — scope (S-5 fix) + ZANJIR QULFI", () => {
    const baseDoc = (status, overrides = {}) => ({
      _id: DOC_ID,
      status,
      department: OTHER_DEPARTMENT_ID,
      approvalSteps: [
        { step: "methodical", status: "pending" },
        { step: "kafedra", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    test("approve — begona kafedra yuklamasi (scope tashqarisida) 404 — S-5 ning aynan isboti", async () => {
      WorkloadModel.findOne = jest.fn().mockResolvedValue(null);
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

      expect(WorkloadModel.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    test("ZANJIR QULFI: global scope'li O'UB begona kafedra yuklamasini tasdiqlaydi (200, zanjir buzilmagan)", async () => {
      const doc = baseDoc("in_review", {
        approvalSteps: [{ step: "methodical", status: "pending" }],
      });
      WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.approve(
        {
          params: { id: DOC_ID },
          body: {},
          scope: GLOBAL_SCOPE,
          user: {
            _id: USLUBI_ID,
            role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA },
          },
        },
        res,
        next,
      );

      expect(WorkloadModel.findOne).toHaveBeenCalledWith({ _id: DOC_ID });
      expect(next).not.toHaveBeenCalled();
      expect(doc.approvalSteps[0].status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("reject — findOne req.scope bilan chaqiriladi, topilmasa 404", async () => {
      WorkloadModel.findOne = jest.fn().mockResolvedValue(null);
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

      expect(WorkloadModel.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});

describe("workload — updateBlockContent (blok kontenti inline tahrir) scope + kontent qulfi", () => {
  const EDITOR_ID = "222222222222222222222222";
  const BLOCK_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const CLASS_TYPE_ID = "bbbbbbbbbbbbbbbbbbbbbbb1";

  const buildBlock = () => ({
    _id: BLOCK_ID,
    studyWork: {
      group: 2,
      stream: 1,
      classTypes: [
        { _id: CLASS_TYPE_ID, canonical: "lecture", stream: 10, total: 0 },
      ],
      items: [],
      thisSemester: { totalHour: 0, auditoriumHour: 0 },
    },
    otherWork: { items: [] },
    leadership: 0,
    totalHour: 10,
  });

  const buildDoc = (status) => ({
    _id: DOC_ID,
    status,
    directions: [{ direction: "dir1", blocks: [buildBlock()] }],
    save: jest.fn().mockResolvedValue(undefined),
  });

  const callController = (doc, body = {}) => {
    const next = jest.fn();
    const res = createRes();
    WorkloadModel.findOne = jest.fn().mockResolvedValue(doc);
    return Controller.updateBlockContent(
      {
        params: { id: DOC_ID, blockId: BLOCK_ID },
        body,
        scope: DEPARTMENT_SCOPE,
        user: {
          _id: EDITOR_ID,
          role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA },
        },
      },
      res,
      next,
    ).then(() => ({ res, next }));
  };

  test("scope tashqarisidagi hujjat — findOne null → 404 (next orqali)", async () => {
    const { next } = await callController(null, {
      leadership: 5,
    });

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    );
  });

  test.each(["in_review", "approved", "rejected"])(
    "%s holatdagi yuklama — 400 va YOZUV BO'LMAYDI (qulf saqlanadi)",
    async (status) => {
      const doc = buildDoc(status);
      const { next } = await callController(doc, { leadership: 5 });

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining(status),
        }),
      );
      expect(doc.save).not.toHaveBeenCalled();
    },
  );

  test.each(["draft", "new"])(
    "%s — YOZUV BAJARILADI, lekin STAMP QO'YILMAYDI va PDF bekor qilinmaydi",
    async (status) => {
      const doc = buildDoc(status);
      doc.file = "yuklama-eski.pdf";
      const { next } = await callController(doc, { leadership: 5 });

      expect(next).not.toHaveBeenCalled();
      expect(doc.save).toHaveBeenCalledTimes(1);
      expect(doc.lastEditedAfterApprovalAt).toBeUndefined();
      expect(doc.lastEditedAfterApprovalBy).toBeUndefined();
      expect(doc.file).toBe("yuklama-eski.pdf");
    },
  );

  test("draft holatdagi yuklama — 200, blok kontenti yangilanadi va save chaqiriladi", async () => {
    const doc = buildDoc("draft");
    const { res, next } = await callController(doc, {
      studyWork: { classTypes: [{ _id: CLASS_TYPE_ID, stream: 20 }] },
      leadership: 3,
    });

    expect(next).not.toHaveBeenCalled();
    expect(WorkloadModel.findOne).toHaveBeenCalledWith({
      _id: DOC_ID,
      ...DEPARTMENT_SCOPE,
    });
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        blockId: BLOCK_ID,
        previousHour: 10,
      }),
    );
    const block = doc.directions[0].blocks[0];
    expect(block.studyWork.classTypes[0].stream).toBe(20);
    expect(block.leadership).toBe(3);
    expect(block.totalHour).toBe(23);
  });
});
