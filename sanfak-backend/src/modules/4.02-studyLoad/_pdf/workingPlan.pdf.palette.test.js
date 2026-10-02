const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const MID = "#b6e5f3";
const WHITE = "#ffffff";

const sciences = () => [
  { code: "FA1001", title: "Fan nomi 1", totalCredit: 2, weeklyHours: 2, evaluationType: null },
  { code: "FA1002", title: "Fan nomi 2", totalCredit: 2, weeklyHours: 2, evaluationType: null },
];

const wpFixture = () => {
  const semesters = new Map();
  for (const sem of ["1", "2"]) {
    semesters.set(sem, {
      blocks: [{ blockCode: "MFI", title: "Majburiy fanlar", sciences: sciences() }],
    });
  }
  return { _id: "wp1", workingSchedule: "ws1", semesters, studyPlanLabel: null };
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  stage: "I",
  desc: null,
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: 9, weeks: [{ key: "" }, { key: "" }] }],
      total: 2,
      statistics: [],
    },
  ],
  keys: [],
  statistics: {},
  attestationNote: null,
  allValues: { total: 2, statistics: [] },
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const renderFills = async () => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture()),
  });
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(wsFixture());
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);

  const fills = [];
  let lastH = null;
  let lastW = null;
  const realRect = PDFDocument.prototype.rect;
  const realFill = PDFDocument.prototype.fill;
  PDFDocument.prototype.rect = function (x, y, w, h) {
    lastH = h;
    lastW = w;
    return realRect.call(this, x, y, w, h);
  };
  PDFDocument.prototype.fill = function (color) {
    fills.push({ h: lastH, w: lastW, color });
    return realFill.call(this, color);
  };
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    doc.end();
    await done;
    return fills;
  } finally {
    PDFDocument.prototype.rect = realRect;
    PDFDocument.prototype.fill = realFill;
  }
};

beforeEach(() => jest.clearAllMocks());

describe("N-07 — rang xaritasi: bitta ohang (C.mid), faqat namunadagi joylarda", () => {
  test("butun hujjatda faqat ikkita fon rangi bor: C.mid yoki oq (hech qachon eski dark/accent/light)", async () => {
    const fills = await renderFills();
    expect(fills.length).toBeGreaterThan(0);
    const colors = new Set(fills.map((f) => f.color));
    for (const c of colors) {
      expect([MID, WHITE]).toContain(c);
    }
  });

  test("taqvim sarlavhalari RANGSIZ — SUBHDR_H(26)/GT(16,w=110) balandlikda fill() chaqirilmaydi (TITLE_H endi band/ramkasiz — rect() umuman chaqirilmaydi, N-07b)", async () => {
    const fills = await renderFills();
    expect(fills.some((f) => f.h === 26)).toBe(false);
    expect(fills.some((f) => f.h === 16 && f.w === 110)).toBe(false);
  });

  test("semestr jadvalining VERTIKAL ustun sarlavha kataklari RANGSIZ — COL_H+span*GRP_H (48/57/66) balandlikda fill() chaqirilmaydi", async () => {
    const fills = await renderFills();
    expect(fills.some((f) => f.h === 48)).toBe(false);
    expect(fills.some((f) => f.h === 57)).toBe(false);
    expect(fills.some((f) => f.h === 66)).toBe(false);
  });

  test("ustun raqamlari qatori (SEM_NUM_H=7) C.mid bilan bo'yaladi", async () => {
    const fills = await renderFills();
    const numRow = fills.filter((f) => f.h === 7);
    expect(numRow.length).toBeGreaterThan(0);
    expect(numRow.every((f) => f.color === MID)).toBe(true);
  });
});
