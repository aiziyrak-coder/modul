const PDFDocument = require("pdfkit");

jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const { buildScienceProgramPdf } = require("./scienceProgram.pdf");
const FIXTURE = require("./scienceProgram.pdf.v259Look.fixture.json");
const GOLDEN = require("./scienceProgram.pdf.v259Look.golden.json");

const PH = 842;
const M = 50;
const NO_W = 40;
const BODY_W = 495 - NO_W;
const PAGE_NUMBER_Y = 797;
const HDR_FILL_OLD = "#d9e2f0";
const REG_PREFIX = "Ro'yxatga olindi: № ";
const REG_BLANK = `${REG_PREFIX}________`;
const ROW_NUMBERS = ["1.", "2.", "3.", "4.", "5.", "6.", "7.", "8.", "9."];

const chainablePopulate = (resolvedDoc) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.exec = jest.fn().mockResolvedValue(resolvedDoc);
  return chain;
};

const fixture = (overrides = {}) => {
  const base = JSON.parse(JSON.stringify(FIXTURE));
  delete base._comment;
  return { ...base, ...overrides };
};

const build = (overrides) => {
  ScienceProgram.findById = jest
    .fn()
    .mockReturnValue(chainablePopulate(fixture(overrides)));
  return buildScienceProgramPdf("sp");
};

const docToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const render = async (overrides) => {
  const texts = [];
  const rects = [];
  const fills = [];
  const origText = PDFDocument.prototype.text;
  const textSpy = jest
    .spyOn(PDFDocument.prototype, "text")
    .mockImplementation(function spyText(str, x, y, opts) {
      if (typeof str === "string") {
        texts.push({
          str,
          x: typeof x === "number" ? x : null,
          y: typeof y === "number" ? y : null,
          fs: this._fontSize,
          opts: (typeof x === "object" && x) || opts || {},
        });
      }
      return origText.apply(this, arguments);
    });
  const rectSpy = jest.spyOn(PDFDocument.prototype, "rect");
  const fillSpy = jest.spyOn(PDFDocument.prototype, "fill");
  const fasSpy = jest.spyOn(PDFDocument.prototype, "fillAndStroke");
  try {
    const doc = await build(overrides);
    const buf = await docToBuffer(doc);
    rects.push(...rectSpy.mock.calls.map(([x, y, w, h]) => ({ x, y, w, h })));
    fills.push(...fillSpy.mock.calls.map((c) => c[0]), ...fasSpy.mock.calls.map((c) => c[0]));
    return { texts, rects, fills, buf };
  } finally {
    textSpy.mockRestore();
    rectSpy.mockRestore();
    fillSpy.mockRestore();
    fasSpy.mockRestore();
  }
};

const pageCount = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const strings = (texts) => texts.map((t) => t.str);
const regLine = (texts) => texts.find((t) => t.str.startsWith(REG_PREFIX));

const bodyChunksOf = (rects) => {
  const contentCells = rects.filter((r) => r.x === M + NO_W && r.w === BODY_W);
  return rects.filter(
    (r) => r.x === M && r.w === NO_W && contentCells.some((cc) => cc.y === r.y && cc.h === r.h),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("A-13 — muqova «Ro'yxatga olindi: № …» qatori", () => {
  test("yo'nalish kodi + tartib raqami bor — `№ <kod> <tartib>` («BD» prefiksisiz)", async () => {
    const { texts } = await render({
      directions: [{ name: "Davolash ishi", directionCode: "60910200" }],
      serialNumber: "1.05",
    });
    expect(strings(texts)).toContain(`${REG_PREFIX}60910200 1.05`);
  });

  test("tartib raqami yo'q — bo'sh chiziq", async () => {
    const { texts } = await render({
      directions: [{ name: "Davolash ishi", directionCode: "60910200" }],
      serialNumber: null,
    });
    expect(strings(texts)).toContain(REG_BLANK);
    expect(strings(texts).filter((s) => s.startsWith(REG_PREFIX))).toHaveLength(1);
  });

  test("yo'nalish kodi yo'q — bo'sh chiziq (tartib raqami yolg'iz chizilmaydi)", async () => {
    const { texts } = await render({ directions: [{ name: "Davolash ishi" }], serialNumber: "1.05" });
    expect(strings(texts)).toContain(REG_BLANK);
    expect(strings(texts).some((s) => s.includes("1.05"))).toBe(false);
  });

  test("qator TASDIQLAYMAN blokidan KEYIN, fan nomidan OLDIN, o'sha ustunda; ortidan shablon sana", async () => {
    const { texts } = await render();
    const iHead = texts.findIndex((t) => t.str === '"TASDIQLAYMAN"');
    const iReg = texts.findIndex((t) => t.str.startsWith(REG_PREFIX));
    const iName = texts.findIndex((t) => t.str === "ICHKI KASALLIKLAR PROPEDEVTIKASI");
    expect(iHead).toBeGreaterThanOrEqual(0);
    expect(iReg).toBeGreaterThan(iHead);
    expect(iName).toBeGreaterThan(iReg);
    expect(texts[iReg].x).toBe(texts[iHead].x);
    expect(texts[iReg + 1].str).toBe("202__ yil “___” ________");
  });

  test("legacy (formVersion yo'q) hujjat ham v259 yo'lida — qator chiziladi", async () => {
    const d = fixture({ directions: [{ name: "Davolash ishi", directionCode: "60910200" }], serialNumber: "3.01" });
    delete d.formVersion;
    ScienceProgram.findById = jest.fn().mockReturnValue(chainablePopulate(d));
    const texts = [];
    const spy = jest.spyOn(PDFDocument.prototype, "text");
    try {
      const doc = await buildScienceProgramPdf("spLegacy");
      await docToBuffer(doc);
      texts.push(...spy.mock.calls.map((c) => c[0]).filter((s) => typeof s === "string"));
    } finally {
      spy.mockRestore();
    }
    expect(texts).toContain(`${REG_PREFIX}60910200 3.01`);
  });
});

describe("A-12a — §1 jadvalda sarlavha foni YO'Q", () => {
  test("build davomida eski `#d9e2f0` foni (va umuman rangli fill) chaqirilmaydi", async () => {
    const { fills } = await render();
    expect(fills).not.toContain(HDR_FILL_OLD);
    expect(fills.filter((c) => typeof c === "string")).toHaveLength(0);
  });

  test("§1 matnlari va qiymatlari o'z joyida (sarlavha + qiymat)", async () => {
    const { texts } = await render();
    const s = strings(texts);
    for (const t of [
      "Fan/modul kodi", "O'quv yili", "Semestr", "ECTS - Kreditlar",
      "Fan/modul turi", "Ta'lim tili", "Haftadagi dars soatlari",
      "Fanning nomi", "Auditoriya\nMashg'ulotlari\n(soat)", "Mustaqil\nta'lim\n(soat)", "Jami\nyuklama\n(soat)",
      "IKP 2205", "2025/2026", "5/6", "8", "Majburiy", "O'zbek/rus", "6", "120", "240",
    ]) {
      expect(s).toContain(t);
    }
    expect(s).not.toContain("O'quv rejadagi tartib raqami");
  });
});

describe("A-12b — tana «1.»…«9.» ramkali qatorlar (chap raqam ustuni)", () => {
  test("to'liq hujjatda 9 raqam ham bor, har biri ALOHIDA matn, bittadan", async () => {
    const { texts } = await render();
    const s = strings(texts);
    for (const n of ROW_NUMBERS) {
      expect(s.filter((x) => x === n)).toHaveLength(1);
    }
  });

  test("«2.»…«9.» raqam katagi `x = M`, kengligi `NO_W`; har bo'lak uchun ikki ramka (raqam + kontent)", async () => {
    const { texts, rects } = await render();
    for (const n of ROW_NUMBERS.slice(1)) {
      const call = texts.find((t) => t.str === n);
      expect(call.x).toBe(M);
      expect(call.opts.width).toBe(NO_W);
    }
    const chunks = bodyChunksOf(rects);
    expect(chunks.length).toBeGreaterThanOrEqual(8);
    const oneCell = rects.filter((r) => r.x === M && r.w === NO_W && !chunks.includes(r));
    expect(oneCell).toHaveLength(1);
    expect(oneCell[0].h).toBeGreaterThan(40);
    for (const n of ROW_NUMBERS.slice(1)) {
      const call = texts.find((t) => t.str === n);
      expect(chunks.some((ch) => call.y === ch.y + 3)).toBe(true);
    }
  });

  test("betdan baland «2.» qatori paragraflar bo'yicha bo'laklanadi — raqam faqat birinchi bo'lakda, bo'sh bet yo'q", async () => {
    const { texts, rects, buf } = await render();
    const pages = pageCount(buf);
    expect(pages).toBeGreaterThanOrEqual(4);
    expect(bodyChunksOf(rects).length).toBeGreaterThan(8);
    expect(strings(texts).filter((s) => s === "2.")).toHaveLength(1);
    expect(texts.filter((t) => t.y === PAGE_NUMBER_Y)).toHaveLength(pages);
  });

  test("BITTA paragraf betdan baland (90 bandli adabiyotlar bloki) — 500 yo'q, matn to'liq, ramka har betda", async () => {
    const many = Array.from({ length: 90 }, (_, i) =>
      `Muallif${i + 1} A.A. Ichki kasalliklar propedevtikasi bo'yicha o'quv qo'llanma, ${i + 1}-jild. - Toshkent: Tibbiyot nashriyoti, 2024.`,
    );
    const { texts, rects, buf } = await render({
      literatureGroups: [{ slug: "primary", title: "Asosiy adabiyotlar", literatures: many }],
    });
    const pages = pageCount(buf);
    expect(pages).toBeGreaterThanOrEqual(6);
    const lit = texts.find((t) => t.str.startsWith("1. Muallif1 "));
    expect(lit).toBeDefined();
    expect(lit.str).toContain("90. Muallif90 ");
    expect(rects.filter((r) => r.x === M && r.w === NO_W).length).toBeGreaterThanOrEqual(pages - 1);
    expect(texts.filter((t) => t.y === PAGE_NUMBER_Y)).toHaveLength(pages);
    for (const n of ["7.", "8.", "9."]) expect(strings(texts)).toContain(n);
  });

  test("tana matni 12 pt, bo'lim sarlavhalari qalin 12 pt (ilgari 10/11)", async () => {
    const { texts } = await render();
    const heading = texts.find((t) => t.str === "I. Fanning mazmuni");
    const topic = texts.find((t) => t.str.startsWith("Propedevtika fanining tibbiyot tarixidagi"));
    expect(heading.fs).toBeGreaterThanOrEqual(12);
    expect(topic.fs).toBe(12);
  });
});

describe("A-11 — TASDIQLAYMAN bloki pastroq va kattaroq", () => {
  test("heading `0.20·PH ≤ y ≤ 0.30·PH` va shrift ≥ 13 pt; lavozim 12 pt", async () => {
    const { texts } = await render();
    const head = texts.find((t) => t.str === '"TASDIQLAYMAN"');
    expect(head).toBeDefined();
    expect(head.y).toBeGreaterThanOrEqual(0.2 * PH);
    expect(head.y).toBeLessThanOrEqual(0.3 * PH);
    expect(head.fs).toBeGreaterThanOrEqual(13);
    const pos = texts.find((t) => t.str === "Farg'ona jamoat salomatligi tibbiyot instituti rektori");
    expect(pos.fs).toBe(12);
  });

  test("blok, ro'yxat qatori va fan nomi bir-birining ustiga chiqmaydi; «FARG'ONA – … YIL» o'z joyida", async () => {
    const { texts } = await render();
    const head = texts.find((t) => t.str === '"TASDIQLAYMAN"');
    const reg = regLine(texts);
    const name = texts.find((t) => t.str === "ICHKI KASALLIKLAR PROPEDEVTIKASI");
    const city = texts.find((t) => /^FARG'ONA – \d{4} YIL$/.test(t.str));
    expect(reg.y).toBeGreaterThan(head.y + 40);
    expect(name.y).toBeGreaterThan(reg.y + 20);
    expect(city.y).toBe(PH - M - 35);
  });
});

describe("MAZMUN QULFI — chizilgan matn to'plami oldingi generator bilan AYNAN teng", () => {
  test("golden ro'yxat (ataylab qo'shilgan 3 matndan tashqari) — bitta qiymat ham qo'shilmagan/yo'qolmagan/o'zgarmagan", async () => {
    const { texts } = await render();
    const drawn = texts.filter((t) => t.y !== PAGE_NUMBER_Y);
    const iReg = drawn.findIndex((t) => t.str.startsWith(REG_PREFIX));
    expect(iReg).toBeGreaterThan(0);
    drawn.splice(iReg, 2);
    const iSix = drawn.findIndex((t) => t.str === "6.");
    expect(iSix).toBeGreaterThan(0);
    drawn.splice(iSix, 1);
    const actual = drawn.map((t) => t.str).sort();
    expect(actual).toEqual([...GOLDEN].sort());
  });

  test("golden faylining o'zi to'liq: 98 matn, muqova + §1 + 2…9 qatorlar", () => {
    expect(GOLDEN).toHaveLength(98);
    for (const must of [
      '"TASDIQLAYMAN"', "I. Fanning mazmuni", "Fan dasturi tasdiqlash ma'lumoti", "Taqrizchilar:",
      "1.", "2.", "3.", "4.", "5.", "7.", "8.", "9.",
    ]) {
      expect(GOLDEN).toContain(must);
    }
    expect(GOLDEN).not.toContain("6.");
    expect(GOLDEN.some((s) => s.startsWith(REG_PREFIX))).toBe(false);
  });
});
