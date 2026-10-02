const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const lpFixture = (processKeys) => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [{ key: "A", title: "Attestatsiyalar" }],
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sen", weeks: [{ week: 1, key: "A" }] }],
      weeks: { 1: "A" },
      total: 35,
      statistics: [{ key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 35 }],
    },
  ],
  allValues: { total: 35, statistics: [] },
  comment: null,
  learningProcess: { keys: processKeys, title: null },
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

const hasRun = (texts, seq) =>
  texts.some((_, i) => seq.every((v, j) => texts[i + j] === v));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawPage3 — 'Semestr' ustuni (Q-5)", () => {
  test("matn qiymat ('1-12') to'liq chiziladi — title | week | semester ketma-ketligida", async () => {
    const texts = await renderCalls(
      lpFixture([
        { key: " ", title: "Nazariy va amaliy ta'lim", week: 180, semester: "1-12" },
      ]),
    );
    expect(hasRun(texts, ["Nazariy va amaliy ta'lim", "180", "1-12"])).toBe(true);
  });

  test("vergul bilan ro'yxat ('2,4,6,8,10') — matn o'zgarmasdan chiziladi", async () => {
    const texts = await renderCalls(
      lpFixture([
        { key: "G", title: "GPA ko'rsatkichini hisoblash", week: 5, semester: "2,4,6,8,10" },
      ]),
    );
    expect(hasRun(texts, ["GPA ko'rsatkichini hisoblash", "5", "2,4,6,8,10"])).toBe(true);
  });

  test("semester `null` — katak BO'SH (title | week | '' ketma-ketligida, '0' EMAS)", async () => {
    const texts = await renderCalls(
      lpFixture([
        { key: "A", title: "Attestatsiyalar", week: 35, semester: null },
      ]),
    );
    expect(hasRun(texts, ["Attestatsiyalar", "35", ""])).toBe(true);
    expect(hasRun(texts, ["Attestatsiyalar", "35", "0"])).toBe(false);
  });

  test("regressiya qulfi: semester `\"0\"` (eski mongoose String-cast) string bo'lsa ham '0' chiqmaydi deb KUTILMAYDI — shu holat uchun parser/servis endi `null` qaytaradi (bu test servis-kontraktini, PDF emas, eslatadi)", async () => {
    const texts = await renderCalls(
      lpFixture([
        { key: "A", title: "Attestatsiyalar", week: 35, semester: "0" },
      ]),
    );
    expect(hasRun(texts, ["Attestatsiyalar", "35", "0"])).toBe(true);
  });
});
