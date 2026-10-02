const crypto = require("crypto");
const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const {
  buildWorkingRejaDoc,
  planSemesterChunks,
  subjectListNeedsFreshPage,
  SUBJ_MIN_FIRST_ROWS,
} = require("./workingPlan.pdf");

const PG_M = 12;
const CONTENT_BOTTOM = 595 - 12 - 20;
const SEM_ROW_H = 16;
const ALT_ROW_H = 14;
const SEM_TOTAL_ROW_H = 13;
const SEM_LABEL_H = 9;
const SEM_GRP_H = 9;
const SEM_COL_H = 48;
const SEM_NUM_H = 7;
const SEM_HEAD_H = SEM_LABEL_H + SEM_GRP_H * 3 + SEM_COL_H + SEM_NUM_H;
const SEM_TAIL_H = 3 * SEM_TOTAL_ROW_H;

const particle = (h, l, p, lab, s, ind) => [
  { canonical: "hour", value: h },
  { canonical: "lecture", value: l },
  { canonical: "practical", value: p },
  { canonical: "laboratory", value: lab },
  { canonical: "seminar", value: s },
  { canonical: "independent", value: ind },
];

const mkSci = (i, altEvery) => {
  const sci = {
    code: `FA${1000 + i}`,
    title: `Fan nomi ${i} — uzunroq sarlavha misoli`,
    particle: particle(60, 10, 14, 4, 2, 30),
    totalCredit: 2,
    weeklyHours: 2,
    evaluationType: null,
  };
  if (altEvery > 0 && i % altEvery === 0) {
    sci.alternatives = [
      { code: `ALT${i}A`, title: `Alternativ ${i}-A` },
      { code: `ALT${i}B`, title: `Alternativ ${i}-B` },
    ];
  }
  return sci;
};

const wpFixture = (n, altEvery = 0) => {
  const semesters = new Map();
  for (const sem of ["1", "2"]) {
    const sciences = [];
    for (let i = 1; i <= n; i++) sciences.push(mkSci(i, altEvery));
    const half = Math.ceil(n / 2);
    semesters.set(sem, {
      blocks: [
        {
          blockCode: "MFI",
          title: "Majburiy fanlar",
          sciences: sciences.slice(0, half),
        },
        {
          blockCode: "TF2",
          title: "Tanlov fanlar",
          sciences: sciences.slice(half),
        },
      ],
    });
  }
  return {
    _id: "wp1",
    workingSchedule: "ws1",
    semesters,
    studyPlanLabel: null,
  };
};

const wsFixture = () => ({
  agreed: {},
  confirmation: {},
  direction: { title: "Davolash ishi", directionCode: "5510100" },
  academicLevel: { title: "Bakalavr" },
  educationForm: { title: "Kunduzgi" },
  readingForm: null,
  studyPeriod: null,
  specialization: null,
  academicYear: { title: "2025/2026" },
  stage: null,
  desc: null,
  courses: [
    {
      course: "I",
      courseNum: 1,
      months: [],
      weeks: {},
      total: 41,
      statistics: [],
    },
  ],
  keys: [
    { key: "T", title: "Ta'til" },
    { key: "A", title: "Attestatsiyalar" },
  ],
  statistics: {},
  attestationNote: null,
  allValues: { total: 204, statistics: [] },
  comment: null,
  comments: null,
  methodicalHead: null,
  facultyDean: null,
  approval: null,
});

const render = async (n, altEvery = 0) => {
  WorkingPlanModel.findById = jest.fn().mockReturnValue({
    exec: jest.fn().mockResolvedValue(wpFixture(n, altEvery)),
  });
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(wsFixture());
  WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);

  const ops = [];
  const rects = [];
  const texts = [];
  let page = 0;

  const realAdd = PDFDocument.prototype.addContent;
  const realRect = PDFDocument.prototype.rect;
  const realText = PDFDocument.prototype.text;
  const realAddPage = PDFDocument.prototype.addPage;

  PDFDocument.prototype.addContent = function (d) {
    ops.push(String(d));
    return realAdd.call(this, d);
  };
  PDFDocument.prototype.addPage = function (o) {
    page += 1;
    return realAddPage.call(this, o);
  };
  PDFDocument.prototype.rect = function (x, y, w, h) {
    rects.push({ page, y, h });
    return realRect.call(this, x, y, w, h);
  };
  PDFDocument.prototype.text = function (str, x, y, o) {
    texts.push({ page, str: String(str), y });
    return realText.call(this, str, x, y, o);
  };

  try {
    const doc = await buildWorkingRejaDoc("wp1");
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    const done = new Promise((resolve) => doc.on("end", resolve));
    doc.end();
    await done;
    return {
      ops,
      rects,
      texts,
      pages: page,
      buf: Buffer.concat(chunks),
      sha: crypto.createHash("sha256").update(ops.join("\n")).digest("hex"),
    };
  } finally {
    PDFDocument.prototype.addContent = realAdd;
    PDFDocument.prototype.rect = realRect;
    PDFDocument.prototype.text = realText;
    PDFDocument.prototype.addPage = realAddPage;
  }
};

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const countText = (texts, needle) =>
  texts.filter((t) => t.str === needle).length;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("planSemesterChunks — bo'lak rejasi (sof funksiya)", () => {
  const sciList = (n, altEvery = 0) =>
    Array.from({ length: n }, (_, i) => mkSci(i + 1, altEvery));

  const measureDoc = new PDFDocument({ size: "A4", layout: "landscape" });
  const SEM_TABLE_W = 407;

  const chunkH = (chunk, list) => {
    let h = chunk.from === 0 ? SEM_HEAD_H : 0;
    for (let i = chunk.from; i < chunk.to; i++) {
      h += SEM_ROW_H + (list[i].alternatives?.length || 0) * ALT_ROW_H;
    }
    return h + (chunk.totals ? SEM_TAIL_H : 0);
  };

  test("bo'sh semestr — bitta bo'lak, 'Jami' bilan", () => {
    expect(
      planSemesterChunks([], PG_M, measureDoc, SEM_TABLE_W),
    ).toEqual([{ from: 0, to: 0, totals: true }]);
  });

  test("14 fanli semestr BITTA bo'lakda qoladi (regressiya sharti)", () => {
    const chunks = planSemesterChunks(
      sciList(14),
      PG_M,
      measureDoc,
      SEM_TABLE_W,
    );
    expect(chunks).toEqual([{ from: 0, to: 14, totals: true }]);
  });

  test.each([15, 16, 20, 33, 40, 72, 80])(
    "%i fanli semestrda HECH BIR qator tushib qolmaydi",
    (n) => {
      const list = sciList(n);
      const chunks = planSemesterChunks(list, PG_M, measureDoc, SEM_TABLE_W);
      expect(chunks[0].from).toBe(0);
      expect(chunks[chunks.length - 1].to).toBe(n);
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].from).toBe(chunks[i - 1].to);
      }
      const drawn = chunks.reduce((s, c) => s + (c.to - c.from), 0);
      expect(drawn).toBe(n);
    },
  );

  test.each([15, 40, 80])(
    "%i fanli semestrda 'Jami' FAQAT oxirgi bo'lakda",
    (n) => {
      const chunks = planSemesterChunks(
        sciList(n),
        PG_M,
        measureDoc,
        SEM_TABLE_W,
      );
      expect(chunks.filter((c) => c.totals)).toHaveLength(1);
      expect(chunks[chunks.length - 1].totals).toBe(true);
    },
  );

  test.each([15, 40, 80])(
    "%i fanli semestrda har bo'lak betga SIG'ADI",
    (n) => {
      const list = sciList(n);
      const chunks = planSemesterChunks(list, PG_M, measureDoc, SEM_TABLE_W);
      for (const c of chunks) {
        expect(PG_M + chunkH(c, list)).toBeLessThanOrEqual(CONTENT_BOTTOM);
      }
    },
  );

  test("ADR-016 alternativli rejada ham har bo'lak betga sig'adi", () => {
    const list = sciList(61, 2);
    const chunks = planSemesterChunks(list, PG_M, measureDoc, SEM_TABLE_W);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(PG_M + chunkH(c, list)).toBeLessThanOrEqual(CONTENT_BOTTOM);
    }
    const drawn = chunks.reduce((s, c) => s + (c.to - c.from), 0);
    expect(drawn).toBe(61);
  });

  test("har bo'lakda kamida bitta guruh — cheksiz siklga yo'l yo'q", () => {
    const chunks = planSemesterChunks(
      sciList(5),
      CONTENT_BOTTOM - 1,
      measureDoc,
      SEM_TABLE_W,
    );
    for (const c of chunks) {
      if (c.to > c.from || c.totals)
        expect(c.to).toBeGreaterThanOrEqual(c.from);
    }
    expect(chunks[chunks.length - 1].to).toBe(5);
  });
});

describe("buildWorkingRejaDoc — chizilgan kataklar sahifadan chiqmaydi", () => {
  test.each([5, 15, 40, 80])(
    "%i fanli reja: hech bir katak kontent zonasidan pastga tushmaydi",
    async (n) => {
      const { rects } = await render(n);
      const over = rects.filter((r) => r.y + r.h > CONTENT_BOTTOM + 0.01);
      expect(over).toEqual([]);
    },
  );

  test.each([20, 61])(
    "%i fanli ALTERNATIVLI reja: hech bir katak sahifadan chiqmaydi",
    async (n) => {
      const { rects } = await render(n, 2);
      const over = rects.filter((r) => r.y + r.h > CONTENT_BOTTOM + 0.01);
      expect(over).toEqual([]);
    },
  );

  test.each([5, 15, 40, 80])(
    "%i fanli reja: har fan qatori chizilgan (2 semestr + fanlar ro'yxati)",
    async (n) => {
      const { texts } = await render(n);
      const drawn = new Set(texts.map((t) => t.str));
      for (let i = 1; i <= n; i++) {
        expect(drawn.has(`FA${1000 + i}`)).toBe(true);
      }
    },
  );

  test("80 fanli rejada har fan kodi AYNAN 3 marta chiziladi", async () => {
    const { texts } = await render(80);
    for (let i = 1; i <= 80; i++) {
      expect(countText(texts, `FA${1000 + i}`)).toBe(3);
    }
  });

  test("ADR-016 alternativ qatori asosiy fani bilan BIR BETDA", async () => {
    const { texts } = await render(61, 2);
    const pagesOf = (s) =>
      new Set(texts.filter((t) => t.str.includes(s)).map((t) => t.page));
    for (let i = 2; i <= 61; i += 2) {
      const main = pagesOf(`FA${1000 + i}`);
      for (const suf of ["A", "B"]) {
        const alt = pagesOf(`ALT${i}${suf}`);
        expect(alt.size).toBeGreaterThan(0);
        for (const p of alt) expect(main.has(p)).toBe(true);
      }
    }
  });
});

describe("buildWorkingRejaDoc — sarlavha va 'Jami' qatorlari", () => {
  test("semestr sarlavha bloki FAQAT bir marta — davomi betida takrorlanmaydi", async () => {
    const { texts, pages } = await render(80);
    expect(pages).toBeGreaterThan(2);
    expect(countText(texts, "1-SEMESTR")).toBe(1);
    expect(countText(texts, "2-SEMESTR")).toBe(1);
    expect(countText(texts, "Talabaning o'quv yuklamasi, soatlarda")).toBe(2);
  });

  test("davomi betida qatorlar bet boshidan boshlanadi (bo'sh sarlavha joyi yo'q)", async () => {
    const { texts } = await render(80);
    const page2 = texts.filter(
      (t) => t.page === 2 && /^FA\d+$/.test(t.str) && typeof t.y === "number",
    );
    expect(page2.length).toBeGreaterThan(0);
    expect(Math.min(...page2.map((t) => t.y))).toBeLessThan(PG_M + SEM_HEAD_H);
  });

  test("'III. FANLAR RO'YXATI' sarlavhasi davomi betida ham chiziladi", async () => {
    const { texts } = await render(80);
    expect(countText(texts, "III. FANLAR RO'YXATI")).toBeGreaterThan(1);
    expect(countText(texts, "T/r")).toBe(
      countText(texts, "III. FANLAR RO'YXATI") * 2,
    );
  });

  test("'Jami' uchligi har semestrda AYNAN bir marta (oxirgi betda)", async () => {
    const { texts } = await render(80);
    expect(countText(texts, "Jami semestrda")).toBe(2);
    expect(countText(texts, "Malakaviy amaliyot")).toBe(3);
  });

  test("'Jami' qiymatlari bo'linishdan keyin ham to'g'ri (80 fan)", async () => {
    const { texts } = await render(80);
    const drawn = texts.map((t) => t.str);
    expect(drawn).toContain(String(80 * 60));
    expect(drawn).toContain(String(80 * 30));
    expect(drawn).toContain(String(80 * 2));
  });

  test("footerlar soni PDF'dagi sahifalar soniga teng (bo'sh bet yo'q)", async () => {
    const { texts, buf } = await render(80);
    const n = pageCount(buf);
    const footers = texts.filter((t) =>
      t.str.startsWith("Ishchi o'quv reja  |"),
    );
    expect(n).toBeGreaterThan(2);
    expect(footers).toHaveLength(n);
  });
});

describe("REGRESSIYA QULFI — ≤14 fanli reja chiqishi o'zgarmagan", () => {
  test.each([
    [5, 0, "db335a712d440d2d9fe3ebf5466cd0c9b678c22c7d9b8b7d78e39cd57cc84eb9"],
    [10, 0, "94c1326ee42bd1574004c82096662125b5a8daf786abc8a36823517d49bd4500"],
    [14, 0, "6ba68d4e87f335c91eebb46e38269e5c080fb471dd10432d6b92a3e1fe0c0b9a"],
    [5, 3, "5418f7560b91a8f89ec6357639ac77dd3adbcca39357640e0b68878a5faf43b4"],
    [10, 3, "4cbd835c37430e69528147b6a433591252b0b07f71ff83dec638986611b3da1b"],
    [11, 3, "f814ad0a01538a6cd6e29743c65c47b9ce07b016b24f0c801bd285a8092bd311"],
  ])(
    "N=%i alt=%i — chizish oqimi bayt darajasida bir xil",
    async (n, alt, sha) => {
      const res = await render(n, alt);
      expect(res.sha).toBe(sha);
    },
  );

  test("13 fanli rejada qo'shimcha bet OCHILMAYDI (2 bet)", async () => {
    const { buf } = await render(13);
    expect(pageCount(buf)).toBe(2);
  });
});

describe("P-13 — III bo'lim II dan keyin uzluksiz (bo'sh yarim bet yo'q)", () => {
  const pageOf = (texts, str) => texts.find((t) => t.str === str)?.page;

  test.each([4])(
    "%i fanli reja: 'III. FANLAR RO'YXATI' 'Jami o'quv yilida' bilan BIR betda",
    async (n) => {
      const { texts } = await render(n);
      expect(pageOf(texts, "III. FANLAR RO'YXATI")).toBe(
        pageOf(texts, "Jami o'quv yilida"),
      );
    },
  );

  test.each([10, 12])(
    "joy yetmasa (%i fan) — III keyingi betdan, o'rtada uzilmaydi, sarlavha bir marta",
    async (n) => {
    const { texts } = await render(n);
    const iii = pageOf(texts, "III. FANLAR RO'YXATI");
    expect(iii).toBe(pageOf(texts, "Jami o'quv yilida") + 1);
    expect(texts.filter((t) => t.str === "III. FANLAR RO'YXATI")).toHaveLength(1);
    const firstRowPages = texts
      .filter((t) => t.str.startsWith("Fan nomi 1 "))
      .map((t) => t.page);
    expect(firstRowPages).toContain(iii);
  });
});

describe("subjectListNeedsFreshPage — yetim qator qoidasi (sof funksiya)", () => {
  test("qolgan joyga sig'sa — joyida (false)", () => {
    expect(subjectListNeedsFreshPage(100, 5)).toBe(false);
  });

  test("qolgan joyga sig'masa, lekin toza betga sig'sa — butun bo'lim keyingi betga (true)", () => {
    expect(subjectListNeedsFreshPage(500, 5)).toBe(true);
    expect(subjectListNeedsFreshPage(510, 9)).toBe(true);
  });

  test("toza betga ham sig'masa — bo'linadi, lekin birinchi bo'lakda kamida MIN qator", () => {
    expect(subjectListNeedsFreshPage(450, 60)).toBe(false);
    expect(subjectListNeedsFreshPage(530, 60)).toBe(true);
    expect(SUBJ_MIN_FIRST_ROWS).toBe(3);
  });
});

describe("III bo'lim — yetim qator YO'Q (render)", () => {
  const pageOf = (texts, str) => texts.find((t) => t.str === str)?.page;
  const isTr = (s) => /^\d\.\d{2}$/.test(s);

  test.each([4, 6, 8, 10, 12, 14, 16, 20, 40])(
    "%i fanli reja: III bir betda TO'LIQ, yoki bo'linsa birinchi betida ≥ MIN qator",
    async (n) => {
      const { texts } = await render(n);
      const headers = texts.filter((t) => t.str === "III. FANLAR RO'YXATI");
      const iiiPage = pageOf(texts, "III. FANLAR RO'YXATI");
      const trAll = texts.filter((t) => isTr(t.str));
      const trOnFirst = trAll.filter((t) => t.page === iiiPage);
      if (headers.length === 1) {
        expect(trOnFirst.length).toBe(trAll.length);
      } else {
        expect(trOnFirst.length).toBeGreaterThanOrEqual(SUBJ_MIN_FIRST_ROWS);
      }
    },
  );
});

describe("semestr jadvali — 'Tanlov fanlar' bandi va kvota sloti (ADR-032)", () => {
  test("band 'Majburiy fanlar' qatorlaridan KEYIN, birinchi tanlov qatoridan OLDIN — har semestrda", async () => {
    const { texts } = await render(6);
    const strs = texts.map((t) => t.str);
    const bands = strs.reduce((acc, s, i) => (s === "Tanlov fanlar" ? [...acc, i] : acc), []);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const iLastMandatory = strs.indexOf("FA1003");
    const iFirstElective = strs.indexOf("FA1004");
    expect(bands[0]).toBeGreaterThan(iLastMandatory);
    expect(bands[0]).toBeLessThan(iFirstElective);
  });

  test("tanlov qatori bo'lmasa band chizilmaydi (semestr jadvalida)", async () => {
    const { texts } = await render(1);
    const strs = texts.map((t) => t.str);
    const iFirstRow = strs.indexOf("FA1001");
    const before = strs.slice(0, iFirstRow + 1).filter((s) => s === "Tanlov fanlar");
    expect(before).toHaveLength(0);
  });

});

describe("semestr jadvali — kvota sloti qatori (ADR-032)", () => {
  test("kvota sloti: auditoriya JAMIsi `total` particle'idan, 'Jami' qatoriga qo'shiladi", async () => {
    const wp = wpFixture(2);
    const { EMPTY_SLOT_TITLE } = require("#modules/4.02-studyLoad/_shared/planRowType");
    wp.semesters.get("1").blocks[1].sciences.push({
      serialNumber: "2.02",
      code: null,
      title: EMPTY_SLOT_TITLE,
      science: null,
      department: null,
      particle: [
        { canonical: "hour", value: 150 },
        { canonical: "total", value: 75 },
        { canonical: "independent", value: 75 },
      ],
      totalCredit: 5,
      weeklyHours: 5,
      evaluationType: null,
      alternatives: [],
    });
    WorkingPlanModel.findById = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(wp) });
    const chain = {};
    chain.populate = jest.fn().mockReturnValue(chain);
    chain.exec = jest.fn().mockResolvedValue(wsFixture());
    WorkingScheduleModel.findById = jest.fn().mockReturnValue(chain);
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildWorkingRejaDoc("wp1");
      doc.end();
      const strs = spy.mock.calls.map((c) => c[0]).map(String);
      const iSlot = strs.indexOf(EMPTY_SLOT_TITLE);
      expect(iSlot).toBeGreaterThan(0);
      expect(strs.slice(iSlot, iSlot + 4)).toEqual(expect.arrayContaining(["150", "75"]));
    } finally {
      spy.mockRestore();
    }
  });
});

describe("semestr jadvali — 'Majburiy fanlar' bandi sarlavha ostida", () => {
  test("chizish tartibi: sarlavha guruhlari va ustun nomlari → 'Majburiy fanlar' → fan qatorlari", async () => {
    const { texts } = await render(6);
    const strs = texts.map((t) => t.str);
    const iSem = strs.indexOf("1-SEMESTR");
    const iLoad = strs.indexOf("Talabaning o'quv yuklamasi, soatlarda");
    const iLastCol = strs.indexOf("Yakuniy baholash turi");
    const iBand = strs.indexOf("Majburiy fanlar");
    const iFirstRow = strs.findIndex((s) => s.startsWith("FA1001"));
    expect(iSem).toBeGreaterThanOrEqual(0);
    expect(iLoad).toBeGreaterThan(iSem);
    expect(iLastCol).toBeGreaterThan(iLoad);
    expect(iBand).toBeGreaterThan(iLastCol);
    expect(iBand).toBeLessThan(iFirstRow);
  });
});
