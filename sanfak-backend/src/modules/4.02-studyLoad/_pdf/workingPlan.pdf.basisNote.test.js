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

const wsFixture = (desc) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  desc,
  courses: [],
  keys: [],
  statistics: {},
  attestationNote: null,
  allValues: {},
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const renderTexts = async (desc) => {
  WorkingScheduleModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wsFixture(desc)));
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

describe("workingPlan PDF — 'asos' izohi (ws.desc ← learningProcess.basisNote)", () => {
  const ASOS = "TDTU tomonidan 2025-yil tasdiqlangan o'quv reja asosida ishlab chiqilgan";

  test("izoh bor — QAVS ichida chiziladi", async () => {
    const texts = await renderTexts(ASOS);
    expect(texts).toContain(`(${ASOS})`);
  });

  test("izoh yo'nalish qatoridan KEYIN chiziladi (sarlavhalar tagida)", async () => {
    const texts = await renderTexts(ASOS);
    const dirIdx = texts.findIndex(
      (t) => typeof t === "string" && t.includes("Davolash ishi"),
    );
    const descIdx = texts.indexOf(`(${ASOS})`);
    expect(dirIdx).toBeGreaterThanOrEqual(0);
    expect(descIdx).toBeGreaterThan(dirIdx);
  });

  test("izoh yo'q (null) — BO'SH QAVS chiqmaydi", async () => {
    const texts = await renderTexts(null);
    expect(texts).not.toContain("()");
    expect(texts.some((t) => t === "( )" || t === "(null)")).toBe(false);
  });

  test("izoh bo'sh satr — qavs chiqmaydi (falsy qorovuli)", async () => {
    const texts = await renderTexts("");
    expect(texts).not.toContain("()");
  });

  test("eski hujjat (desc maydoni umuman yo'q) — portlamaydi, qavs yo'q", async () => {
    const texts = await renderTexts(undefined);
    expect(texts).not.toContain("()");
    expect(texts.length).toBeGreaterThan(0);
  });
});
