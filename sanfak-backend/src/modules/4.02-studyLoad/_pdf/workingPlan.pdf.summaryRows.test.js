const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/learningProcess/learningProcess.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const LearningProcessModel = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const LP_ID = new mongoose.Types.ObjectId();

const statistics = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 6 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit", value: 1 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 4 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "YDA", value: 0 },
  { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til", value: 10 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA", value: 1 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 52 },
];

const SUMMARY_ROWS = [
  { key: " ", title: "Nazariy va amaliy ta’lim" },
  { key: "M", title: "Amaliyot" },
  { key: "A", title: "Attestatsiyalar" },
  { key: "D", title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi" },
  { key: "T", title: "Ta’til haftalari" },
  { key: "K", title: "Kredit ta’lim tizimiga kirish" },
  { key: "G", title: "GPA ko’rsatkichini hisoblash" },
];

const wsFixture = (extra = {}) => ({
  agreed: {},
  confirmation: {},
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2026/2027" },
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  desc: null,
  courses: [{ course: "I", courseNum: 1, weeks: {}, total: 41, statistics: statistics() }],
  keys: [],
  attestationNote: "Attestatsiya matni",
  allValues: { total: 41, statistics: statistics() },
  comment: null,
  ...extra,
});

const mockLp = (lp) => {
  LearningProcessModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(lp),
  });
};

const render = async (ws) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(ws);
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();
    return spy.mock.calls.map((c) => c[0]);
  } finally {
    spy.mockRestore();
  }
};

const tableFlow = (texts) => texts.slice(texts.lastIndexOf("Davlat attestatsiyasi") + 1);

beforeEach(() => {
  jest.clearAllMocks();
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue({ workingSchedule: "wsId", semesters: null }),
  });
  mockLp({ attestationNote: null });
});

const XULOSA_FLOW = [
  "Attestatsiya matni",
  "Nazariy va amaliy ta'lim", "30", "1-2",
  "Amaliyot", "4", "1-2",
  "Attestatsiyalar", "6", "1-2",
  "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", "-",
  "Ta'til haftalari", "10", "1-2",
  "Kredit ta'lim tizimiga kirish", "1", "1",
  "GPA ko'rsatkichini hisoblash", "1", "2",
  "Jami", "52",
];

describe("workingPlan PDF — tarkibiy qismlar Xulosa tartibi/nomi (ADR-040)", () => {
  test("ws.summaryRows — Xulosa nomi/tartibi, qiymat+semestr o'z qatorida, Jami oxirida", async () => {
    const texts = await render(wsFixture({ summaryRows: SUMMARY_ROWS, learningProcess: LP_ID }));
    expect(tableFlow(texts).slice(0, XULOSA_FLOW.length)).toEqual(XULOSA_FLOW);
    expect(LearningProcessModel.findById).not.toHaveBeenCalled();
  });

  test("ws surati yo'q — LP.summaryRows (yengil select) ishlatiladi", async () => {
    mockLp({ attestationNote: null, summaryRows: SUMMARY_ROWS });
    const texts = await render(wsFixture({ learningProcess: LP_ID }));
    expect(LearningProcessModel.findById).toHaveBeenCalledWith(LP_ID);
    expect(tableFlow(texts).slice(0, XULOSA_FLOW.length)).toEqual(XULOSA_FLOW);
  });

  test("eski hujjat (ws va LP'da yo'q) — eski qat'iy nom/tartib, chiqish bir xil", async () => {
    const old = await render(wsFixture());
    expect(tableFlow(old).slice(0, 10)).toEqual([
      "Attestatsiya matni",
      "Nazariy va amaliy ta'lim", "30", "1-2",
      "Attestatsiyalar", "6", "1-2",
      "Kredit ta'lim tizimiga kirish", "1", "1",
    ]);
    expect(await render(wsFixture({ summaryRows: null, learningProcess: LP_ID }))).toEqual(old);
    expect(await render(wsFixture({ summaryRows: [] }))).toEqual(old);
  });
});
