"use strict";

jest.mock("./contingentReport.model");
jest.mock("./contingentReport.service");
jest.mock("./contingentReport.prefill", () => ({ PREFILL_CELLS: [], buildPrefillRows: jest.fn(), mergePrefill: jest.fn(), rowKey: () => "" }));
jest.mock("#modules/4.02-studyLoad/_verify/documentVerify.service", () => ({ issueToken: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/_pdf/contingentReport.pdf", () => ({ buildContingentReportPdf: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/_excel/contingentReport.xlsx", () => ({
  buildContingentWorkbook: jest.fn(),
  contingentFileName: () => "f.xlsx",
}));
jest.mock("#references/_services/academicYearResolver", () => ({
  resolveAcademicYearId: jest.fn(),
  getAcademicYearTitle: jest.fn(),
}));
jest.mock("#references/faculty/faculty.model", () => ({ findById: jest.fn() }));

const ContingentReport = require("./contingentReport.model");
const service = require("./contingentReport.service");
const Controller = require("./contingentReport.controller");
const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeReq = (over = {}) => ({
  params: { id: "c1" },
  body: {},
  query: {},
  user: { _id: "u1", role: { title: ROLES.FAKULTET_KENGASH_KOTIBI, scopeLevel: "faculty" } },
  scope: { faculty: "f1" },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  ContingentReport.findOne = jest.fn().mockResolvedValue({ _id: "c1", status: "in_review", save: jest.fn() });
  service.getCurrentStep = jest.fn().mockReturnValue({ step: "dean" });
});

describe("approveContingentReport — xato JAVOB bilan tugaydi", () => {
  test.each([
    ["in_review (tasdiqlash)", "in_review", "approveStep"],
    ["draft (yuborish)", "draft", "submitReport"],
    ["rejected (qayta ochish)", "rejected", "reopenReport"],
  ])("%s: servis 403 tashlasa — next(err), res JAVOBSIZ qolmaydi", async (_label, status, method) => {
    ContingentReport.findOne = jest.fn().mockResolvedValue({ _id: "c1", status, save: jest.fn() });
    service[method] = jest.fn(() => {
      throw new ErrorHandler(403, "ruxsat yo'q");
    });
    const next = jest.fn();
    const res = makeRes();
    await Controller.approveContingentReport(makeReq(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(res.json).not.toHaveBeenCalled();
  });

  test("hujjat topilmasa — 404 (scope tashqarisi ham shu yo'l)", async () => {
    ContingentReport.findOne = jest.fn().mockResolvedValue(null);
    const next = jest.fn();
    const res = makeRes();
    await Controller.approveContingentReport(makeReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  test("muvaffaqiyat: yuborish → 200 + action", async () => {
    const doc = { _id: "c1", status: "draft", approvalSteps: [], save: jest.fn() };
    ContingentReport.findOne = jest.fn().mockResolvedValue(doc);
    service.submitReport = jest.fn(() => {
      doc.status = "in_review";
      return doc;
    });
    const res = makeRes();
    const next = jest.fn();
    await Controller.approveContingentReport(makeReq(), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ action: "submitted", status: "in_review", nextStep: "dean" });
    expect(doc.save).toHaveBeenCalled();
  });
});

describe("rejectContingentReport / updateContingentReport — xato yo'li", () => {
  test("reject: servis 409 → next(err)", async () => {
    service.rejectReport = jest.fn(() => {
      throw new ErrorHandler(409, "bosqichda emas");
    });
    const next = jest.fn();
    const res = makeRes();
    await Controller.rejectContingentReport(makeReq({ body: { comment: "x" } }), res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });

  test("PUT: servis 400 → next(err)", async () => {
    service.applyContent = jest.fn().mockRejectedValue(new ErrorHandler(400, "yo'nalish begona"));
    const next = jest.fn();
    const res = makeRes();
    await Controller.updateContingentReport(makeReq({ body: { rows: [], foreignByCountry: [] } }), res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("writeFilter — yozuv yo'lida fakultet MAJBURIY (fail-open drift yo'q)", () => {
  test.each([
    ["approve", "approveContingentReport"],
    ["reject", "rejectContingentReport"],
    ["PUT", "updateContingentReport"],
    ["prefill", "prefillContingentReport"],
    ["DELETE", "deleteContingentReport"],
  ])("%s: global rol (scope bo'sh) → 403, DB so'rovi YUBORILMAYDI", async (_label, handler) => {
    ContingentReport.findOne = jest.fn();
    service.removeReport = jest.fn();
    const next = jest.fn();
    const res = makeRes();
    await Controller[handler](
      makeReq({ user: { _id: "u9", role: { title: ROLES.OQUV_USLUBIY_BOSHQARMA, scopeLevel: "global" } }, scope: {}, body: { rows: [], foreignByCountry: [] } }),
      res,
      next,
    );
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(ContingentReport.findOne).not.toHaveBeenCalled();
    expect(service.removeReport).not.toHaveBeenCalled();
  });

  test("super_admin — bypass (fakultetsiz ham ishlaydi)", async () => {
    const doc = { _id: "c1", status: "draft", approvalSteps: [], save: jest.fn() };
    ContingentReport.findOne = jest.fn().mockResolvedValue(doc);
    service.submitReport = jest.fn(() => doc);
    const res = makeRes();
    const next = jest.fn();
    await Controller.approveContingentReport(
      makeReq({ user: { _id: "s1", role: { title: ROLES.SUPER_ADMIN, scopeLevel: "global" } }, scope: {} }),
      res,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(ContingentReport.findOne.mock.calls[0][0]).toEqual({ _id: "c1", active: true });
  });

  test("dekan — filtrda fakultet bor (IDOR yo'q)", async () => {
    ContingentReport.findOne = jest.fn().mockResolvedValue(null);
    const res = makeRes();
    await Controller.approveContingentReport(
      makeReq({ user: { _id: "d1", role: { title: ROLES.DEKAN, scopeLevel: "faculty" } }, scope: { faculty: "f1" } }),
      res,
      jest.fn(),
    );
    expect(ContingentReport.findOne.mock.calls[0][0]).toEqual({ _id: "c1", active: true, faculty: "f1" });
  });
});
