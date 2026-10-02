const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const CW = 818;
const MID = "#b6e5f3";

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

const renderRects = async () => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture()),
  });
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(wsFixture());
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);

  const rects = [];
  const fills = [];
  let last = null;
  const realRect = PDFDocument.prototype.rect;
  const realFill = PDFDocument.prototype.fill;
  PDFDocument.prototype.rect = function (x, y, w, h) {
    last = { x, y, w, h };
    rects.push(last);
    return realRect.call(this, x, y, w, h);
  };
  PDFDocument.prototype.fill = function (color) {
    fills.push({ ...last, color });
    return realFill.call(this, color);
  };
  try {
    const doc = await buildWorkingRejaDoc("wp1");
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    doc.end();
    await done;
    return { rects, fills };
  } finally {
    PDFDocument.prototype.rect = realRect;
    PDFDocument.prototype.fill = realFill;
  }
};

beforeEach(() => jest.clearAllMocks());

describe("N-07b — bo'lim sarlavhalari band/ramka YO'Q (oddiy markazlangan matn)", () => {
  test("hech qanday rect() to'liq kontent kengligida (CW=818) PASTKI (≤13pt) balandlikda chaqirilmaydi", async () => {
    const { rects } = await renderRects();
    expect(rects.length).toBeGreaterThan(0);
    const fullWidthShort = rects.filter((r) => r.w === CW && r.h <= 13);
    expect(fullWidthShort).toEqual([]);
  });
});

describe("N-07b — semestr jadvali yangi zichlik konstantalari", () => {
  test("semestr sarlavha qatori ('1-SEMESTR' banneri) SEM_LABEL_H=9 balandlikda", async () => {
    const { rects } = await renderRects();
    const labelBars = rects.filter((r) => r.w === 407 && r.h === 9);
    expect(labelBars.length).toBeGreaterThanOrEqual(2);
  });

  test("rotated ustun sarlavha kataklari YANGI balandliklarda (48/57/66) chiziladi", async () => {
    const { rects } = await renderRects();
    for (const h of [48, 57, 66]) {
      expect(rects.some((r) => r.h === h)).toBe(true);
    }
  });

  test("qisqa nomli fan qatori MIN balandlikda (SEM_ROW_H=16) — 22 ENDI ishlatilmaydi", async () => {
    const { rects } = await renderRects();
    expect(rects.some((r) => r.h === 16)).toBe(true);
    expect(rects.some((r) => r.h === 22)).toBe(false);
  });

  const SEM_TAIL_LABEL_W = 138;

  test("'Jami' uchligi mustaqil SEM_TOTAL_ROW_H=13 balandlikda, C.mid bilan bo'yaladi", async () => {
    const { fills } = await renderRects();
    const totalRows = fills.filter((f) => f.h === 13 && f.w === SEM_TAIL_LABEL_W);
    expect(totalRows.length).toBeGreaterThan(0);
    expect(totalRows.every((f) => f.color === MID)).toBe(true);
  });
});
