"use strict";

const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const lpFixture = (overrides = {}) => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [],
  courses: [],
  allValues: {},
  comment: null,
  learningProcess: { keys: [], title: null },
  year: 2026,
  ...overrides,
});

const planFixture = (lp) => ({
  _id: "sp1",
  learningProcess: lp,
  blocks: [{ title: "MAJBURIY FANLAR", semesters: {}, sciences: [] }],
  meta: {},
});

const mockPlan = (lp) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(planFixture(lp));
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
};

const renderCalls = async (lp) => {
  mockPlan(lp);
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return spy.mock.calls.map((c) => c[0]);
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("chiziq CHIZILMAYDI (ADR-021 Qaror #1/#9)", () => {
  test("1-bet TASDIQLAYMAN blokidagi eski chiziq ('_________________________') endi chizilmaydi", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts).not.toContain("_________________________");
    expect(texts).toContain('"TASDIQLAYMAN"');
  });

  test("3-bet Imzolar blokidagi eski chiziq ('______________________   ___________________') endi chizilmaydi", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts).not.toContain("______________________   ___________________");
    expect(texts).toContain("O'quv ishlari bo'yicha prorektor");
    expect(texts).toContain("O'quv-uslubiy boshqarma boshlig'i");
    expect(texts).toContain("Fakultet dekanlari");
    expect(texts).toContain("Kadrlar buyurtmachisi:");
  });

  test("holat qatori ('Elektron tasdiqlangan') hech qachon chizilmaydi (zanjir yo'q, source:none)", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts).not.toContain("Elektron tasdiqlangan");
  });
});
