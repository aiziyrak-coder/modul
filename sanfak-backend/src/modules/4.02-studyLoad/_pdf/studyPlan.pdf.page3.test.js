const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const statistics = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 30 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 6 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit ta'lim tizimiga kirish", value: 1 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 4 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: 0 },
  { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til haftalari soni", value: 10 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA ko'rsatkichini hisoblash", value: 1 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 52 },
];

const allStatistics = () => [
  { key: " ", slug: "nazariy_va_amaliy_talim", title: "Nazariy va amaliy ta'lim", value: 150 },
  { key: "A", slug: "attestatsiyalar", title: "Attestatsiyalar", value: 30 },
  { key: "K", slug: "kredit_talim_tizimiga_kirish", title: "Kredit ta'lim tizimiga kirish", value: 1 },
  { key: "M", slug: "malakaviy_amaliyot", title: "Malakaviy amaliyot", value: 20 },
  { key: "D", slug: "yakuniy_davlat_attestatsiyasi", title: "Yakuniy davlat attestatsiyasi", value: 4 },
  { key: "T", slug: "tatil_haftalari_soni", title: "Ta'til haftalari soni", value: 47 },
  { key: "G", slug: "gpa_korsatkichini_hisoblash", title: "GPA ko'rsatkichini hisoblash", value: 4 },
  { key: null, slug: "hammasi", title: "Hammasi", value: 256 },
];

const processKeys = () => [
  { key: " ", title: "Nazariy va amaliy ta'lim", week: 150, semester: "0" },
  { key: "A", title: "Attestatsiyalar", week: 30, semester: "0" },
  { key: "K", title: "Kredit ta'lim tizimiga kirish", week: 1, semester: "0" },
  { key: "M", title: "Malakaviy amaliyot", week: 20, semester: "0" },
  { key: "D", title: "Yakuniy Davlat attestatsiyasi", week: 4, semester: "0" },
  { key: "T", title: "Ta'til", week: 47, semester: "0" },
  { key: "G", title: "GPA ko'rsatkichini hisoblash", week: 4, semester: "0" },
  { key: " ", title: "JAMI", week: 256, semester: "0" },
];
const EXPECTED_TOTAL_WEEKS = "256";

const lpFixture = (overrides = {}) => ({
  direction: { title: "Davolash ishi", directionCode: "5510100" },
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
      months: [{ month: "Sen", weeks: [{ week: 1, key: "T" }] }],
      weeks: { 1: "T" },
      total: 41,
      statistics: statistics(),
    },
  ],
  allValues: { total: 204, statistics: allStatistics() },
  comment: "Izoh",
  learningProcess: { keys: processKeys(), title: null },
  ...overrides,
});

const planFixture = (lp) => ({
  _id: "sp1",
  learningProcess: lp,
  blocks: [{ title: "MAJBURIY FANLAR", semesters: {}, sciences: [] }],
  meta: {},
});

const mockPlan = (lp) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(planFixture(lp));
  StudyPlanModel.findById = jest.fn().mockReturnValue(chain);
};

const renderCalls = async (lp) => {
  mockPlan(lp);
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

const hasRun = (texts, seq) =>
  texts.some((_, i) => seq.every((v, j) => texts[i + j] === v));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawPage3 — izoh (hujjat bilan kelgan matn)", () => {
  test("`comment` (birlik) bo'lsa — 'Izoh:' sarlavhasi va matni chiziladi", async () => {
    const texts = await renderCalls(lpFixture({ comment: "Me'yoriy izoh" }));
    expect(texts).toContain("Izoh:");
    expect(texts).toContain("Me'yoriy izoh");
    expect(texts).not.toContain("Qo'shimcha izoh:");
  });

  test("legacy `comments` (ko'plik) ham qabul qilinadi", async () => {
    const lp = lpFixture({ comment: null, comments: "Eski izoh" });
    const texts = await renderCalls(lp);
    expect(texts).toContain("Izoh:");
    expect(texts).toContain("Eski izoh");
  });

  test("izoh yo'q bo'lsa — bo'lim UMUMAN chizilmaydi", async () => {
    const texts = await renderCalls(lpFixture({ comment: null }));
    expect(texts).not.toContain("Qo'shimcha izoh:");
    expect(texts).not.toContain("Izoh:");
  });
});

describe("drawPage3 — 'JAMI' haftalar yig'indisi", () => {
  test("JAMI qatorining o'zi qo'shilmaydi — 256 (512 EMAS)", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts).toContain(EXPECTED_TOTAL_WEEKS);
    expect(texts).not.toContain("512");
  });

  test("JAMI qatori jadval tanasida takrorlanmaydi (bir marta chiziladi)", async () => {
    const texts = await renderCalls(lpFixture());
    expect(texts.filter((t) => t === "JAMI")).toHaveLength(1);
  });
});

describe("drawPage1 — kalendar statistikasi (massiv shakli)", () => {
  test("statistika kataklari BO'SH EMAS — massiv slug bo'yicha o'qiladi", async () => {
    const texts = await renderCalls(lpFixture());
    const expected = ["41", "30", "6", "1", "4", "", "10", "1", "52"];
    const found = texts.some((_, i) =>
      expected.every((v, j) => texts[i + j] === v),
    );
    expect(found).toBe(true);
    const broken = ["41", "", "", "", "", "", "", "", "41"];
    expect(
      texts.some((_, i) => broken.every((v, j) => texts[i + j] === v)),
    ).toBe(false);
  });

  test("statistics bo'sh massiv bo'lsa — yiqilmaydi", async () => {
    const lp = lpFixture();
    lp.courses[0].statistics = [];
    await expect(renderCalls(lp)).resolves.toBeDefined();
  });
});

describe("drawPage1 — 'Jami' (allValues) qatori", () => {
  test("kataklar to'ladi — total alohida maydondan, qolgani massivdan", async () => {
    const texts = await renderCalls(lpFixture());
    const expected = ["Jami", "204", "150", "30", "1", "20", "4", "47", "4", "256"];
    expect(hasRun(texts, expected)).toBe(true);
  });

  test("buzuq holat QAYTA CHIQMAYDI — 'Jami 204 <7 ta bo'sh> 204'", async () => {
    const texts = await renderCalls(lpFixture());
    const broken = ["Jami", "204", ...Array(7).fill(""), "204"];
    expect(hasRun(texts, broken)).toBe(false);
  });

  test("legacy tekis `allValues` obyekti ham ishlaydi (statistics yo'q)", async () => {
    const lp = lpFixture();
    lp.allValues = { total: 204, theoreticalPractical: 150, certification: 30 };
    const texts = await renderCalls(lp);
    expect(hasRun(texts, ["Jami", "204", "150", "30"])).toBe(true);
  });
});
