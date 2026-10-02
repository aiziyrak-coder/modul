const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { buildSubjectRows, buildWorkingRejaDoc } = require("./workingPlan.pdf");

const MARK = "•";
const DASH = "—";

const SCI_A = "6a7d69082200e50d919e2b40";
const mandatoryBlock = (sciences) => ({
  blockCode: "MFI",
  title: "Majburiy fanlar",
  sciences,
});
const electiveBlock = (sciences) => ({
  blockCode: "TF2",
  title: "Tanlov fanlari",
  sciences,
});
const jami = (rows) => rows.reduce((s, r) => s + (r.credit || 0), 0);
const mainRows = (rows) => rows.filter((r) => !r.alt);
const altRows = (rows) => rows.filter((r) => r.alt);

const ALT_B = { science: "b1", code: "FA1007", title: "Atrof-muhit gigiyenasi" };
const ALT_C = { science: "c1", code: "FA1009", title: "Kasb kasalliklari" };

describe("buildSubjectRows — ADR-016 alternativlar", () => {
  test("alternativsiz kirish — natija AYNAN eskicha (idx + kredit)", () => {
    const blocks = [
      mandatoryBlock([
        {
          science: SCI_A,
          code: "FA1003",
          title: "Mehnat gigiyenasi",
          totalCredit: 6,
        },
        { science: "z", code: "FA1004", title: "Fan Z", totalCredit: 2 },
      ]),
    ];

    const { majburiy, tanlov } = buildSubjectRows(blocks);

    expect(majburiy).toEqual([
      { idx: "1.01", code: "FA1003", title: "Mehnat gigiyenasi", credit: 6 },
      { idx: "1.02", code: "FA1004", title: "Fan Z", credit: 2 },
    ]);
    expect(tanlov).toEqual([]);
  });

  test("alternativ bor — asosiy qator OSTIDA `alt` qatori, `credit` maydoni YO'Q", () => {
    const blocks = [
      electiveBlock([
        {
          science: SCI_A,
          code: "FA1003",
          title: "Mehnat gigiyenasi",
          totalCredit: 6,
          alternatives: [ALT_B, ALT_C],
        },
      ]),
    ];

    const { tanlov } = buildSubjectRows(blocks);

    expect(tanlov).toEqual([
      { idx: "2.01", code: "FA1003", title: "Mehnat gigiyenasi", credit: 6 },
      { alt: true, code: "FA1007", title: "Atrof-muhit gigiyenasi" },
      { alt: true, code: "FA1009", title: "Kasb kasalliklari" },
    ]);
    expect(tanlov[1].credit).toBeUndefined();
  });

  test("🔴 'Jami' alternativ qo'shilganda AYNAN o'zgarmaydi (invariant #3)", () => {
    const slot = (alternatives) => ({
      science: SCI_A,
      code: "FA1003",
      title: "Mehnat gigiyenasi",
      totalCredit: 6,
      ...(alternatives ? { alternatives } : {}),
    });
    const without = buildSubjectRows([
      mandatoryBlock([
        { science: "m", code: "M1", title: "Fan M", totalCredit: 4 },
      ]),
      electiveBlock([slot(null)]),
    ]);
    const withAlt = buildSubjectRows([
      mandatoryBlock([
        { science: "m", code: "M1", title: "Fan M", totalCredit: 4 },
      ]),
      electiveBlock([slot([ALT_B, ALT_C])]),
    ]);

    expect(jami(withAlt.tanlov)).toBe(jami(without.tanlov));
    expect(jami(withAlt.majburiy)).toBe(jami(without.majburiy));
    expect(jami(withAlt.tanlov)).toBe(6);
    expect(mainRows(withAlt.tanlov)).toEqual(mainRows(without.tanlov));
    expect(altRows(withAlt.tanlov)).toHaveLength(2);
  });

  test("takror fan (ikki semestr) — alternativ TAKRORLANMAYDI, kredit yig'iladi", () => {
    const slot = (credit) => ({
      science: SCI_A,
      code: "FA1003",
      title: "Mehnat gigiyenasi",
      totalCredit: credit,
      alternatives: [ALT_B, ALT_C],
    });
    const { tanlov } = buildSubjectRows([
      electiveBlock([slot(3)]),
      electiveBlock([slot(3)]),
    ]);

    expect(mainRows(tanlov)).toHaveLength(1);
    expect(mainRows(tanlov)[0].credit).toBe(6);
    expect(altRows(tanlov).map((r) => r.code)).toEqual(["FA1007", "FA1009"]);
  });

  test("keyingi semestrda YANGI alternativ bo'lsa — qo'shiladi (dublikatsiz)", () => {
    const { tanlov } = buildSubjectRows([
      electiveBlock([
        {
          science: SCI_A,
          code: "FA1003",
          title: "Fan A",
          totalCredit: 3,
          alternatives: [ALT_B],
        },
      ]),
      electiveBlock([
        {
          science: SCI_A,
          code: "FA1003",
          title: "Fan A",
          totalCredit: 3,
          alternatives: [ALT_B, ALT_C],
        },
      ]),
    ]);

    expect(altRows(tanlov).map((r) => r.code)).toEqual(["FA1007", "FA1009"]);
    expect(mainRows(tanlov)[0].credit).toBe(6);
  });

  test("`idx` faqat ASOSIY qatorlarda va ketma-ket (alternativ raqamlanmaydi)", () => {
    const { majburiy } = buildSubjectRows([
      mandatoryBlock([
        {
          science: "a",
          code: "A1",
          title: "Fan A",
          totalCredit: 1,
          alternatives: [ALT_B],
        },
        { science: "b", code: "B1", title: "Fan B", totalCredit: 2 },
        {
          science: "c",
          code: "C1",
          title: "Fan C",
          totalCredit: 3,
          alternatives: [ALT_C],
        },
      ]),
    ]);

    expect(majburiy.map((r) => r.idx)).toEqual([
      "1.01",
      undefined,
      "1.02",
      "1.03",
      undefined,
    ]);
    expect(majburiy.map((r) => r.code)).toEqual([
      "A1",
      "FA1007",
      "B1",
      "C1",
      "FA1009",
    ]);
  });

  test("bo'sh shakllar — `[]` / maydon yo'q / `null` / massiv emas / bo'sh element", () => {
    const base = { science: "a", code: "A1", title: "Fan A", totalCredit: 2 };
    const expected = [{ idx: "1.01", code: "A1", title: "Fan A", credit: 2 }];

    for (const alternatives of [[], undefined, null, "xato", {}, [null], [{}]]) {
      const sci =
        alternatives === undefined ? { ...base } : { ...base, alternatives };
      expect(buildSubjectRows([mandatoryBlock([sci])]).majburiy).toEqual(
        expected,
      );
    }
  });
});

const WS_ID = new mongoose.Types.ObjectId();

const simpleFind = (doc) => ({ exec: jest.fn().mockResolvedValue(doc) });
const chainablePopulate = (doc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(doc);
  return chain;
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  academicLevel: null,
  educationForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2025/2026" },
  stage: null,
  direction: { title: "Davolash ishi", directionCode: "5510100" },
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

const particle = (hour, lecture) => [
  { slug: "umumiy_yuklamaning_hajmi_soat", value: hour },
  { slug: "maruza", value: lecture },
];

const wpFixture = (altShape, { include = true } = {}) => ({
  workingSchedule: WS_ID,
  studyPlanLabel: null,
  semesters: {
    1: {
      blocks: [
        {
          blockCode: "MFI",
          title: "Majburiy fanlar",
          sciences: [
            {
              science: "m1",
              code: "FA1002",
              title: "Kommunal gigiyena",
              particle: particle(180, 90),
              totalCredit: 6,
            },
          ],
        },
        {
          blockCode: "TF2",
          title: "Tanlov fanlari",
          sciences: [
            {
              science: "t1",
              code: "FA1003",
              title: "Mehnat gigiyenasi",
              particle: particle(180, 90),
              totalCredit: 6,
              ...(include ? { alternatives: altShape } : {}),
            },
          ],
        },
      ],
    },
    2: {
      blocks: [
        {
          blockCode: "MFI",
          title: "Majburiy fanlar",
          sciences: [
            {
              science: "m2",
              code: "FA1005",
              title: "Ovqatlanish gigiyenasi",
              particle: particle(120, 60),
              totalCredit: 4,
            },
          ],
        },
      ],
    },
  },
});

async function traceOf(wp) {
  WorkingPlanModel.findById = jest.fn().mockReturnValue(simpleFind(wp));
  WorkingScheduleModel.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(wsFixture()));

  const trace = [];
  const original = PDFDocument.prototype.text;
  const spy = jest
    .spyOn(PDFDocument.prototype, "text")
    .mockImplementation(function (txt, x, y, opts) {
      trace.push([
        String(txt),
        typeof x === "number" ? Number(x.toFixed(2)) : null,
        typeof y === "number" ? Number(y.toFixed(2)) : null,
      ]);
      return original.call(this, txt, x, y, opts);
    });

  const doc = await buildWorkingRejaDoc("wpId");
  doc.end();
  spy.mockRestore();
  return trace;
}

const dyAfter = (trace, anchor, v, last = false) => {
  const texts = trace.map(([t]) => t);
  const i = last ? texts.lastIndexOf(anchor) : texts.indexOf(anchor);
  return trace.slice(i).find(([t]) => t === v)[2] - trace[i][2];
};

describe("buildWorkingRejaDoc — ADR-016 chizma regressiyasi", () => {
  beforeEach(() => jest.clearAllMocks());

  test("🔴 alternativsiz reja — `[]` / maydon yo'q / `null` / massiv emas AYNAN bir xil chizma", async () => {
    const empty = await traceOf(wpFixture([]));
    const missing = await traceOf(wpFixture(undefined, { include: false }));
    const nul = await traceOf(wpFixture(null));
    const wrong = await traceOf(wpFixture("xato"));

    expect(empty.length).toBeGreaterThan(50);
    expect(missing).toEqual(empty);
    expect(nul).toEqual(empty);
    expect(wrong).toEqual(empty);
    expect(empty.some(([t]) => t.includes(MARK))).toBe(false);
    expect(empty.filter(([t]) => t === DASH)).toHaveLength(0);
  });

  test("alternativ bor — kirtimli qator chiziladi, kredit/soat kataklari RAQAM emas", async () => {
    const trace = await traceOf(
      wpFixture([
        { code: "FA1007", title: "Atrof-muhit gigiyenasi" },
        { code: "FA1009", title: "Kasb kasalliklari" },
      ]),
    );

    const texts = trace.map(([t]) => t);
    expect(texts.filter((t) => t === `${MARK} FA1007`)).toHaveLength(2);
    expect(texts.filter((t) => t === `${MARK} FA1009`)).toHaveLength(2);
    expect(texts).toContain("Atrof-muhit gigiyenasi");
    expect(texts.filter((t) => t === DASH)).toHaveLength(0);
  });

  test("birlashgan katak — asosiy qiymat BIR marta chiziladi, blok markazida", async () => {
    const plain = await traceOf(wpFixture([]));
    const withAlt = await traceOf(
      wpFixture([
        { code: "FA1007", title: "Atrof-muhit gigiyenasi" },
        { code: "FA1009", title: "Kasb kasalliklari" },
      ]),
    );
    const count = (trace, v) => trace.filter(([t]) => t === v).length;
    for (const v of ["180", "90", "6"]) {
      expect(count(withAlt, v)).toBe(count(plain, v));
    }
    const lecDy = dyAfter(withAlt, "FA1003", "90");
    expect(lecDy).toBeGreaterThan(dyAfter(plain, "FA1003", "90"));
    expect(lecDy).toBeLessThan(dyAfter(withAlt, "FA1003", `${MARK} FA1009`));
    expect(dyAfter(withAlt, "FA1003", "6", true)).toBeGreaterThan(
      dyAfter(plain, "FA1003", "6", true),
    );
  });

  test("🔴 alternativ qo'shilishi asosiy chizmani (jumladan 'Jami') o'zgartirmaydi", async () => {
    const plain = await traceOf(wpFixture([]));
    const withAlt = await traceOf(
      wpFixture([
        { code: "FA1007", title: "Atrof-muhit gigiyenasi" },
        { code: "FA1009", title: "Kasb kasalliklari" },
      ]),
    );

    const ALT_TEXTS = new Set([
      `${MARK} FA1007`,
      `${MARK} FA1009`,
      DASH,
      "Atrof-muhit gigiyenasi",
      "Kasb kasalliklari",
    ]);
    const HEAD_TEXTS = new Set([
      "III. FANLAR RO'YXATI",
      "Majburiy fanlar",
      "Tanlov fanlar",
      "T/r",
      "Fanning malakaviy kodi",
      "Fanning nomi",
      "Kreditlar",
    ]);
    const strip = (trace) =>
      trace
        .filter(([t]) => !ALT_TEXTS.has(t) && !HEAD_TEXTS.has(t))
        .map(([t, x]) => [t, x]);
    const cleaned = strip(withAlt);
    expect(cleaned).toEqual(strip(plain));
    expect(cleaned.length).toBeGreaterThan(10);
  });
});
