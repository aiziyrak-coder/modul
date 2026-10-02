const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const LEFT = 18;
const RIGHT = 18 + 806;
const BOX_AND_GAP = 18;

const KEYS = [
  { key: " ", title: "Nazariy va amaliy ta'lim" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish" },
  { key: "M", title: "Malakaviy amaliyot" },
  { key: "T", title: "Ta'til" },
];

const lpFixture = () => ({
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  keys: KEYS,
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sentabr", weeks: [1, 2, 3, 4].map((week) => ({ week, key: "" })) }],
      weeks: {},
      total: 40,
      statistics: [],
    },
  ],
  allValues: { total: 40, statistics: [] },
});

const renderCalls = async () => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lpFixture(),
    blocks: [],
    meta: {},
  });
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
  const original = PDFDocument.prototype.text;
  const calls = [];
  const spy = jest
    .spyOn(PDFDocument.prototype, "text")
    .mockImplementation(function (str, ...rest) {
      if (typeof str === "string") {
        calls.push({ str, fs: this._fontSize, x: rest[0], w: this.widthOfString(str) });
      }
      return original.call(this, str, ...rest);
    });
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return calls;
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("drawPage1 — sarlavha", () => {
  test("vazirlik va institut qatorlari bir xil o'lchamda (9.5pt)", async () => {
    const calls = await renderCalls();
    const title = calls.slice(0, 3);
    expect(title.every((c) => c.str.trim().length > 0)).toBe(true);
    expect(title.map((c) => c.fs)).toEqual([9.5, 9.5, 9.5]);
  });
});

describe("drawPage1 — jadval sarlavhasi", () => {
  test("matnlar ~1pt kattaroq; vertikal nomlar 6.5pt'da kichraymasdan sig'adi", async () => {
    const calls = await renderCalls();
    const fsOf = (s) => calls.find((c) => c.str === s)?.fs;
    expect(fsOf("Kurs")).toBe(8);
    expect(fsOf("Haftalar")).toBe(8);
    expect(fsOf("Sentabr")).toBe(7);
    expect(fsOf("1")).toBe(6);
    expect(calls.find((c) => c.str.startsWith("O'quv jarayoni,"))?.fs).toBe(6);
    expect(fsOf("shundan")).toBe(6);
    for (const label of [
      "Jami",
      "Nazariy va amaliy ta'lim",
      "Attestatsiyalar",
      "Kredit ta'lim tizimiga kirish",
      "Malakaviy amaliyot",
      "Yakuniy davlat attestatsiyasi",
      "Ta'til haftalar soni",
      "GPA ko'rsatkichini hisoblash",
      "Hammasi",
    ]) {
      expect({ label, fs: fsOf(label) }).toEqual({ label, fs: 6.5 });
    }
  });
});

describe("drawPage1 — legenda", () => {
  test("oraliq 16pt, qator markazda va jadval chetidan chiqmaydi", async () => {
    const calls = await renderCalls();
    const titles = KEYS.map((k) => k.title);
    const items = calls.filter((c) => titles.includes(c.str) && c.fs >= 8);
    expect(items.map((c) => c.str)).toEqual(titles);

    const gaps = items.slice(1).map((c, i) => c.x - BOX_AND_GAP - (items[i].x + items[i].w));
    for (const g of gaps) expect(g).toBeCloseTo(16, 5);

    const start = items[0].x - BOX_AND_GAP;
    const end = items[items.length - 1].x + items[items.length - 1].w;
    expect(start).toBeGreaterThanOrEqual(LEFT);
    expect(end).toBeLessThanOrEqual(RIGHT);
    expect(Math.abs(start - LEFT - (RIGHT - end))).toBeLessThan(0.01);
  });
});
