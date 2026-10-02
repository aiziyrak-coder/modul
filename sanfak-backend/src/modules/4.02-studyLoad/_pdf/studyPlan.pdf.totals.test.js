const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf, _internals } = require("./studyPlan.pdf");
const { ROW_TYPE } = require("#modules/4.02-studyLoad/_shared/planRowType");

const { computePlanTotals, isPracticeBlock, rowStyle } = _internals;

const particle = (soat, jami = 0) => [
  { slug: "soat", title: "soat", value: soat, canonical: "hour", colNum: 4 },
  { slug: "jami", title: "Jami", value: jami, canonical: "total", colNum: 6 },
];
const sem = (h1, c1, h2, c2) => ({
  1: { hour: h1, credit: c1 },
  2: { hour: h2, credit: c2 },
});

const blocksFixture = () => [
  {
    serialNumber: "1",
    blockCode: "MF1",
    code: "MF1",
    title: "Majburiy fanlar",
    particle: particle(600, 300),
    semesters: sem(8, 8, 4, 4),
    totalCredit: 20,
    sciences: [
      { serialNumber: "1.1", code: "", title: "Ijtimoiy-gumanitar fanlar moduli", particle: particle(600, 300), semesters: sem(8, 8, 4, 4), totalCredit: 20 },
      { serialNumber: "1.1.01", code: "OYT1104", title: "O'zbekistonning eng yangi tarixi", particle: particle(120, 60), semesters: sem(4, 4, 0, 0), totalCredit: 4 },
      { serialNumber: "1.1.02", code: "FS1104", title: "Falsafa", particle: particle(120, 60), semesters: sem(4, 4, 0, 0), totalCredit: 4 },
      { serialNumber: "1.1.03", code: "DIN1404", title: "Dinshunoslik", particle: particle(360, 180), semesters: sem(0, 0, 4, 4), totalCredit: 12 },
    ],
  },
  {
    serialNumber: "2",
    blockCode: "TF2",
    code: "TF2",
    title: "Tanlov fanlar",
    particle: particle(120, 60),
    semesters: sem(0, 0, 2, 2),
    totalCredit: 4,
    sciences: [],
  },
  {
    serialNumber: "",
    blockCode: "MA",
    code: "MA",
    title: "Malakaviy amaliyot",
    particle: particle(60, 0),
    semesters: sem(0, 2, 0, 0),
    totalCredit: 2,
    sciences: [
      { serialNumber: "", code: "TM104", title: "Tanishuv amaliyoti", particle: particle(0, 0), semesters: sem(0, 2, 0, 0), totalCredit: 2 },
      { serialNumber: "", code: "BAKYDA604", title: "Birlamchi akkreditatsiya bilan yakuniy davlat attestatsiyasi", particle: particle(120, 0), semesters: sem(0, 0, 0, 4), totalCredit: 4 },
    ],
  },
];

const metaFixture = () => ({
  columns: {},
  particles: { items: [] },
  distribution: { courses: ["1-kurs"], semester: ["1", "2"] },
  credit: { semester: ["1", "2"], distribution: [30, 30] },
});

const lpFixture = () => ({
  title: "Davolash ishi",
  direction: { title: "Davolash ishi", directionCode: "60910200" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  keys: [],
  courses: [],
  allValues: null,
  comment: null,
  learningProcess: { keys: [] },
});

const renderCalls = async (blocks = blocksFixture()) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue({
    _id: "sp1",
    learningProcess: lpFixture(),
    blocks,
    meta: metaFixture(),
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
    return spy.mock.calls.map((c) => c[0]);
  } finally {
    spy.mockRestore();
  }
};

const hasRun = (texts, seq) =>
  texts.some((_, i) => seq.every((v, j) => texts[i + j] === v));

beforeEach(() => jest.clearAllMocks());

describe("computePlanTotals — Excel semantikasi (sof funksiya)", () => {
  const totals = computePlanTotals(blocksFixture(), ["1", "2"]);

  test("fan bloklari 'Jami' = MF1 + TF2 sarlavhalari (fan qatorlari EMAS)", () => {
    expect(totals.fan.particle.soat).toBe(720);
    expect(totals.fan.credit).toBe(24);
    expect(totals.fan.semHour).toEqual({ 1: 8, 2: 6 });
    expect(totals.fan.semCredit).toEqual({ 1: 8, 2: 6 });
  });

  test("amaliyot 'Jami' = sarlavha + ATTESTATSIYA qatori (ilgari yo'qolardi)", () => {
    expect(totals.practice.particle.soat).toBe(180);
    expect(totals.practice.credit).toBe(6);
    expect(totals.practice.semCredit).toEqual({ 1: 2, 2: 4 });
  });

  test("HAMMASI = fanlar + amaliyot; har semestr kredit to'liq", () => {
    expect(totals.grand.particle.soat).toBe(900);
    expect(totals.grand.credit).toBe(30);
    expect(totals.grand.semCredit).toEqual({ 1: 10, 2: 10 });
    expect(totals.hasPractice).toBe(true);
    expect(totals.lastFanBlock.blockCode).toBe("TF2");
    expect(totals.lastPracticeBlock.blockCode).toBe("MA");
  });

  test("amaliyot bloki yo'q reja — hasPractice=false (eski bitta 'Jami' xulqi)", () => {
    const t = computePlanTotals(blocksFixture().slice(0, 2), ["1", "2"]);
    expect(t.hasPractice).toBe(false);
    expect(t.grand.credit).toBe(24);
  });

  test("isPracticeBlock — sarlavha bo'yicha (blok kodi emas)", () => {
    expect(isPracticeBlock({ title: "Malakaviy amaliyot" })).toBe(true);
    expect(isPracticeBlock({ title: "Tanlov fanlar", blockCode: "MA" })).toBe(false);
  });
});

describe("rowStyle — modul/yig'indi qatori ajralib turadi", () => {
  test("sectionHeader va aggregate — qalin + fon; subject — oddiy", () => {
    expect(rowStyle(ROW_TYPE.SECTION_HEADER)).toEqual({ bold: true, bg: expect.any(String) });
    expect(rowStyle(ROW_TYPE.AGGREGATE)).toEqual({ bold: true, bg: expect.any(String) });
    expect(rowStyle(ROW_TYPE.SUBJECT)).toEqual({});
    expect(rowStyle(ROW_TYPE.PRACTICE)).toEqual({});
  });
});

describe("drawPage2 — uchta yig'indi qatori (chizish oqimi)", () => {
  test("'Jami' (fanlar) → 'Jami' (amaliyot) → 'HAMMASI' tartibda, raqamlari Excel semantikasida", async () => {
    const texts = await renderCalls();
    const jamiIdx = texts.map((t, i) => (t === "Jami" ? i : -1)).filter((i) => i >= 0);
    const hammasi = texts.indexOf("HAMMASI");
    expect(jamiIdx.length).toBeGreaterThanOrEqual(2);
    expect(hammasi).toBeGreaterThan(jamiIdx[jamiIdx.length - 1]);
    expect(hasRun(texts, ["Jami", "720", "", "360"])).toBe(true);
    expect(hasRun(texts, ["Jami", "180"])).toBe(true);
    expect(hasRun(texts, ["HAMMASI", "900"])).toBe(true);
    expect(hasRun(texts, ["10", "10", "30"])).toBe(true);
    expect(texts).not.toContain("780");
  });

  test("amaliyot bloki yo'q — avvalgidek BITTA 'Jami' qatori, 'HAMMASI' yo'q", async () => {
    const texts = await renderCalls(blocksFixture().slice(0, 2));
    expect(texts).not.toContain("HAMMASI");
    expect(hasRun(texts, ["Jami", "720", "", "360"])).toBe(true);
  });

  test("fayl o'z yig'indisini bergan bo'lsa — bizniki chizilmaydi (dublikat yo'q)", async () => {
    const blocks = blocksFixture();
    blocks[2].sciences.push({ serialNumber: "", code: "", title: "HAMMASI", particle: particle(900, 0), semesters: sem(0, 10, 0, 10), totalCredit: 30 });
    const texts = await renderCalls(blocks);
    expect(texts.filter((t) => t === "HAMMASI")).toHaveLength(1);
    expect(hasRun(texts, ["Jami", "720", "", "360"])).toBe(false);
  });
});
