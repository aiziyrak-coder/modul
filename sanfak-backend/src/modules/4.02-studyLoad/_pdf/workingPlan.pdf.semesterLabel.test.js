const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const chain = (doc) => {
  const c = {};
  c.populate = jest.fn().mockReturnValue(c);
  c.exec = jest.fn().mockResolvedValue(doc);
  return c;
};

const ws = (o = {}) => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2027/2028" },
  stage: "III",
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  desc: null,
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
  ...o,
});

const renderTexts = async (wsDoc) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({
      workingSchedule: new mongoose.Types.ObjectId(),
      semesters: null,
      studyPlanLabel: null,
    }),
  });
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain(wsDoc));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("workingPlan PDF — semestr raqami bosqichga qarab", () => {
  test("III bosqich (currentCourse=3) → 5-SEMESTR / 6-SEMESTR", async () => {
    const texts = await renderTexts(ws({ currentCourse: 3 }));
    expect(texts).toContain("5-SEMESTR");
    expect(texts).toContain("6-SEMESTR");
    expect(texts).not.toContain("1-SEMESTR");
    expect(texts).not.toContain("2-SEMESTR");
  });

  test("VI bosqich (currentCourse=6) → 11-SEMESTR / 12-SEMESTR", async () => {
    const texts = await renderTexts(ws({ stage: "VI", currentCourse: 6 }));
    expect(texts).toContain("11-SEMESTR");
    expect(texts).toContain("12-SEMESTR");
  });

  test("I bosqich (currentCourse=1) → 1-SEMESTR / 2-SEMESTR (o'zgarmaydi)", async () => {
    const texts = await renderTexts(ws({ stage: "I", currentCourse: 1 }));
    expect(texts).toContain("1-SEMESTR");
    expect(texts).toContain("2-SEMESTR");
  });

  test("currentCourse yo'q (eski hujjat) → lokal raqam qoladi, bo'sh yorliq yo'q", async () => {
    const texts = await renderTexts(ws({ currentCourse: undefined }));
    expect(texts).toContain("1-SEMESTR");
    expect(texts).toContain("2-SEMESTR");
    expect(texts).not.toContain("null-SEMESTR");
    expect(texts).not.toContain("undefined-SEMESTR");
  });

  test("'O'quv jarayonining tarkibiy qismlari' — Semestr ustuni ham global (III: 5-6 / 5 / 6)", async () => {
    const texts = await renderTexts(ws({ currentCourse: 3 }));
    expect(texts).toContain("5-6");
    expect(texts).not.toContain("1-2");
    expect(texts).toContain("5");
    expect(texts).toContain("6");
  });
});
