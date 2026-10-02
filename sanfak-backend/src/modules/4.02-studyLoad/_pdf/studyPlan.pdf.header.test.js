const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const lpFixture = () => ({
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [
    { key: " ", title: "Nazariy va amaliy ta'lim" },
    { key: "A", title: "Attestatsiyalar" },
    { key: "D", title: "Yakuniy Davlat attestatsiyasi" },
    { key: "G", title: "GPA ko'rsatkichini hisoblash" },
    { key: "K", title: "Kredit ta'lim tizimiga kirish" },
    { key: "M", title: "Malakaviy amaliyot" },
    { key: "T", title: "Ta'til" },
  ],
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [{ month: "Sen", weeks: [{ week: 1, key: "K" }, { week: 2, key: "" }] }],
      weeks: { 1: "K" },
      total: 40,
      statistics: [
        { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
        { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 5 },
        { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit", value: 1 },
        { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 4 },
        { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy", value: 0 },
        { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til", value: 11 },
        { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA", value: 1 },
        { key: "H", slug: "hammasi", title: "Hammasi", value: 52 },
      ],
    },
  ],
  allValues: { total: 40, statistics: [] },
  comment: null,
  learningProcess: { keys: [], title: null },
});

const renderTexts = async () => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lpFixture(),
    blocks: [],
    meta: {},
  });
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
  const spy = jest.spyOn(PDFDocument.prototype, "text");
  try {
    const res = new PassThrough();
    res.setHeader = jest.fn();
    res.resume();
    const next = jest.fn();
    await generateStudyPlanPdf({ params: { id: "sp1" }, query: {} }, res, next);
    expect(next).not.toHaveBeenCalled();
    return spy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string");
  } finally {
    spy.mockRestore();
  }
};

beforeEach(() => jest.clearAllMocks());

describe("drawPage1 — statistika sarlavhasi TO'LIQ matn (T0, A2)", () => {
  test("blankadagi 9 ustun nomi to'liq chiziladi", async () => {
    const texts = await renderTexts();
    for (const full of [
      "Jami",
      "Nazariy va amaliy ta'lim",
      "Attestatsiyalar",
      "Kredit ta'lim tizimiga kirish",
      "Malakaviy amaliyot",
      "Yakuniy davlat attestatsiyasi",
      "Ta'til haftalar soni",
      "GPA ko'rsatkichini hisoblash",
      "Hammasi",
    ]) {
      expect(texts).toContain(full);
    }
  });

  test("ikki bandli guruh sarlavhasi: \"O'quv jarayoni, haftalari soni:\" → \"shundan\"", async () => {
    const texts = await renderTexts();
    expect(texts.some((t) => t.startsWith("O'quv jarayoni,"))).toBe(true);
    expect(texts).toContain("shundan");
  });

  test("qisqartmalar YO'Q (regressiya qulfi)", async () => {
    const texts = await renderTexts();
    for (const abbr of ["Naz.va\namal.", "Att.", "Yak.\nDavl.", "Ham\nmasi", "Malak."]) {
      expect(texts).not.toContain(abbr);
    }
  });

  test("kurs qatorida `0` bo'sh katak (Q-F): 40·30·5·1·4·''·11·1·52", async () => {
    const texts = await renderTexts();
    const seq = ["40", "30", "5", "1", "4", "", "11", "1", "52"];
    expect(texts.some((_, i) => seq.every((v, j) => texts[i + j] === v))).toBe(true);
  });
});

describe("drawPage1 — legenda (T0b)", () => {
  test("har kalit harfi va to'liq tavsifi chiziladi (kesilmaydi)", async () => {
    const texts = await renderTexts();
    for (const title of [
      "Nazariy va amaliy ta'lim",
      "Kredit ta'lim tizimiga kirish",
      "GPA ko'rsatkichini hisoblash",
      "Yakuniy Davlat attestatsiyasi",
    ]) {
      expect(texts).toContain(title);
    }
    for (const k of ["A", "D", "G", "K", "M", "T"]) expect(texts).toContain(k);
  });
});
