jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const WorkloadDistribution = require("./workloadDistribution.model");
const Controller = require("./workloadDistribution.controller");
const { ROLES } = require("#config/constants");
const {
  buildChainVisibilityFilter,
} = require("#modules/4.02-studyLoad/_shared/chainVisibility");
const USLUBI_CHAIN_FRAGMENT = buildChainVisibilityFilter(
  "workloadDistribution",
  ROLES.OQUV_USLUBIY_BOSHQARMA,
);

const DOC_ID = "cccccccccccccccccccccccc";
const ENTRY_ID = "666666666666666666666666";
const OWN_DEPARTMENT_ID = "dddddddddddddddddddddddd";
const KAFEDRA_MUDIRI_ID = "eeeeeeeeeeeeeeeeeeeeeeee";
const USLUBI_ID = "111111111111111111111111";

const DEPARTMENT_SCOPE = { department: OWN_DEPARTMENT_ID };
const GLOBAL_SCOPE = {};

const KAFEDRA_MUDIRI_USER = { role: { title: ROLES.KAFEDRA_MUDIRI } };

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("workloadDistribution — yozuv route'lari scope bilan (S-7/S-8 fix)", () => {
  describe("updateWorkloadDistribution", () => {
    test("scope ichidagi DRAFT hujjat — 200, findOneAndUpdate req.scope + new/runValidators bilan", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue({ status: "draft" });
      WorkloadDistribution.findOneAndUpdate = jest
        .fn()
        .mockResolvedValue({ _id: DOC_ID });
      const res = createRes();

      await Controller.updateWorkloadDistribution(
        {
          params: { id: DOC_ID },
          body: { title: "Yangi" },
          scope: DEPARTMENT_SCOPE,
          user: KAFEDRA_MUDIRI_USER,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { status: 1 },
      );
      expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { title: "Yangi" },
        { new: true, runValidators: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("egasi bo'lmagan rol (O'UB) — 403, YOZUV BO'LMAYDI", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue({ status: "draft" });
      WorkloadDistribution.findOneAndUpdate = jest.fn();
      const res = createRes();
      const next = jest.fn();

      await Controller.updateWorkloadDistribution(
        {
          params: { id: DOC_ID },
          body: { title: "HACK" },
          scope: GLOBAL_SCOPE,
          user: { role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA } },
        },
        res,
        next,
      );

      expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    test("scope tashqarisidagi hujjat — findOne null → 404, YOZUV UMUMAN BO'LMAYDI", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      WorkloadDistribution.findOneAndUpdate = jest.fn();
      const res = createRes();

      await Controller.updateWorkloadDistribution(
        { params: { id: DOC_ID }, body: { title: "X" }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
    });

    describe("STATUS GUARD — imzolangan taqsimot tahrirlanmaydi", () => {
      test.each(["in_review", "approved", "rejected"])(
        "%s holatdagi taqsimot — 400 va YOZUV BO'LMAYDI",
        async (status) => {
          WorkloadDistribution.findOne = jest.fn().mockResolvedValue({ status });
          WorkloadDistribution.findOneAndUpdate = jest.fn();
          const res = createRes();

          await Controller.updateWorkloadDistribution(
            {
              params: { id: DOC_ID },
              body: { title: "HACK" },
              scope: DEPARTMENT_SCOPE,
              user: KAFEDRA_MUDIRI_USER,
            },
            res,
            jest.fn(),
          );

          expect(res.status).toHaveBeenCalledWith(400);
          expect(WorkloadDistribution.findOneAndUpdate).not.toHaveBeenCalled();
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.stringContaining(status) }),
          );
        },
      );

      test.each(["draft", "new"])("%s holatdagi taqsimot — tahrirlash O'TADI", async (status) => {
        WorkloadDistribution.findOne = jest.fn().mockResolvedValue({ status });
        WorkloadDistribution.findOneAndUpdate = jest
          .fn()
          .mockResolvedValue({ _id: DOC_ID });
        const res = createRes();

        await Controller.updateWorkloadDistribution(
          {
            params: { id: DOC_ID },
            body: { title: "OK" },
            scope: DEPARTMENT_SCOPE,
            user: KAFEDRA_MUDIRI_USER,
          },
          res,
          jest.fn(),
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(WorkloadDistribution.findOneAndUpdate).toHaveBeenCalled();
      });
    });
  });

  describe("deleteWorkloadDistribution", () => {
    test("scope ichidagi hujjat — o'chiriladi (200), findOne req.scope bilan", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.deleteWorkloadDistribution(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE, user: KAFEDRA_MUDIRI_USER },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(doc.deleteOne).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("egasi bo'lmagan rol (reja_moliya) — 403, O'CHIRILMAYDI", async () => {
      const doc = {
        _id: DOC_ID,
        status: "draft",
        deleteOne: jest.fn().mockResolvedValue(undefined),
      };
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();
      const next = jest.fn();

      await Controller.deleteWorkloadDistribution(
        {
          params: { id: DOC_ID },
          scope: GLOBAL_SCOPE,
          user: { role: { title: ROLES.REJA_MOLIYA } },
        },
        res,
        next,
      );

      expect(doc.deleteOne).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 }),
      );
    });

    test("scope tashqarisidagi hujjat — 404 (regression guard)", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.deleteWorkloadDistribution(
        { params: { id: DOC_ID }, scope: DEPARTMENT_SCOPE },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("vacateTeacher", () => {
    test("scope ichidagi taqsimot — o'qituvchi vakantsiyaga o'tkaziladi (200)", async () => {
      const entry = { _id: ENTRY_ID, teacher: "t1", totalHour: 10, isVacant: false };
      const doc = {
        _id: DOC_ID,
        status: "draft",
        teachers: [entry],
        residueHour: 0,
        save: jest.fn().mockResolvedValue(undefined),
      };
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
      const res = createRes();

      await Controller.vacateTeacher(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID },
          body: {},
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(entry.isVacant).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("scope tashqarisidagi taqsimot — 404 (regression guard)", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.vacateTeacher(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID },
          body: {},
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("fillVacancy", () => {
    test("scope tashqarisidagi taqsimot — 404 (regression guard)", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.fillVacancy(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID },
          body: { teacher: "t2" },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("addTeacher / removeTeacher", () => {
    test("addTeacher — scope tashqarisida 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.addTeacher(
        {
          params: { id: DOC_ID },
          body: { teacher: "t1", stavka: 1 },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("removeTeacher — scope tashqarisida 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.removeTeacher(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { teachers: 1, residueHour: 1, status: 1 },
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("addBlockToTeacher / removeBlockFromTeacher", () => {
    test("addBlockToTeacher — scope tashqarisida 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.addBlockToTeacher(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID },
          body: { workloadBlockId: "b1" },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { workload: 1, residueHour: 1, teachers: 1, status: 1 },
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test("removeBlockFromTeacher — scope tashqarisida 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
      const res = createRes();

      await Controller.removeBlockFromTeacher(
        {
          params: { id: DOC_ID, teacherEntryId: ENTRY_ID, blockId: "b1" },
          scope: DEPARTMENT_SCOPE,
        },
        res,
        jest.fn(),
      );

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith(
        { _id: DOC_ID, ...DEPARTMENT_SCOPE },
        { teachers: 1, status: 1 },
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("approve / reject — scope (S-7 fix) + ZANJIR QULFI", () => {
    const baseDoc = (status, overrides = {}) => ({
      _id: DOC_ID,
      status,
      department: "boshqa-kafedra-id",
      approvalSteps: [
        { step: "kafedra", status: "pending" },
        { step: "methodical", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    });

    test("approve — begona kafedra taqsimoti (scope tashqarisida) 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
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

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    test("ZANJIR QULFI: global scope'li O'UB begona kafedra taqsimotini tasdiqlaydi (200, zanjir buzilmagan)", async () => {
      const doc = baseDoc("in_review", {
        approvalSteps: [{ step: "methodical", status: "pending" }],
      });
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(doc);
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

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...USLUBI_CHAIN_FRAGMENT,
      });
      expect(next).not.toHaveBeenCalled();
      expect(doc.approvalSteps[0].status).toBe("approved");
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("reject — findOne req.scope bilan chaqiriladi, topilmasa 404", async () => {
      WorkloadDistribution.findOne = jest.fn().mockResolvedValue(null);
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

      expect(WorkloadDistribution.findOne).toHaveBeenCalledWith({
        _id: DOC_ID,
        ...DEPARTMENT_SCOPE,
      });
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });
});
