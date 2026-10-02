const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const WS_ID = new mongoose.Types.ObjectId();

const simpleFind = (resolvedDoc) => ({
  exec: jest.fn().mockResolvedValue(resolvedDoc),
});

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const wsFixture = (comment) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  desc: null,
  courses: [],
  keys: [],
  statistics: {},
  attestationNote: null,
  allValues: {},
  comment,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const renderTexts = async (comment) => {
  WorkingScheduleModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wsFixture(comment)));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wpId");
    doc.end();
    return spy.mock.calls.map((c) => c[0]);
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => {
  jest.clearAllMocks();
  WorkingPlanModel.findById = jest.fn().mockReturnValue(
    simpleFind({ workingSchedule: WS_ID, semesters: null, studyPlanLabel: null }),
  );
});

describe("workingPlan PDF — Izoh matnida tab belgilari", () => {
  test("tab ketma-ketligi bitta bo'shliq, qatorlar (\\n) alohida band bo'lib qoladi", async () => {
    const texts = await renderTexts("Prorektor\t\t\tSh.A.Boymuradov\nDekan\tB.T.Xolmatova");
    expect(texts).toContain("Prorektor Sh.A.Boymuradov");
    expect(texts).toContain("Dekan B.T.Xolmatova");
    expect(texts.some((t) => typeof t === "string" && /[\t\v\f]/.test(t))).toBe(false);
  });

  test("tabsiz izoh — avvalgidek, o'zgarmagan holda", async () => {
    const texts = await renderTexts("1) 1 kredit 30 akademik soatni tashkil qiladi.");
    expect(texts).toContain("1) 1 kredit 30 akademik soatni tashkil qiladi.");
  });
});
