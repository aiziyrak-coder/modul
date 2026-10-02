jest.mock("./syllabus.model");
jest.mock("#shared/pdfGenerators/pdfHelpers", () => ({
  ...jest.requireActual("#shared/pdfGenerators/pdfHelpers"),
  shouldRegeneratePdf: jest.fn(() => false),
  saveAndUpdatePdf: jest.fn(),
}));

const Syllabus = require("./syllabus.model");
const Controller = require("./syllabus.controller");
const { ROLES } = require("#config/constants");

const DOC_ID = "cccccccccccccccccccccccc";
const DEKAN_ID = "zzzzzzzzzzzzzzzzzzzzzzzz";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const CHAIN_ORDER = ["kafedra", "arm", "methodical", "dean", "prorektor"];
const inReviewDoc = (pendingStep) => {
  const idx = CHAIN_ORDER.indexOf(pendingStep);
  return {
    _id: DOC_ID,
    status: "in_review",
    author: { teacher: "aaaaaaaaaaaaaaaaaaaaaaaa" },
    approvalSteps: CHAIN_ORDER.map((step, i) => ({
      step,
      status: i < idx ? "approved" : "pending",
    })),
    file: null,
    save: jest.fn().mockResolvedValue(undefined),
  };
};

const dekanReq = (body = {}) => ({
  params: { id: DOC_ID },
  body,
  scope: {},
  user: { _id: DEKAN_ID, role: { title: ROLES.DEKAN } },
});

describe("Vazifa (AB) — syllabus STEP_ROLES qulfi, DEKAN bosqichi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("dekan tokeni + 'dean' bosqichidagi sillabus /approve → 200", async () => {
    const doc = inReviewDoc("dean");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const res = createRes();
    const next = jest.fn();

    await Controller.approve(dekanReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(doc.approvalSteps.find((s) => s.step === "dean").status).toBe(
      "approved",
    );
    expect(doc.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("dekan tokeni + boshqa bosqichdagi (methodical) sillabus /approve → 403 (STEP_ROLES qulfi)", async () => {
    const doc = inReviewDoc("methodical");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();

    await Controller.approve(dekanReq(), createRes(), next);

    expect(doc.approvalSteps.find((s) => s.step === "methodical").status).toBe(
      "pending",
    );
    expect(doc.save).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });

  test("dekan tokeni + boshqa bosqichdagi (prorektor) sillabus /reject → 403", async () => {
    const doc = inReviewDoc("prorektor");
    Syllabus.findOne = jest.fn().mockResolvedValue(doc);
    const next = jest.fn();
    const req = {
      params: { id: DOC_ID },
      body: { comment: "izoh" },
      scope: {},
      user: { _id: DEKAN_ID, role: { title: ROLES.DEKAN } },
    };

    await Controller.reject(req, createRes(), next);

    expect(doc.approvalSteps.find((s) => s.step === "prorektor").status).toBe(
      "pending",
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 }),
    );
  });
});
