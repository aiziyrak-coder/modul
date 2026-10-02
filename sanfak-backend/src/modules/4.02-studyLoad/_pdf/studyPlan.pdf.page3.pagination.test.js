const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const processKeys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 150, semester: "1-12" },
  { key: "A", title: "Attestatsiyalar", week: 30, semester: "1-12" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish", week: 1, semester: "1" },
  { key: "M", title: "Malakaviy amaliyot", week: 20, semester: "2-11" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi", week: 4, semester: "12" },
  { key: "T", title: "Ta'til", week: 47, semester: "1-12" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash", week: 4, semester: "2,4" },
  { key: " ", title: "JAMI", week: 256, semester: "" },
];

const LONG_COMMENT = Array.from(
  { length: 30 },
  (_, i) =>
    `${i + 1}) O'quv reja asosida ishchi o'quv rejasini tuzishda talabalar ` +
    "yuklamasining haftalik hajmini saqlagan holda o'quv fanlari bloki hajmini " +
    "5% gacha o'zgartirish mumkin.",
).join("\n");

const lpFixture = (comment) => ({
  direction: { title: "Davolash ishi", directionCode: "60910200" },
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
      months: [{ month: "Sen", weeks: [{ week: 1, key: "T" }] }],
      weeks: { 1: "T" },
      total: 41,
      statistics: [],
    },
  ],
  allValues: { total: 204, statistics: [] },
  comment,
  learningProcess: { keys: processKeys(), title: null },
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

const renderPlaced = async (lp) => {
  mockPlan(lp);
  const originalText = PDFDocument.prototype.text;
  const originalAddPage = PDFDocument.prototype.addPage;
  let page = 0;
  const placed = [];
  const textSpy = jest
    .spyOn(PDFDocument.prototype, "text")
    .mockImplementation(function textImpl(text, ...rest) {
      placed.push({
        text: String(text ?? ""),
        page,
        y: typeof rest[1] === "number" ? rest[1] : null,
      });
      return originalText.call(this, text, ...rest);
    });
  const addSpy = jest
    .spyOn(PDFDocument.prototype, "addPage")
    .mockImplementation(function addPageImpl(...args) {
      page += 1;
      return originalAddPage.apply(this, args);
    });
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return { placed, pages: page };
  } finally {
    textSpy.mockRestore();
    addSpy.mockRestore();
  }
};

const pageOf = (placed, text) => placed.find((p) => p.text === text)?.page;
const yOf = (placed, text) => placed.find((p) => p.text === text)?.y;
const PAGE_BOTTOM = 595 - 18;

beforeEach(() => jest.clearAllMocks());

describe("drawPage3 — uzun izohda sahifa uzilishi", () => {
  test("sahifalar soni portlamaydi (ilgari 7+ deyarli bo'sh sahifa)", async () => {
    const { pages } = await renderPlaced(lpFixture(LONG_COMMENT));
    expect(pages).toBeLessThanOrEqual(4);
  });

  test("tarkibiy jadval BO'LINMAYDI — sarlavha va JAMI bir sahifada", async () => {
    const { placed } = await renderPlaced(lpFixture(LONG_COMMENT));
    const head = pageOf(placed, "O'quv jarayonining tarkibiy qismlari");
    const jami = pageOf(placed, "JAMI");
    expect(head).toBeDefined();
    expect(jami).toBe(head);
    expect(yOf(placed, "JAMI")).toBeLessThanOrEqual(PAGE_BOTTOM - 18);
  });

  test("imzolar bloki BO'LINMAYDI — lavozimlar va 'Kadrlar buyurtmachisi:' bir sahifada", async () => {
    const { placed } = await renderPlaced(lpFixture(LONG_COMMENT));
    const first = pageOf(placed, "O'quv ishlari bo'yicha prorektor");
    const last = pageOf(placed, "Kadrlar buyurtmachisi:");
    expect(first).toBeDefined();
    expect(last).toBe(first);
    expect(yOf(placed, "Kadrlar buyurtmachisi:")).toBeLessThanOrEqual(PAGE_BOTTOM - 40);
  });

  test("qisqa izoh — avvalgidek bitta qo'shimcha sahifa yetadi (regressiya yo'q)", async () => {
    const { pages, placed } = await renderPlaced(lpFixture("Izoh"));
    expect(pages).toBeLessThanOrEqual(3);
    expect(pageOf(placed, "Kadrlar buyurtmachisi:")).toBe(
      pageOf(placed, "O'quv jarayonining tarkibiy qismlari"),
    );
  });
});
