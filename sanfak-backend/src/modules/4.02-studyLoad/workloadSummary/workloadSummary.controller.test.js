"use strict";

jest.mock("./workloadSummary.model");
jest.mock("./workloadSummary.service");
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service", () => ({
  issueToken: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx", () => ({
  buildWorkloadSummaryWorkbook: jest.fn(),
  summaryFileName: () => "f.xlsx",
}));
jest.mock("#modules/4.02-studyLoad/_pdf/workloadSummary.pdf", () => ({
  buildWorkloadSummaryPdf: jest.fn(),
}));
jest.mock("#references/_services/academicYearResolver", () => ({
  resolveAcademicYearId: jest.fn(),
  getAcademicYearTitle: jest.fn(),
}));

const WorkloadSummary = require("./workloadSummary.model");
const service = require("./workloadSummary.service");
const Controller = require("./workloadSummary.controller");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeReq = (over = {}) => ({
  params: { id: "s1" },
  body: {},
  query: {},
  user: { _id: "u1", role: { title: ROLES.REKTOR } },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  service.getCurrentStep = jest.fn().mockReturnValue({ step: "financial" });
});

describe("approveWorkloadSummary — servis xatosi JAVOB bilan tugaydi", () => {
  test.each([
    ["in_review (bosqichni tasdiqlash)", "in_review", "approveStep", 403],
    ["draft (yuborish)", "draft", "submitSummary", 403],
    ["rejected (qayta ochish)", "rejected", "reopenSummary", 403],
    ["approved (qulf)", "approved", "approveStep", 409],
  ])("%s: servis %s tashlasa — next(err) BIR MARTA, javob yuborilmaydi", async (_label, status, method, code) => {
    WorkloadSummary.findOne = jest.fn().mockResolvedValue({ _id: "s1", status, save: jest.fn() });
    service[method] = jest.fn(() => {
      throw new ErrorHandler(code, "ruxsat yo'q / qulf");
    });
    const next = jest.fn();
    const res = makeRes();

    await Controller.approveWorkloadSummary(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: code });
    expect(res.json).not.toHaveBeenCalled();
  });

  test("hujjat topilmasa — 404", async () => {
    WorkloadSummary.findOne = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    const res = makeRes();
    await Controller.approveWorkloadSummary(makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

});

describe("approveWorkloadSummary — muvaffaqiyatli shoxlar (xulq o'zgarmagan)", () => {
  test("yuborish → 200 + action", async () => {
    const doc = { _id: "s1", status: "draft", approvalSteps: [], save: jest.fn() };
    WorkloadSummary.findOne = jest.fn().mockResolvedValue(doc);
    service.submitSummary = jest.fn(() => {
      doc.status = "in_review";
      return doc;
    });
    const res = makeRes();
    const next = jest.fn();

    await Controller.approveWorkloadSummary(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      action: "submitted",
      status: "in_review",
      nextStep: "financial",
    });
    expect(doc.save).toHaveBeenCalled();
  });

  test("oxirgi bosqich → approved + supersede chaqiriladi", async () => {
    const doc = { _id: "s1", status: "in_review", approvalSteps: [], save: jest.fn() };
    WorkloadSummary.findOne = jest.fn().mockResolvedValue(doc);
    service.approveStep = jest.fn(() => {
      doc.status = "approved";
      return { approvedStep: "rektor", nextStep: null };
    });
    service.supersedePrevious = jest.fn().mockResolvedValue(1);
    service.getCurrentStep = jest.fn().mockReturnValue(null);
    const res = makeRes();
    const next = jest.fn();

    await Controller.approveWorkloadSummary(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(service.supersedePrevious).toHaveBeenCalledWith(doc);
    expect(res.json.mock.calls[0][0]).toMatchObject({ action: "approved", superseded: 1 });
  });
});

describe("approveWorkloadSummary — D-16 eskirgan surat", () => {
  test("yakuniy bosqich + eskirgan — 409, save/QR/supersede YO'Q", async () => {
    const doc = { _id: "s1", status: "in_review", approvalSteps: [], save: jest.fn() };
    WorkloadSummary.findOne = jest.fn().mockResolvedValue(doc);
    service.approveStep = jest.fn(() => {
      doc.status = "approved";
      return { approvedStep: "rektor", nextStep: null };
    });
    service.assertFreshForFinalApproval = jest.fn().mockRejectedValue(new ErrorHandler(409, "eskirgan"));
    service.supersedePrevious = jest.fn();
    const next = jest.fn();

    await Controller.approveWorkloadSummary(makeReq(), makeRes(), next);

    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(doc.save).not.toHaveBeenCalled();
    expect(service.supersedePrevious).not.toHaveBeenCalled();
  });

  test("oraliq bosqich — eskirganlik tekshirilmaydi (banner yetarli)", async () => {
    const doc = { _id: "s1", status: "in_review", approvalSteps: [], save: jest.fn() };
    WorkloadSummary.findOne = jest.fn().mockResolvedValue(doc);
    service.approveStep = jest.fn(() => ({ approvedStep: "financial", nextStep: "prorektor" }));
    service.assertFreshForFinalApproval = jest.fn();

    await Controller.approveWorkloadSummary(makeReq(), makeRes(), jest.fn());

    expect(service.assertFreshForFinalApproval).not.toHaveBeenCalled();
    expect(doc.save).toHaveBeenCalled();
  });
});

describe("rejectWorkloadSummary — xato yo'li", () => {
  test("servis 409 tashlasa — next(err), javob yo'q", async () => {
    WorkloadSummary.findOne = jest.fn().mockResolvedValue({ _id: "s1", status: "draft", save: jest.fn() });
    service.rejectSummary = jest.fn(() => {
      throw new ErrorHandler(409, "tasdiqlash bosqichida emas");
    });
    const next = jest.fn();
    const res = makeRes();
    await Controller.rejectWorkloadSummary(makeReq({ body: { comment: "x" } }), res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});
