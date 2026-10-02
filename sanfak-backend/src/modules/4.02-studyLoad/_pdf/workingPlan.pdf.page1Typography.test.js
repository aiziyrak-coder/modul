const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const LEFT = 12;
const RIGHT = 12 + 818;
const BOX_AND_GAP = 18;

const KEYS = [
  { key: " ", title: "Nazariy va amaliy ta'lim" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish" },
  { key: "M", title: "Malakaviy amaliyot" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
  { key: "T", title: "Ta'til" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash" },
];

const chain = (doc) => {
  const c = {};
  c.populate = jest.fn().mockReturnValue(c);
  c.exec = jest.fn().mockResolvedValue(doc);
  return c;
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  stage: "I",
  direction: { title: "Stomatologiya", directionCode: "60910100" },
  desc: null,
  courses: [
    {
      course: "I",
      months: [{ month: 9, weeks: [1, 2, 3, 4].map((week) => ({ week, key: "" })) }],
      statistics: [],
      total: 40,
    },
  ],
  keys: KEYS,
  statistics: {},
  attestationNote: null,
  allValues: {},
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const renderCalls = async () => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      workingSchedule: new mongoose.Types.ObjectId(),
      semesters: null,
      studyPlanLabel: null,
    }),
  });
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain(wsFixture()));
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
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    return calls;
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("workingPlan 1-bet — sarlavha markazi", () => {
  test("vazirlik, institut, o'quv yili, bosqich va yo'nalish bir xil (9pt), sarlavha 12pt", async () => {
    const calls = await renderCalls();
    const fsOf = (s) => calls.find((c) => c.str === s)?.fs;
    for (const line of [
      "O'ZBEKISTON RESPUBLIKASI SOG'LIQNI SAQLASH VAZIRLIGI",
      "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI",
      "2025/2026 o'quv yili",
      "I bosqich",
      "Ta'lim yo'nalishi:",
      '60910100 – "Stomatologiya"',
    ]) {
      expect({ line, fs: fsOf(line) }).toEqual({ line, fs: 9 });
    }
    expect(fsOf("ISHCHI O'QUV REJA")).toBe(12);
  });
});

describe("workingPlan 1-bet — taqvim sarlavhasi", () => {
  test("matnlar ~1pt kattaroq va kichraymaydi (kerak joyda 2 qatorga o'raladi)", async () => {
    const calls = await renderCalls();
    const fsOf = (s) => calls.find((c) => c.str === s)?.fs;
    expect(fsOf("Kurs")).toBe(7);
    expect(fsOf("Haftalar")).toBe(8);
    expect(fsOf("Sentyabr")).toBe(8);
    expect(fsOf("1")).toBe(6.5);
    expect(fsOf("O'quv jarayoni,\nhaftalari soni:")).toBe(7);
    expect(fsOf("shundan")).toBe(7);
    for (const line of [
      "Jami",
      "Nazariy va",
      "amaliy ta'lim",
      "Attestatsiyalar",
      "Kredit ta'lim",
      "tizimiga kirish",
      "Malakaviy",
      "amaliyot",
      "Yakuniy davlat",
      "attestatsiyasi",
      "Ta'til haftalar soni",
      "GPA ko'rsatkichini",
      "hisoblash",
      "Hammasi",
    ]) {
      expect({ line, fs: fsOf(line) }).toEqual({ line, fs: 7 });
    }
  });
});

describe("workingPlan 1-bet — legenda", () => {
  test("oraliq 16pt, qator markazda va jadval chetidan chiqmaydi", async () => {
    const calls = await renderCalls();
    const titles = KEYS.map((k) => k.title);
    const items = calls.filter((c) => titles.includes(c.str) && c.fs >= 7.4);
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
