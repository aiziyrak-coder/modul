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
const DOC_ID = "cccccccccccccccccccccccc";
const KAFEDRA_MUDIRI_ID = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseDoc = (status, overrides = {}) => ({
  _id: DOC_ID,
  status,
  submittedAt: null,
  author: { teacher: OWNER_ID },
  approvalSteps: [
    { step: "kafedra", status: "pending", date: null },
    { step: "arm", status: "pending", date: null },
    { step: "methodical", status: "pending", date: null },
    { step: "prorektor", status: "pending", date: null },
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

describe("REGRESSION-GUARD — syllabus.submittedAt (D-127)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("submit (draft→in_review) — submittedAt yoziladi, approvalSteps[0].date muhrlanmaydi", async () => {
    const doc = baseDoc("draft");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(teacherReq(OWNER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("in_review");
    expect(doc.submittedAt).toBeInstanceOf(Date);
    expect(doc.approvalSteps[0].date).toBeNull();
    expect(doc.save).toHaveBeenCalled();
  });

  test("reopen (rejected→draft) — submittedAt tozalanadi", async () => {
    const submitDate = new Date("2026-08-01");
    const doc = baseDoc("rejected", {
      submittedAt: submitDate,
      approvalSteps: [
        { step: "kafedra", status: "rejected", comment: "x", date: new Date("2026-08-02") },
      ],
    });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(teacherReq(OWNER_ID), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.status).toBe("draft");
    expect(doc.submittedAt).toBeNull();
  });

  test("kafedra approve (in_review) — submittedAt o'zgarmaydi, faqat step.date yoziladi", async () => {
    const submitDate = new Date("2026-08-01");
    const doc = baseDoc("in_review", { submittedAt: submitDate });
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: {},
      scope: {},
      user: { _id: KAFEDRA_MUDIRI_ID, role: { title: ROLES.KAFEDRA_MUDIRI } },
    };

    await Controller.approve(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.approvalSteps[0].status).toBe("approved");
    expect(doc.approvalSteps[0].date).toBeInstanceOf(Date);
    expect(doc.submittedAt).toBe(submitDate);
  });
});
