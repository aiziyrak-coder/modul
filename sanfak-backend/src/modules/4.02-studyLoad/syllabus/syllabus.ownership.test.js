jest.mock("./syllabus.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const OWNER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER_TEACHER_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DOC_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseDoc = (status, overrides = {}) => ({
  _id: DOC_ID,
  status,
  author: { teacher: OWNER_ID },
  approvalSteps: [
    { step: "kafedra", status: "pending" },
    { step: "arm", status: "pending" },
    { step: "methodical", status: "pending" },
    { step: "prorektor", status: "pending" },
  ],
  file: null,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const teacherReq = (userId, body = {}) => ({
  params: { id: DOC_ID },
  body,
  scope: {},
  user: { _id: userId, role: { title: ROLES.OQITUVCHI } },
});

describe("REGRESSION-GUARD — syllabus submit/reopen egalik (owner-only)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("egasi (o'qituvchi) draft → in_review submit qiladi — 200", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(teacherReq(OWNER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("in_review");
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("begona o'qituvchi draft → in_review submit qilishga urinadi — 403 (regression guard)", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(teacherReq(OTHER_TEACHER_ID), createRes(), next);

    expect(doc.status).toBe("draft");
    expect(doc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Bu hujjat sizga tegishli emas",
      }),
    );
  });

  test("egasi rejected → draft reopen qiladi — 200", async () => {
    const doc = baseDoc("rejected", {
      approvalSteps: [{ step: "kafedra", status: "rejected", comment: "x" }],
    });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(teacherReq(OWNER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("begona o'qituvchi rejected → draft reopen qilishga urinadi — 403 (regression guard)", async () => {
    const doc = baseDoc("rejected", {
      approvalSteps: [{ step: "kafedra", status: "rejected", comment: "x" }],
    });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(teacherReq(OTHER_TEACHER_ID), createRes(), next);

    expect(doc.status).toBe("rejected");
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  test("SUPER_ADMIN — begona sillabusni ham submit qila oladi (bypass)", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: {},
      scope: {},
      user: { _id: OTHER_TEACHER_ID, role: { title: ROLES.SUPER_ADMIN } },
    };

    await Controller.approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("in_review");
  });

  test("SUPER_ADMIN — begona sillabusni ham reopen qila oladi (bypass)", async () => {
    const doc = baseDoc("rejected", {
      approvalSteps: [{ step: "kafedra", status: "rejected", comment: "x" }],
    });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: {},
      scope: {},
      user: { _id: OTHER_TEACHER_ID, role: { title: ROLES.SUPER_ADMIN } },
    };

    await Controller.approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
  });

  test("in_review bosqichini begona (author bo'lmagan) kafedra mudiri tasdiqlaydi — 200 (zanjir buzilmagan)", async () => {
    const doc = baseDoc("in_review");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: {},
      scope: {},
      user: { _id: OTHER_TEACHER_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
    };

    await Controller.approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.approvalSteps[0].status).toBe("approved");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("REGRESSION-GUARD — updateSyllabus/deleteSyllabus egalik (P1-6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("egasi draft sillabusini tahrirlaydi — 200", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const res = createRes();
    const next = jest.fn();

    await Controller.updateSyllabus(teacherReq(OWNER_ID, { title: "x" }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(Syllabus.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("begona kafedradosh o'qituvchi (department-scope drift) tahrirlashga urinadi — 403", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    Syllabus.findByIdAndUpdate = jest.fn();
    const next = jest.fn();

    await Controller.updateSyllabus(
      teacherReq(OTHER_TEACHER_ID, { title: "x" }),
      createRes(),
      next,
    );

    expect(Syllabus.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Bu hujjat sizga tegishli emas",
      }),
    );
  });

  test("SUPER_ADMIN — begona sillabusni ham tahrirlay oladi (bypass)", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    Syllabus.findByIdAndUpdate = jest.fn().mockResolvedValue({});
    const res = createRes();
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: { title: "x" },
      scope: {},
      user: { _id: OTHER_TEACHER_ID, role: { title: ROLES.SUPER_ADMIN } },
    };

    await Controller.updateSyllabus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("egasi draft sillabusini o'chiradi — 200", async () => {
    const doc = baseDoc("draft", { softDelete: jest.fn().mockResolvedValue(undefined) });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.deleteSyllabus(teacherReq(OWNER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.softDelete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("begona kafedradosh o'qituvchi o'chirishga urinadi — 403 (softDelete chaqirilmaydi)", async () => {
    const doc = baseDoc("draft", { softDelete: jest.fn().mockResolvedValue(undefined) });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.deleteSyllabus(teacherReq(OTHER_TEACHER_ID), createRes(), next);

    expect(doc.softDelete).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Bu hujjat sizga tegishli emas",
      }),
    );
  });
});
