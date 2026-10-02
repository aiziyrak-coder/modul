const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const lpFixture = (comment) => ({
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [{ key: "A", title: "Attestatsiyalar" }],
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sen", weeks: [{ week: 1, key: "A" }] }],
      weeks: { 1: "A" },
      total: 35,
      statistics: [
        { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 35 },
      ],
    },
  ],
  allValues: { total: 35, statistics: [] },
  comment,
  learningProcess: {
    keys: [{ key: "A", title: "Attestatsiyalar", week: 35, semester: "1-12" }],
    title: null,
  },
});

const mockPlan = (lp) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lp,
    blocks: [{ title: "MAJBURIY FANLAR", semesters: {}, sciences: [] }],
    meta: {},
  });
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
};

const renderCalls = async (comment) => {
  mockPlan(lpFixture(comment));
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return spy.mock.calls.map((c) => c[0]);
  } finally {
    spy.mockRestore();
  }
};

const BAND_BELGILARI = [
  "1 kredit 30 akademik soatni tashkil qiladi.",
  "GPA ko'rsatkichi avgust oyining uchinchi haftasida",
  "Tanlov fanlari bloki OTM kengashi qarori bilan",
  "Harbiy tibbiy tayyorgarlik mashg'ulotlari tanlov fanlari",
  "haftalik hajmini saqlagan holda o'quv fanlari bloki hajmini 5% gacha",
  "Klinik fanlarga ajratilgan auditoriya soatlarining 50%",
  "ixtisoslikka oid fanlarning amaliy mashg'ulotlari",
  "Nazariya va amaliyot yaxlitligini ta'minlash uchun",
  "Jismoniy tarbiya va sport fani fakultativ kurs sifatida",
];

const bor = (texts, bolak) =>
  texts.some((t) => typeof t === "string" && t.includes(bolak));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawPage3 — Izoh (hujjat bilan kelgan matn)", () => {
  test("izoh matni bo'lsa — 'Izoh:' sarlavhasi va matnning O'ZI chiziladi", async () => {
    const texts = await renderCalls("TDTU 2025-yil rejasi asosida ishlab chiqilgan");
    expect(bor(texts, "Izoh:")).toBe(true);
    expect(texts).toContain("TDTU 2025-yil rejasi asosida ishlab chiqilgan");
  });

  test("STATIK 9 band endi CHIZILMAYDI (2026-09-08 qarori)", async () => {
    const texts = await renderCalls("Ixtiyoriy izoh matni");
    BAND_BELGILARI.forEach((bolak) => {
      expect({ bolak, bor: bor(texts, bolak) }).toEqual({ bolak, bor: false });
    });
    for (let i = 1; i <= 9; i++) {
      expect(texts).not.toContain(`${i}.`);
    }
  });

  test("'Qo'shimcha izoh:' sarlavhasi endi YO'Q — matn asosiy 'Izoh:' ostida", async () => {
    const texts = await renderCalls("Yuklangan izoh");
    expect(bor(texts, "Qo'shimcha izoh:")).toBe(false);
    expect(bor(texts, "Izoh:")).toBe(true);
  });

  test("izoh yo'q bo'lsa — bo'lim UMUMAN chizilmaydi (bo'sh sarlavha qolmaydi)", async () => {
    const texts = await renderCalls(null);
    expect(bor(texts, "Izoh:")).toBe(false);
  });

  test("izoh faqat bo'shliqdan iborat bo'lsa ham — bo'lim chizilmaydi", async () => {
    const texts = await renderCalls("   ");
    expect(bor(texts, "Izoh:")).toBe(false);
  });

  test("tab belgilari bo'shliqqa aylanadi (□ chiqmaydi), yangi qator saqlanadi", async () => {
    const texts = await renderCalls("Prorektor\t\t\tSh.A.Boymuradov\nDekan\tB.T.Xolmatova");
    const izoh = texts.find((t) => typeof t === "string" && t.includes("Boymuradov"));
    expect(izoh).toBe("Prorektor Sh.A.Boymuradov\nDekan B.T.Xolmatova");
    expect(texts.some((t) => typeof t === "string" && /[\t\v\f]/.test(t))).toBe(false);
  });
});
