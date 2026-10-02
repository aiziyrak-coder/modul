const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildWorkingRejaDoc } = require("./workingPlan.pdf");

const particle = (h) => [
  { canonical: "hour", value: h },
  { canonical: "lecture", value: 10 },
  { canonical: "practical", value: 14 },
  { canonical: "independent", value: 30 },
];

const sci = (code, title) => ({
  code,
  title,
  particle: particle(60),
  totalCredit: 2,
  weeklyHours: 2,
  evaluationType: null,
});

const wpFixture = (practiceRows) => {
  const semesters = new Map();
  for (const sem of ["1", "2"]) {
    const blocks = [
      {
        blockCode: "MFI",
        title: "Majburiy fanlar",
        sciences: [sci("FA1001", "Oddiy fan")],
      },
    ];
    if (sem === "1" && practiceRows.length) {
      blocks.push({
        blockCode: "MA",
        title: "Malakaviy amaliyot",
        sciences: practiceRows.map(([c, t]) => sci(c, t)),
      });
    }
    semesters.set(sem, { blocks });
  }
  return { _id: "wp1", workingSchedule: "ws1", semesters, studyPlanLabel: null };
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: null,
  educationForm: null,
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2030/2031" },
  stage: "VI",
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
});

const chain = (doc) => {
  const c = {};
  c.populate = jest.fn().mockReturnValue(c);
  c.exec = jest.fn().mockResolvedValue(doc);
  return c;
};

const renderTexts = async (practiceRows) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture(practiceRows)),
  });
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain(wsFixture()));
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

describe("workingPlan — amaliyot qatori sarlavhasi", () => {
  test("semestrda amaliyot bor — nom O'SHA fandan olinadi", async () => {
    const texts = await renderTexts([["BOM604", "Bitiruv oldi amaliyoti"]]);

    expect(texts).toContain("Malakaviy amaliyot (Bitiruv oldi amaliyoti)");
    expect(texts).not.toContain("Malakaviy amaliyot (Tanishuv amaliyoti)");
  });

  test("bir nechta amaliyot — nomlar vergul bilan sanaladi", async () => {
    const texts = await renderTexts([
      ["TM104", "Tanishuv amaliyoti"],
      ["ICHM206", "Ishlab chiqarish amaliyoti"],
    ]);

    expect(texts).toContain(
      "Malakaviy amaliyot (Tanishuv amaliyoti, Ishlab chiqarish amaliyoti)",
    );
  });

  test("amaliyot yo'q — qavssiz umumiy sarlavha", async () => {
    const texts = await renderTexts([]);

    expect(texts).toContain("Malakaviy amaliyot");
    expect(texts.some((t) => t.startsWith("Malakaviy amaliyot ("))).toBe(false);
  });
});

describe("workingPlan — namuna blanka qatorlari", () => {
  test("amaliyot krediti 'Jami' ga kirmaydi, 'Jami semestrda' ga kiradi", async () => {
    const texts = await renderTexts([["BOM604", "Bitiruv oldi amaliyoti"]]);

    expect(texts).toContain("4");
  });

  test("ustun raqamlari qatori — o'ng jadval 13 dan 24 gacha", async () => {
    const texts = await renderTexts([]);

    expect(texts).toContain("13");
    expect(texts).toContain("24");
  });

  test("\"Jami o'quv yilida\" qatori AYNAN bir marta (faqat o'ng jadval)", async () => {
    const texts = await renderTexts([]);

    expect(texts.filter((t) => t === "Jami o'quv yilida")).toHaveLength(1);
    expect(texts.filter((t) => t === "Jami semestrda")).toHaveLength(2);
  });
});

describe("workingPlan — amaliyot qatori matni KESILMAYDI (T-02)", () => {
  const renderTextCalls = async (practiceRows) => {
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(wpFixture(practiceRows)),
    });
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain(wsFixture()));
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildWorkingRejaDoc("wp1");
      doc.end();
      return spy.mock.calls.map((c) => ({ str: c[0], opts: c[3] || {} }));
    } finally {
      spy.mockRestore();
    }
  };
  const SHORT_ROW_H = 13;

  test("uzun sarlavha — o'raladi (lineBreak) va katak balandligi 13pt dan katta", async () => {
    const calls = await renderTextCalls([
      ["BAKYDA604", "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi"],
    ]);
    const label = calls.find((c) => String(c.str).startsWith("Malakaviy amaliyot ("));

    expect(label).toBeDefined();
    expect(label.opts.lineBreak).toBe(true);
    expect(label.opts.ellipsis).toBeUndefined();
    expect(label.opts.height).toBeGreaterThan(SHORT_ROW_H);
  });

  test("qisqa sarlavha — MIN balandlik (13pt) saqlanadi", async () => {
    const calls = await renderTextCalls([["BOM604", "Bitiruv oldi amaliyoti"]]);
    const label = calls.find((c) => String(c.str).startsWith("Malakaviy amaliyot ("));

    expect(label).toBeDefined();
    expect(label.opts.height).toBe(SHORT_ROW_H);
  });
});
