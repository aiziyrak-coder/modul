jest.mock("./scienceProgram.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock(
  "#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model",
);
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#system/notification/notificationDispatcher", () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const ScienceProgram = require("./scienceProgram.model");
ScienceProgram.CHAINS = jest.requireActual("./scienceProgram.model").CHAINS;
ScienceProgram.buildChainSteps = jest.requireActual(
  "./scienceProgram.model",
).buildChainSteps;
const {
  createscienceProgramSchema,
  updatescienceProgramSchema,
} = require("./scienceProgram.validation");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");
const { ROLES } = require("#config/constants");

const TEACHER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEKAN_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCIENCE_ID = "cccccccccccccccccccccccc";
const DOC_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeDistQuery = (result) => {
  const q = {};
  q.select = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
};

beforeEach(() => {
  jest.clearAllMocks();
  WorkingPlan.findOne = jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue(null),
  });
  WorkingScheduleModel.find = jest.fn().mockReturnValue({
    distinct: jest.fn().mockResolvedValue([]),
  });
});

describe("addScienceProgram — W · Faza 1: formVersion → approvalSteps", () => {
  let saveMock;

  beforeEach(() => {
    saveMock = jest.fn().mockResolvedValue(undefined);
    ScienceProgram.mockImplementation(function ctor(doc) {
      this.doc = doc;
      this._id = "sp-new";
      this.status = "draft";
      this.save = saveMock;
      this.set = jest.fn();
    });
    WorkloadDistModel.findOne = jest
      .fn()
      .mockReturnValue(makeDistQuery({ _id: "d1" }));
  });

  const teacherReq = (body = {}) => ({
    body: { science: SCIENCE_ID, ...body },
    user: { _id: TEACHER_ID, role: { title: ROLES.OQITUVCHI } },
  });

  test("formVersion berilmasa — 'v259' + 5 bosqichli B1 approvalSteps (dekanda tugaydi)", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.addScienceProgram(teacherReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    const passedDoc = ScienceProgram.mock.calls[0][0];
    expect(passedDoc.formVersion).toBe("v259");
    expect(passedDoc.approvalSteps.map((s) => s.step)).toEqual([
      "teacher",
      "kafedra",
      "arm",
      "methodical",
      "dean",
    ]);
    expect(passedDoc.approvalSteps.map((s) => s.step)).not.toContain("rektor");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("formVersion:'v142' — 3 bosqichli approvalSteps [teacher,kafedra,dean]", async () => {
    const res = createRes();
    const next = jest.fn();

    await Controller.addScienceProgram(
      teacherReq({ formVersion: "v142" }),
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    const passedDoc = ScienceProgram.mock.calls[0][0];
    expect(passedDoc.formVersion).toBe("v142");
    expect(passedDoc.approvalSteps.map((s) => s.step)).toEqual([
      "teacher",
      "kafedra",
      "dean",
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("SECURITY — formVersion PUT /:id da STRIP/RAD etiladi", () => {
  test("Joi: updatescienceProgramSchema formVersion'ni RAD etadi (forbidden)", () => {
    const { error } = updatescienceProgramSchema.validate({
      title: "X",
      formVersion: "v142",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/formVersion/);
  });

  test("Joi: createscienceProgramSchema formVersion'ni QABUL qiladi (v259/v142)", () => {
    const ok1 = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      formVersion: "v142",
    });
    expect(ok1.error).toBeUndefined();

    const bad = createscienceProgramSchema.validate({
      science: SCIENCE_ID,
      formVersion: "v999",
    });
    expect(bad.error).toBeDefined();
  });

  test("Controller: updateScienceProgram — $set'da formVersion UMUMAN YO'Q (DB darajasida)", async () => {
    const doc = { _id: DOC_ID, status: "draft", user: TEACHER_ID };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    ScienceProgram.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const res = createRes();
    const next = jest.fn();

    await Controller.updateScienceProgram(
      {
        params: { id: DOC_ID },
        body: { title: "Yangi nom", formVersion: "v142" },
        scope: {},
        user: { _id: TEACHER_ID, role: { title: ROLES.OQITUVCHI } },
      },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(ScienceProgram.findByIdAndUpdate).toHaveBeenCalledTimes(1);
    const [, updateArg] = ScienceProgram.findByIdAndUpdate.mock.calls[0];
    expect(updateArg.$set).not.toHaveProperty("formVersion");
    expect(updateArg.$set.title).toBe("Yangi nom");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("approve — dekan faqat 'v142' hujjatining 'dean' bosqichini tasdiqlaydi", () => {
  const dekanReq = (docFindResult, body = {}) => ({
    params: { id: DOC_ID },
    body,
    scope: {},
    user: { _id: DEKAN_ID, role: { title: ROLES.DEKAN } },
  });

  test("v259 hujjat, joriy bosqich 'kafedra' — dekan 403 oladi (STEP_ROLES qulfi)", async () => {
    const doc = {
      _id: DOC_ID,
      status: "in_review",
      user: TEACHER_ID,
      formVersion: "v259",
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(dekanReq(doc), createRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(doc.approvalSteps[1].status).toBe("pending");
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("v142 hujjat, joriy bosqich 'kafedra' (hali 'dean' emas) — dekan 403 oladi", async () => {
    const doc = {
      _id: DOC_ID,
      status: "in_review",
      user: TEACHER_ID,
      formVersion: "v142",
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "pending" },
        { step: "dean", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(dekanReq(doc), createRes(), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
    expect(doc.save).not.toHaveBeenCalled();
  });

  test("v142 hujjat, joriy bosqich 'dean' — dekan 200 oladi, zanjir yakunlanadi (approved)", async () => {
    const doc = {
      _id: DOC_ID,
      status: "in_review",
      user: TEACHER_ID,
      formVersion: "v142",
      approvalSteps: [
        { step: "teacher", status: "approved" },
        { step: "kafedra", status: "approved" },
        { step: "dean", status: "pending" },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(dekanReq(doc), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.approvalSteps[2].status).toBe("approved");
    expect(doc.status).toBe("approved");
    expect(doc.barcode).toBeTruthy();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("approve — submit (draft → in_review): nextStep hujjatning O'Z zanjiridan", () => {
  test("v259: submitdan keyin nextStep = 'kafedra' (hisoblangan, qattiq emas)", async () => {
    const doc = {
      _id: DOC_ID,
      status: "draft",
      user: TEACHER_ID,
      formVersion: "v259",
      approvalSteps: [
        { step: "teacher", status: "pending" },
        { step: "kafedra", status: "pending" },
        { step: "arm", status: "pending" },
        { step: "methodical", status: "pending" },
        { step: "prorektor", status: "pending" },
        { step: "rektor", status: "pending" },
      ],
      file: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: {},
        user: { _id: TEACHER_ID, role: { title: ROLES.OQITUVCHI } },
      },
      res,
      jest.fn(),
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ nextStep: "kafedra" }),
    );
  });

  test("v142: submitdan keyin nextStep ham 'kafedra' (zanjir boshi bir xil)", async () => {
    const doc = {
      _id: DOC_ID,
      status: "draft",
      user: TEACHER_ID,
      formVersion: "v142",
      approvalSteps: [
        { step: "teacher", status: "pending" },
        { step: "kafedra", status: "pending" },
        { step: "dean", status: "pending" },
      ],
      file: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    ScienceProgram.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();

    await Controller.approve(
      {
        params: { id: DOC_ID },
        body: {},
        scope: {},
        user: { _id: TEACHER_ID, role: { title: ROLES.OQITUVCHI } },
      },
      res,
      jest.fn(),
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ nextStep: "kafedra" }),
    );
  });
});

describe("paginateSciencePrograms — .lean() tuzog'i: formVersion yo'q → 'v259'", () => {
  test("DB'da formVersion maydoni umuman yo'q (legacy) — javobda 'v259' chiqadi", async () => {
    jest.spyOn(ScienceProgram, "paginate").mockResolvedValue({
      docs: [{ _id: "legacy-1", status: "draft" }],
      totalDocs: 1,
      page: 1,
      limit: 20,
    });
    const res = createRes();

    await Controller.paginateSciencePrograms(
      { query: { page: 1, limit: 20 }, scope: {} },
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.docs[0].formVersion).toBe("v259");
  });

  test("DB'da formVersion:'v142' bo'lsa — o'zgarmasdan qaytadi", async () => {
    jest.spyOn(ScienceProgram, "paginate").mockResolvedValue({
      docs: [{ _id: "v142-1", status: "draft", formVersion: "v142" }],
      totalDocs: 1,
      page: 1,
      limit: 20,
    });
    const res = createRes();

    await Controller.paginateSciencePrograms(
      { query: { page: 1, limit: 20 }, scope: {} },
      res,
      jest.fn(),
    );

    const body = res.json.mock.calls[0][0];
    expect(body.docs[0].formVersion).toBe("v142");
  });
});
