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
  academicYear: { _id: new mongoose.Types.ObjectId(), title: "2025/2026" },
  stage: "I",
  direction: { title: "Stomatologiya", directionCode: "60910100" },
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
    exec: jest.fn().mockResolvedValue({ workingSchedule: new mongoose.Types.ObjectId(), semesters: null, studyPlanLabel: null }),
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

describe("workingPlan 1-bet markaz bloki — blankadek to'liq matn (A3b)", () => {
  test("o'quv yili qo'shimchasi: '2025/2026 o'quv yili'", async () => {
    const texts = await renderTexts(ws());
    expect(texts).toContain("2025/2026 o'quv yili");
    expect(texts).not.toContain("2025/2026");
  });

  test("bosqich qo'shimchasi: 'I' → 'I bosqich'; 'III' → 'III bosqich'", async () => {
    expect(await renderTexts(ws({ stage: "I" }))).toContain("I bosqich");
    expect(await renderTexts(ws({ stage: "III" }))).toContain("III bosqich");
  });

  test("bazada allaqachon 'II bosqich' bo'lsa — ikki marta qo'shilmaydi", async () => {
    const texts = await renderTexts(ws({ stage: "II bosqich" }));
    expect(texts).toContain("II bosqich");
    expect(texts).not.toContain("II bosqich bosqich");
  });

  test("yo'nalish ikki qatorda: 'Ta'lim yo'nalishi:' + '60910100 – \"Stomatologiya\"'", async () => {
    const texts = await renderTexts(ws());
    expect(texts).toContain("Ta'lim yo'nalishi:");
    expect(texts).toContain('60910100 – "Stomatologiya"');
  });

  test("kodsiz yo'nalish — faqat qo'shtirnoqdagi nom (yolg'iz tire yo'q)", async () => {
    const texts = await renderTexts(ws({ direction: { title: "Davolash ishi", directionCode: "" } }));
    expect(texts).toContain('"Davolash ishi"');
    expect(texts.some((t) => t.startsWith(" – ") || t.startsWith("– "))).toBe(false);
  });

  test("izoh (basisNote → ws.desc) qavsda, yo'nalishdan keyin", async () => {
    const note = "Toshkent davlat tibbiyot universiteti tomonidan 2025-yil tasdiqlangan o'quv reja asosida ishlab chiqilgan";
    const texts = await renderTexts(ws({ desc: note }));
    const i = texts.indexOf('60910100 – "Stomatologiya"');
    const j = texts.indexOf(`(${note})`);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(j).toBeGreaterThan(i);
  });
});

describe("B2-1 — direction populate `directionCode`ni o'z ichiga oladi", () => {
  test(".populate(\"direction\", ...) select stringida 'directionCode' bor", async () => {
    WorkingPlanModel.findById = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        workingSchedule: new mongoose.Types.ObjectId(),
        semesters: null,
        studyPlanLabel: null,
      }),
    });
    const c = chain(ws());
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(c);
    const doc = await buildWorkingRejaDoc("wp1");
    doc.end();

    const directionCall = c.populate.mock.calls.find(([path]) => path === "direction");
    expect(directionCall).toBeTruthy();
    expect(directionCall[1]).toEqual(expect.stringContaining("directionCode"));
    expect(directionCall[1]).toEqual(expect.stringContaining("title"));
  });
});

describe("BUG-9 — O'qish shakli ma'lumotnomadan olinadi", () => {
  test("readingForm bo'lsa — o'shaning title'i chiqadi", async () => {
    const texts = await renderTexts(ws({ readingForm: { title: "Kredit-modul" } }));
    expect(texts).toContain("- Kredit-modul");
    expect(texts).not.toContain("- kredit tizimi");
  });

  test("readingForm bo'lmasa — eski qiymat zaxira sifatida qoladi", async () => {
    const texts = await renderTexts(ws({ readingForm: null }));
    expect(texts).toContain("- kredit tizimi");
  });
});
