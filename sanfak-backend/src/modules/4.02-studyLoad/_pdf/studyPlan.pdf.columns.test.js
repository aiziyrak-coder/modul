const { PassThrough } = require("stream");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model");

const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const { generateStudyPlanPdf } = require("./studyPlan.pdf");

const particle = (soat, foiz) => [
  { slug: "soat", title: "soat", value: soat, canonical: "hour", colNum: 4 },
  { slug: "foiz", title: "%", value: foiz, canonical: "percent", colNum: 5 },
];

const sem = (h1, h2) => ({
  1: { hour: h1, credit: h1 },
  2: { hour: h2, credit: h2 },
});

const metaFixture = () => ({
  code: "",
  title: "O'quv bloklari, fanlar va faoliyat turlarining nomlari",
  particles: {
    title: "Talabaning o'quv yuklamasi (soatlarda)",
    items: particle(0, 0),
  },
  distribution: {
    title: "Soatlarning kurslar, semestrlar va haftalar bo'yicha taqsimoti",
    courses: ["1-kurs", "2-kurs"],
    audience: [30, 30],
  },
  credit: {
    title: "Kreditlarning kurslar, semestrlar va haftalar bo'yicha taqsimoti",
    courses: ["1-kurs", "2-kurs"],
    distribution: [30, 30],
  },
  totalCredit: "Jami kreditlar",
});

const blocksFixture = () => [
  {
    serialNumber: "1.00",
    blockCode: "MFI",
    code: "MFI",
    title: "Majburiy fanlar",
    particle: particle(7710, 0),
    semesters: sem(28, 26),
    totalCredit: 257,
    sciences: [
      {
        serialNumber: "1.01",
        code: "FA120",
        title: "Gigiyena",
        particle: particle(120, 0),
        semesters: sem(4, 0),
        totalCredit: 4,
      },
      {
        serialNumber: "1.02",
        code: "FA1000",
        title: "Ekologiya",
        particle: particle(240, 0),
        semesters: sem(0, 8),
        totalCredit: 8,
      },
    ],
  },
  {
    serialNumber: "2.00",
    blockCode: "TF2",
    code: "TF2",
    title: "Tanlov fanlari",
    particle: particle(690, 0),
    semesters: sem(0, 4),
    totalCredit: 23,
    sciences: [],
  },
];

const JAMI_SEM_HOUR = ["28", "30"];
const JAMI_CREDIT = "280";
const JAMI_SOAT = "8400";

const lpFixture = (overrides = {}) => ({
  title: "Tibbiy profilaktika ishi OʻQUV REJA",
  direction: { title: "Tibbiy profilaktika ishi", directionCode: "60910500" },
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
  ...overrides,
});

const planFixture = (lp, metaPatch = {}, blocks = null) => ({
  _id: "sp1",
  learningProcess: lp,
  blocks: blocks || blocksFixture(),
  meta: { ...metaFixture(), ...metaPatch },
});

const renderCalls = async (lp = lpFixture(), metaPatch = {}, blocks = null) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(planFixture(lp, metaPatch, blocks));
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drawPage2 — 'Fanning malakaviy kodi' ustuni (blanka 2-ustuni)", () => {
  test("fan qatorida T/r dan keyin `code`, undan keyin fan nomi keladi", async () => {
    const texts = await renderCalls();
    expect(hasRun(texts, ["1.01", "FA120", "Gigiyena"])).toBe(true);
    expect(hasRun(texts, ["1.02", "FA1000", "Ekologiya"])).toBe(true);
  });

  test("kod ustuni YO'Q holat qaytmaydi (T/r darhol fan nomiga ulanmaydi)", async () => {
    const texts = await renderCalls();
    expect(hasRun(texts, ["1.01", "Gigiyena"])).toBe(false);
  });

  test("sarlavha bazada bo'sh bo'lsa — blankadagi nom yoziladi", async () => {
    const texts = await renderCalls();
    expect(texts).toContain("Fanning malakaviy kodi");
  });

  test("bazada sarlavha bo'lsa — AYNAN u ishlatiladi", async () => {
    const texts = await renderCalls(lpFixture(), { code: "Fan kodi" });
    expect(texts).toContain("Fan kodi");
  });
});

describe("drawPage2 — yuklama guruhi (10 ustun, kredit sun'iy ustuni YO'Q)", () => {
  test("guruh sarlavhasi chiziladi, sun'iy `kredit` sub-sarlavhasi YO'Q", async () => {
    const texts = await renderCalls();
    expect(texts).toContain("Umumiy yuklamaning hajmi");
    expect(texts).not.toContain("kredit");
  });

  test("qator nomidan keyin DARHOL `soat` particle qiymati keladi (kredit oldinda YO'Q)", async () => {
    const texts = await renderCalls();
    expect(hasRun(texts, ["Gigiyena", "120"])).toBe(true);
    expect(hasRun(texts, ["Ekologiya", "240"])).toBe(true);
  });

  test("qator uzunligi 3+10+2*sc+1 (fixture sc=2 -> 18), totalCredit OXIRIDA", async () => {
    const texts = await renderCalls();
    const i = texts.indexOf("1.01");
    const j = texts.indexOf("1.02");
    expect(j - i).toBe(18);
    expect(texts.slice(i, j).at(-1)).toBe("4");
  });

  test("blok qatorida ham totalCredit (257) OXIRIDA, boshida EMAS", async () => {
    const texts = await renderCalls();
    expect(hasRun(texts, ["1.00 Majburiy fanlar", "7710"])).toBe(true);
    const i = texts.indexOf("MFI") - 1;
    const j = texts.indexOf("1.01");
    expect(texts.slice(i, j).at(-1)).toBe("257");
  });
});

describe("drawPage2 — pastki 'Jami' qatori", () => {
  test("semestr kataklarida RAQAM (blok qatorlari yig'indisi) turadi", async () => {
    const texts = await renderCalls();
    expect(hasRun(texts, ["Jami", JAMI_SOAT])).toBe(true);
    expect(
      hasRun(texts, [...JAMI_SEM_HOUR, ...JAMI_SEM_HOUR, JAMI_CREDIT]),
    ).toBe(true);
  });

  test("kurs YORLIQLARI ('1-kurs') 'Jami' qatoriga tushmaydi", async () => {
    const texts = await renderCalls();
    const i = texts.lastIndexOf("Jami");
    expect(texts.slice(i, i + 8)).not.toContain("1-kurs");
  });

  test("oxirgi katakda SARLAVHA matni emas, yig'indi turadi", async () => {
    const texts = await renderCalls();
    const tail = texts.slice(texts.lastIndexOf("Jami"));
    expect(tail).not.toContain("Jami kreditlar");
    expect(tail).toContain(JAMI_CREDIT);
  });
});

describe("drawPage2 — 'Jami kreditlar' ustuni QAYTA TIKLANDI (Q-6/Q-7)", () => {
  test("sarlavha (VERTIKAL) chiziladi — blankadagi nom", async () => {
    const texts = await renderCalls();
    expect(texts).toContain("Jami kreditlar");
  });
});

describe("drawPage2 — blok yorlig'i", () => {
  test("xom `blockCode` yorliqda YO'Q (u o'z ustunida chiziladi)", async () => {
    const texts = await renderCalls();
    expect(texts).toContain("1.00 Majburiy fanlar");
    expect(texts).not.toContain("1.00 MFI Majburiy fanlar");
    expect(hasRun(texts, ["MFI", "1.00 Majburiy fanlar"])).toBe(true);
  });
});

describe("drawPage1 — markaziy sarlavha", () => {
  test("`lp.title` yo'nalish nomi bilan bo'lsa ham — yolg'iz 'O'QUV REJA'", async () => {
    const texts = await renderCalls();
    expect(texts).toContain("O'QUV REJA");
    expect(texts).not.toContain("Tibbiy profilaktika ishi OʻQUV REJA");
  });

  test("`lp.title` bo'lmasa ham sarlavha yo'qolmaydi", async () => {
    const texts = await renderCalls(lpFixture({ title: null }));
    expect(texts).toContain("O'QUV REJA");
  });

  test("bo'sh satr — `||` tuzog'i: baribir sarlavha chiqadi", async () => {
    const texts = await renderCalls(lpFixture({ title: "" }));
    expect(texts).toContain("O'QUV REJA");
  });

  test("yo'nalishdan farqli o'ziga xos sarlavha SAQLANADI", async () => {
    const texts = await renderCalls(
      lpFixture({ title: "Tibbiy profilaktika ishi MAGISTRATURA REJASI" }),
    );
    expect(texts).toContain("MAGISTRATURA REJASI");
  });
});

const creditBlocks = () => {
  const [b1, b2] = blocksFixture();
  return [
    { ...b1, semesters: { 1: { hour: 28, credit: 25 }, 2: { hour: 26, credit: 20 } } },
    { ...b2, semesters: { 1: { hour: 0, credit: 0 }, 2: { hour: 4, credit: 3 } } },
  ];
};

describe("drawPage2 — 'Jami' qatorining kredit yarmi", () => {
  test("blok qatorlaridan yig'indi (25+0=25, 20+3=23)", async () => {
    const texts = await renderCalls(lpFixture(), {}, creditBlocks());
    expect(hasRun(texts, ["Jami", JAMI_SOAT])).toBe(true);
    expect(hasRun(texts, ["28", "30", "25", "23", JAMI_CREDIT])).toBe(true);
  });

  test("`meta.credit.distribution` (doimiy 30) ISHLATILMAYDI", async () => {
    const texts = await renderCalls(lpFixture(), {}, creditBlocks());
    expect(hasRun(texts, ["28", "30", "30", "30", JAMI_CREDIT])).toBe(false);
  });

  test("kredit soat qiymatlaridan olinmaydi (28/30 EMAS)", async () => {
    const texts = await renderCalls(lpFixture(), {}, creditBlocks());
    expect(hasRun(texts, ["28", "30", "28", "30", JAMI_CREDIT])).toBe(false);
  });

  test("soat yarmi (jamiSemHour) o'zgarmadi — regressiya", async () => {
    const texts = await renderCalls(lpFixture(), {}, creditBlocks());
    expect(hasRun(texts, ["Jami", JAMI_SOAT])).toBe(true);
  });
});

const SLUGS = [
  "soat",
  "foiz",
  "jami",
  "maruza",
  "amaliy",
  "laboratoriya",
  "seminar",
  "mustaqil_talim",
];
const blankaParticle = () =>
  SLUGS.map((slug, i) => ({
    slug,
    title: slug,
    value: 10 + i,
    colNum: i === 7 ? 12 : 4 + i,
  }));
const blankaSems = () => {
  const o = {};
  for (let s = 1; s <= 10; s++) o[s] = { hour: 20 + s, credit: 10 + s };
  return o;
};
const blankaBlocks = () => [
  {
    serialNumber: "1.00",
    code: "MFI",
    title: "Majburiy fanlar",
    particle: blankaParticle(),
    semesters: blankaSems(),
    totalCredit: 257,
    sciences: [
      {
        serialNumber: "1.01",
        code: "FA120",
        title: "Gigiyena",
        particle: blankaParticle(),
        semesters: blankaSems(),
        totalCredit: 4,
      },
    ],
  },
];
const blankaMeta = () => ({
  particles: { title: "P", items: blankaParticle() },
  distribution: {
    title: "D",
    courses: ["1-kurs", "2-kurs", "3-kurs", "4-kurs", "5-kurs"],
    audience: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
  },
  credit: { title: "K", courses: [], distribution: Array(10).fill(30) },
});

describe("drawPage2 — ustunlar soni blanka bilan mos (32 + 2 yangi = 34)", () => {
  const render32 = () => renderCalls(lpFixture(), blankaMeta(), blankaBlocks());

  test("fan qatorida AYNAN 34 katak chiziladi", async () => {
    const texts = await render32();
    const i = texts.indexOf("1.01");
    const j = texts.indexOf("Jami", i) - 2;
    expect(i).toBeGreaterThan(-1);
    expect(j - i).toBe(34);
  });

  test("blok qatorida ham 34 katak", async () => {
    const texts = await render32();
    const i = texts.indexOf("MFI") - 1;
    const j = texts.indexOf("1.01");
    expect(j - i).toBe(34);
  });

  test("yangi ikki ustun Seminardan KEYIN, fan qatorida BO'SH (hujjatda qiymat yo'q)", async () => {
    const texts = await render32();
    const iSem = texts.indexOf("seminar");
    expect(texts.slice(iSem, iSem + 3)).toEqual([
      "seminar",
      "Klinik o'quv amaliyoti",
      "Kurs ishi",
    ]);
    expect(texts).toContain("mustaqil_talim");
    const i = texts.indexOf("1.01");
    const row = texts.slice(i, i + 34);
    expect(row.slice(3, 13)).toEqual(["10", "11", "12", "13", "14", "15", "16", "", "", "17"]);
  });

  test("raqamlar qatori KETMA-KET — 1..34 (hujjat colNum'i emas)", async () => {
    const texts = await render32();
    const nums = Array.from({ length: 34 }, (_, k) => String(k + 1));
    expect(hasRun(texts, nums)).toBe(true);
    expect(hasRun(texts, ["10", "12"])).toBe(false);
  });

  test("'Jami' qatorida ham 34 katak", async () => {
    const texts = await render32();
    const i = texts.indexOf("Jami") - 2;
    expect(texts.slice(i, i + 34)[32]).toBe("20");
    expect(texts.slice(i, i + 34).at(-1)).toBe("257");
  });

  test("qator oxirida `totalCredit` — Jami kreditlar ustunida, faqat BIR marta", async () => {
    const texts = await render32();
    const i = texts.indexOf("1.01");
    const row = texts.slice(i, i + 34);
    expect(row.filter((t) => t === "4")).toHaveLength(1);
    expect(row.at(-1)).toBe("4");
  });
});
