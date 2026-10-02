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
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("planSource === \"institute\" (yoki belgilanmagan — default)", () => {
  test("TASDIQLAYMAN bloki chiziladi", async () => {
    const texts = await renderCalls(lpFixture({ planSource: "institute" }));
    expect(texts).toContain('"TASDIQLAYMAN"');
  });

  test("planSource umuman berilmasa ham — default institut deb qabul qilinadi (backward-compat)", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts).toContain('"TASDIQLAYMAN"');
  });
});

describe("planSource === \"ministry\" — institut vazirlik rejasini TASDIQLAMAYDI", () => {
  test("TASDIQLAYMAN bloki UMUMAN chizilmaydi", async () => {
    const texts = await renderCalls(lpFixture({ planSource: "ministry" }));
    expect(texts).not.toContain('"TASDIQLAYMAN"');
  });

  test("`basisNote` bo'lsa — o'sha matn chiqadi", async () => {
    const texts = await renderCalls(
      lpFixture({
        planSource: "ministry",
        basisNote: "OTM va FIV vazirligining 2026-yil 5-sonli buyrug'i",
      }),
    );
    expect(texts).toContain(
      "OTM va FIV vazirligining 2026-yil 5-sonli buyrug'i",
    );
    expect(texts).not.toContain('"TASDIQLAYMAN"');
  });

  test("`basisNote` yo'q bo'lsa — burchak bo'sh qoladi, xatolik chiqmaydi", async () => {
    const texts = await renderCalls(lpFixture({ planSource: "ministry", basisNote: null }));
    expect(texts).not.toContain('"TASDIQLAYMAN"');
    expect(texts).not.toContain(null);
    expect(texts).not.toContain(undefined);
  });

  test("holat qatori ('Elektron tasdiqlangan') bu holatda ham chizilmaydi", async () => {
    const texts = await renderCalls(lpFixture({ planSource: "ministry" }));
    expect(texts).not.toContain("Elektron tasdiqlangan");
  });
});
