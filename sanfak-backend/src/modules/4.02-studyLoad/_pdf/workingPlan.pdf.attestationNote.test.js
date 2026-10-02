const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/learningProcess/learningProcess.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const LearningProcessModel = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const DEFAULT_TEXT = "Ixtisoslik fanlaridan integrallashgan yakuniy davlat attestatsiyasi";
const WS_TEXT = "Ixtisoslik fanlaridan birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi";
const LP_TEXT = "Integrallashgan yakuniy davlat attestatsiyasi LP";
const LP_ID = new mongoose.Types.ObjectId();

const wsFixture = (extra) => ({
  agreed: {},
  confirmation: {},
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  desc: null,
  courses: [],
  keys: [],
  allValues: {},
  comment: null,
  ...extra,
});

const mockLpFind = (impl) => {
  LearningProcessModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(impl),
  });
};

const renderTexts = async (ws) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(ws);
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);
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
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({ workingSchedule: "wsId", semesters: null }),
  });
  mockLpFind(async () => ({ attestationNote: LP_TEXT }));
});

describe("workingPlan PDF — Davlat attestatsiyasi matni (ADR-038)", () => {
  test("ws.attestationNote bor — u chiziladi; LP o'qilmaydi, default yo'q", async () => {
    const texts = await renderTexts(
      wsFixture({
        attestationNote: WS_TEXT,
        summaryRows: [{ key: "M", title: "Amaliyot" }],
        learningProcess: LP_ID,
      }),
    );
    expect(texts).toContain(WS_TEXT);
    expect(texts).not.toContain(DEFAULT_TEXT);
    expect(LearningProcessModel.findById).not.toHaveBeenCalled();
  });

  test("ws null + LP'da matn — LP matni chiziladi", async () => {
    const texts = await renderTexts(
      wsFixture({ attestationNote: null, learningProcess: LP_ID }),
    );
    expect(LearningProcessModel.findById).toHaveBeenCalledWith(LP_ID);
    expect(texts).toContain(LP_TEXT);
    expect(texts).not.toContain(DEFAULT_TEXT);
  });

  test("ws null + LP'da ham yo'q — default", async () => {
    mockLpFind(async () => ({ attestationNote: null }));
    const texts = await renderTexts(
      wsFixture({ attestationNote: null, learningProcess: LP_ID }),
    );
    expect(texts).toContain(DEFAULT_TEXT);
  });

  test("learningProcess ref yo'q — so'rov yo'q, default", async () => {
    const texts = await renderTexts(wsFixture({ attestationNote: null }));
    expect(LearningProcessModel.findById).not.toHaveBeenCalled();
    expect(texts).toContain(DEFAULT_TEXT);
  });

  test("LP o'qish xatosi — PDF yiqilmaydi, default", async () => {
    mockLpFind(async () => {
      throw new Error("db down");
    });
    const texts = await renderTexts(
      wsFixture({ attestationNote: null, learningProcess: LP_ID }),
    );
    expect(texts).toContain(DEFAULT_TEXT);
  });
});
