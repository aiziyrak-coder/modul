"use strict";

const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const LEGEND_KEYS = [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 180, semester: "1-12" },
  { key: "A", title: "Attestatsiyalar", week: 35, semester: "1-12" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi", week: 4, semester: "12" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash", week: 5, semester: "2,4,6,8,10" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish", week: 1, semester: "1" },
  { key: "M", title: "Malakaviy amaliyot", week: 27, semester: "2-11" },
  { key: "T", title: "Ta'til", week: 56, semester: "1-12" },
  { key: " ", title: "JAMI", week: 308, semester: null },
];
const SUMMARY_ROWS = [
  { key: " ", title: "Nazariy va amaliy ta’lim" },
  { key: "M", title: "Amaliyot" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "D", title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi" },
  { key: "T", title: "Ta’til haftalari" },
  { key: "K", title: "Kredit ta’lim tizimiga kirish" },
  { key: "G", title: "GPA ko’rsatkichini hisoblash" },
];

const lpFixture = (overrides = {}) => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  keys: [],
  courses: [],
  allValues: {},
  comment: null,
  learningProcess: { keys: LEGEND_KEYS.map((k) => ({ ...k })), title: null },
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

const tableRows = (texts) => {
  const start = texts.lastIndexOf("O'quv jarayonining tarkibiy qismlari");
  const end = texts.indexOf("JAMI", start);
  const body = texts.slice(start + 4, end);
  const rows = [];
  for (let i = 0; i < body.length; i += 3) rows.push(body.slice(i, i + 3));
  return rows;
};

beforeEach(() => jest.clearAllMocks());

describe("studyPlan PDF — tarkibiy qismlar Xulosa tartibi/nomi (ADR-040)", () => {
  test("summaryRows bor — Xulosa nomlari, Xulosa tartibi, raqamlar o'z qatorida", async () => {
    const rows = tableRows(await renderTexts(lpFixture({ summaryRows: SUMMARY_ROWS })));
    expect(rows).toEqual([
      ["Nazariy va amaliy ta'lim", "180", "1-12"],
      ["Amaliyot", "27", "2-11"],
      ["Attestatsiyalar", "35", "1-12"],
      ["Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", "4", "12"],
      ["Ta'til haftalari", "56", "1-12"],
      ["Kredit ta'lim tizimiga kirish", "1", "1"],
      ["GPA ko'rsatkichini hisoblash", "5", "2,4,6,8,10"],
    ]);
  });

  test("JAMI oxirida, jami hafta o'zgarmaydi", async () => {
    const texts = await renderTexts(lpFixture({ summaryRows: SUMMARY_ROWS }));
    const j = texts.indexOf("JAMI", texts.lastIndexOf("O'quv jarayonining tarkibiy qismlari"));
    expect(texts[j + 1]).toBe("308");
  });

  test("eski hujjat (summaryRows yo'q) — legend tartibi/nomi; null/[] bilan bir xil chiqish", async () => {
    const old = await renderTexts(lpFixture());
    expect(tableRows(old).map((r) => r[0])).toEqual(
      LEGEND_KEYS.filter((k) => k.title !== "JAMI").map((k) => k.title),
    );
    expect(await renderTexts(lpFixture({ summaryRows: null }))).toEqual(old);
    expect(await renderTexts(lpFixture({ summaryRows: [] }))).toEqual(old);
  });
});
