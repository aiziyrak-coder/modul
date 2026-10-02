const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const WS_ID = new mongoose.Types.ObjectId();

const simpleFind = (doc) => ({ exec: jest.fn().mockResolvedValue(doc) });
const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const statistics = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 6 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit ta'lim tizimiga kirish", value: 1 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 4 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: 0 },
  { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til haftalari soni", value: 10 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA ko'rsatkichini hisoblash", value: 1 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 52 },
];
const EXPECTED_JAMI = 52;

const wsFixture = (overrides = {}) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  desc: null,
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sen", weeks: [{ week: 1, key: "T" }] }],
      weeks: { 1: "T" },
      total: 41,
      statistics: statistics(),
    },
  ],
  keys: [{ key: "A", title: "Attestatsiyalar" }],
  attestationNote: null,
  allValues: { total: 41, statistics: statistics() },
  comment: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
  ...overrides,
});

const render = async (ws) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue(
    simpleFind({ workingSchedule: WS_ID, semesters: null, studyPlanLabel: null }),
  );
  WorkingScheduleModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(ws));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
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

describe("drawCalendar — kurs qatoridagi statistika bloki", () => {
  test("massiv slug bo'yicha o'qiladi — kataklar to'ladi", async () => {
    const texts = await render(wsFixture());
    expect(hasRun(texts, ["41", "30", "6", "1", "4", "10", "1", "52"])).toBe(true);
  });

  test("buzuq holat QAYTA CHIQMAYDI — hafta kalitidan keyin darhol 'Jami' emas", async () => {
    const texts = await render(wsFixture());
    expect(hasRun(texts, ["41", "52"])).toBe(false);
  });

  test("legacy obyekt shakli ham ishlaydi (eski hujjatlar buzilmasin)", async () => {
    const ws = wsFixture();
    ws.courses[0].statistics = { theoreticalPractical: 30, certification: 6 };
    const texts = await render(ws);
    expect(hasRun(texts, ["41", "30", "6"])).toBe(true);
  });
});

describe("drawProcessTable — 'Haftalar soni' ustuni", () => {
  test("qiymatlar `courses[0].statistics` dan o'qiladi (`ws.statistics` sxemada yo'q)", async () => {
    const texts = await render(wsFixture());
    expect(hasRun(texts, ["Nazariy va amaliy ta'lim", "30", "1-2"])).toBe(true);
    expect(hasRun(texts, ["Attestatsiyalar", "6", "1-2"])).toBe(true);
    expect(hasRun(texts, ["Kredit ta'lim tizimiga kirish", "1", "1"])).toBe(true);
    expect(hasRun(texts, ["Malakaviy amaliyot", "4", "1-2"])).toBe(true);
    expect(hasRun(texts, ["Ta'til haftalari", "10", "1-2"])).toBe(true);
    expect(hasRun(texts, ["GPA ko'rsatgichini hisoblash", "1", "2"])).toBe(true);
  });

  test("'Jami' katagi 'hammasi' (52) dan keladi — `allValues.total` (41) EMAS", async () => {
    const texts = await render(wsFixture());
    expect(hasRun(texts, ["Jami", String(EXPECTED_JAMI)])).toBe(true);
    expect(hasRun(texts, ["GPA ko'rsatgichini hisoblash", "1", "2", "Jami", "41"])).toBe(false);
  });

  test("courses bo'sh bo'lsa `allValues.statistics` ga tushadi", async () => {
    const ws = wsFixture({ courses: [] });
    const texts = await render(ws);
    expect(hasRun(texts, ["Nazariy va amaliy ta'lim", "30", "1-2"])).toBe(true);
  });

  test("statistics umuman bo'lmasa — yiqilmaydi, kataklar bo'sh qoladi", async () => {
    const ws = wsFixture({ courses: [], allValues: {} });
    const texts = await render(ws);
    expect(hasRun(texts, ["Nazariy va amaliy ta'lim", "1-2"])).toBe(true);
  });
});
