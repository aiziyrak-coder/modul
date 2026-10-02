"use strict";

const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const DEFAULT_TEXT = "Ixtisoslik fanlaridan integrallashgan yakuniy davlat attestatsiyasi";
const EXCEL_TEXT = "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi";

const lpFixture = (overrides = {}) => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  keys: [],
  courses: [],
  allValues: {},
  comment: null,
  learningProcess: {
    keys: [
      { key: "T", title: "Nazariy ta'lim", week: 30, semester: "1" },
      { key: " ", title: "JAMI", week: 30 },
    ],
    title: null,
  },
  year: 2026,
  ...overrides,
});

const renderTexts = async (lp) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lp,
    blocks: [{ title: "MAJBURIY FANLAR", semesters: {}, sciences: [] }],
    meta: {},
  });
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("studyPlan PDF — Davlat attestatsiyasi matni (ADR-038)", () => {
  test("attestationNote bor — aynan u chiziladi, default EMAS", async () => {
    const texts = await renderTexts(lpFixture({ attestationNote: EXCEL_TEXT }));
    expect(texts).toContain(EXCEL_TEXT);
    expect(texts).not.toContain(DEFAULT_TEXT);
  });

  test("attestationNote null — default matn", async () => {
    const texts = await renderTexts(lpFixture({ attestationNote: null }));
    expect(texts).toContain(DEFAULT_TEXT);
  });

  test("eski hujjat (maydon umuman yo'q) — default matn", async () => {
    const texts = await renderTexts(lpFixture());
    expect(texts).toContain(DEFAULT_TEXT);
  });
});
