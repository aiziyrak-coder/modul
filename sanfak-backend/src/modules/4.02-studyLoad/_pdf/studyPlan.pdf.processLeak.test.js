const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const WEEKS = 3;

const lpFixture = () => ({
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [
    { key: " ", title: "Nazariy va amaliy ta'lim" },
    { key: "A", title: "Attestatsiyalar" },
    { key: "K", title: "Kredit ta'lim tizimiga kirish" },
    { key: "T", title: "Ta'til" },
  ],
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [
        { month: "Sen", weeks: [{ week: 1, key: "K" }, { week: 2, key: " " }, { week: 3, key: " " }] },
      ],
      weeks: { 1: "K" },
      total: 3,
      statistics: [],
    },
    {
      course: "II",
      courseNum: 2,
      months: [
        { month: "Sen", weeks: [{ week: 1, key: " " }, { week: 2, key: " " }, { week: 3, key: "A" }] },
      ],
      weeks: { 1: null, 2: "T" },
      total: 3,
      statistics: [],
    },
  ],
  allValues: { total: 6, statistics: [] },
  comment: null,
  learningProcess: { keys: [], title: null },
});

const renderTexts = async () => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lpFixture(),
    blocks: [],
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

const rowCells = (texts, label, from = 0) => {
  const i = texts.indexOf(label, from);
  expect(i).toBeGreaterThanOrEqual(0);
  return { idx: i, cells: texts.slice(i + 1, i + 1 + WEEKS) };
};

beforeEach(() => jest.clearAllMocks());

describe("drawPage1 — o'quv jarayoni: I-kurs harfi boshqa kursga sizmaydi", () => {
  test("I-kurs: K · '' · ''", async () => {
    const texts = await renderTexts();
    const { cells } = rowCells(texts, "I");
    expect(cells).toEqual(["K", "", ""]);
  });

  test("II-kurs: 1-hafta bo'sh (K EMAS), o'z harflari T va A chiziladi", async () => {
    const texts = await renderTexts();
    const { idx: i1 } = rowCells(texts, "I");
    const { cells } = rowCells(texts, "II", i1);
    expect(cells).toEqual(["", "T", "A"]);
  });

  test("jarayon jadvalida 'K' aynan bir marta", async () => {
    const texts = await renderTexts();
    const { idx: i1, cells: c1 } = rowCells(texts, "I");
    const { cells: c2 } = rowCells(texts, "II", i1);
    expect([...c1, ...c2].filter((t) => t === "K")).toHaveLength(1);
  });
});
