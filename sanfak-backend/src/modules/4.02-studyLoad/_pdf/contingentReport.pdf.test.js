"use strict";
jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { PAGE } = require("#shared/pdfGenerators/pdfStyle");
const { buildSummary, NUM_FIELDS } = require("#modules/4.02-studyLoad/_services/contingentSummary");
const { buildContingentReportPdf, _geometry } = require("./contingentReport.pdf");

const PUBLIC_BASE_URL_BACKUP = process.env.PUBLIC_BASE_URL;
beforeAll(() => {
  process.env.PUBLIC_BASE_URL = "https://verify.test";
});
afterAll(() => {
  process.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL_BACKUP;
});
beforeEach(() => jest.clearAllMocks());

const row = (direction, course, over = {}) => ({
  direction,
  directionCode: direction === "d1" ? "60910200" : "",
  directionTitle: direction === "d1" ? "Davolash ishi" : `Yo'nalish ${direction}`,
  category: "milliy",
  course,
  total: 392,
  boys: 151,
  girls: 241,
  grant: 143,
  contract: 249,
  grantBoys: 50,
  grantGirls: 93,
  contractBoys: 101,
  contractGirls: 148,
  groupCount: 26,
  streamCount: 2,
  mobilityOut: 0,
  mobilityIn: 0,
  ...over,
});

function facultyDoc({ n = 1, status = "draft", snapshotChain = false } = {}) {
  const rows = [];
  for (let d = 1; d <= n; d++) for (let c = 1; c <= 6; c++) rows.push(row(`d${d}`, c));
  return {
    _id: "6aabed57724a5b474e97c53c",
    status,
    facultyTitle: "Davolash ishi fakulteti",
    academicYearTitle: "2026/2027",
    asOfDate: new Date("2026-07-16T09:00:00Z"),
    rows,
    foreignByCountry: [
      { country: "Hindiston", total: 1476, boys: 838, girls: 638 },
      { country: "Kanada", total: 2, boys: 2, girls: 0 },
    ],
    approvalSteps: [{ step: "dean", status: status === "approved" ? "approved" : "pending" }],
    verify:
      status === "approved"
        ? {
            token: "a".repeat(32),
            revokedAt: null,
            snapshot: snapshotChain
              ? [{ step: "dean", label: "Fakultet dekani", shortName: "R.A.Rahmonov", date: new Date(2026, 8, 22) }]
              : [],
          }
        : {},
  };
}

async function render(opts) {
  const textSpy = jest.spyOn(PDFDocument.prototype, "text");
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  try {
    const pdf = await buildContingentReportPdf(opts);
    const pages = pdf.bufferedPageRange().count;
    pdf.end();
    return {
      pages,
      texts: textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string" && t !== ""),
      imageCalls: imageSpy.mock.calls,
    };
  } finally {
    textSpy.mockRestore();
    imageSpy.mockRestore();
  }
}

const facultyOpts = (fx) => ({
  variant: "faculty",
  doc: fx,
  academicYearTitle: fx.academicYearTitle,
  asOfDate: fx.asOfDate,
  summary: buildSummary({ reports: [fx] }),
});

describe("geometriya", () => {
  test("15 ustun (yo'nalish + kurs + 13 raqam), yig'indi = kontent kengligi", () => {
    const cols = _geometry.colGeometry();
    expect(cols).toHaveLength(2 + NUM_FIELDS.length);
    expect(cols.reduce((a, c) => a + c.w, 0)).toBeCloseTo(PAGE.contentWidth, 6);
    expect(cols[0].x).toBe(PAGE.margin);
  });

  test("HEADER_CELLS 0..14 ustun / 0..1 qator ichida, pastki qator har ustunda qoplangan", () => {
    const covered = new Set();
    for (const [, c0, span, r0, rows] of _geometry.HEADER_CELLS) {
      expect(c0).toBeGreaterThanOrEqual(0);
      expect(c0 + span - 1).toBeLessThan(15);
      expect(r0 + rows).toBeLessThanOrEqual(2);
      if (r0 + rows === 2) for (let c = c0; c < c0 + span; c++) covered.add(c);
    }
    expect(covered.size).toBe(15);
  });
});

describe("matn — namuna satrlari (Bakalavr.pdf)", () => {
  test("fakultet varianti: sarlavha, sana, ustunlar, JAMI, fakultet jami, 3-bet jadvallar, dekan imzosi", async () => {
    const { texts } = await render(facultyOpts(facultyDoc({ n: 2 })));
    const joined = texts.join("\n");
    expect(joined).toContain(
      "Farg'ona jamoat salomatligi tibbiyot instituti Davolash ishi fakulteti kunduzgi bakalavr ta'lim shaklida o'qiyotgan talabalar kontingenti",
    );
    expect(texts).toContain("16.07.2026");
    for (const [text] of _geometry.HEADER_CELLS) expect(texts).toContain(text);
    expect(texts).toContain("60910200-Davolash ishi (milliy)");
    expect(texts).toContain("JAMI:");
    expect(texts).toContain("Davolash ishi fakulteti bo'yicha jami");
    expect(texts).toContain("1-kurs");
    expect(texts).toContain("6-kurs");
    expect(texts).toContain("Fakultetlar nomi");
    expect(texts).toContain("Davolash ishi");
    expect(texts).toContain("Xorijlik talabalar kontingenti");
    expect(texts).toContain("Davlatlar");
    expect(texts).toContain("Hindiston");
    expect(texts).toContain("1476");
    expect(texts).toContain("Davolash ishi fakulteti dekani:");
    expect(texts.filter((t) => t === "JAMI:").length).toBe(2 + 3);
  });

  test("yig'ma varianti: institut JAMI, fakultet×kurs qatorlari, O'UB imzo yorlig'i, QR yo'q", async () => {
    const a = facultyDoc({ n: 1 });
    const b = { ...facultyDoc({ n: 1 }), facultyTitle: "Pediatriya fakulteti", rows: [row("d9", 1)] };
    const summary = buildSummary({
      reports: [a, b],
      faculties: [
        { _id: "f1", title: "Davolash ishi fakulteti" },
        { _id: "f2", title: "Pediatriya fakulteti" },
        { _id: "f3", title: "Xalqaro fakultet" },
      ],
    });
    const { texts, imageCalls } = await render({
      variant: "institute",
      academicYearTitle: "2026/2027",
      asOfDate: new Date("2026-07-16"),
      summary,
    });
    expect(texts).toContain("Pediatriya fakulteti bo'yicha jami");
    expect(texts).toContain("Pediatriya");
    expect(texts).toContain("O'quv-uslubiy boshqarma boshlig'i:");
    expect(texts).not.toContain("Davolash ishi fakulteti dekani:");
    expect(texts.filter((t) => t === "JAMI:").length).toBe(6);
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(imageCalls).toHaveLength(0);
  });
});

describe("Jadval 4 — davlatlar", () => {
  test("davlatlar jadvalida 0 — bo'sh katak (namunadagidek), JAMI qatorida esa raqam", async () => {
    const { texts } = await render(facultyOpts(facultyDoc({ n: 1 })));
    const idx = texts.indexOf("Kanada");
    expect(idx).toBeGreaterThan(0);
    expect(texts.slice(idx + 1, idx + 3)).toEqual(["2", "2"]);
    expect(texts[idx + 3]).toBe("JAMI:");
    expect(texts).toContain("638");
  });
});

describe("QR darvozasi (ADR-020/021) — faqat fakultet varianti", () => {
  test("draft — toBuffer 0×, image 0×", async () => {
    const { imageCalls } = await render(facultyOpts(facultyDoc({ status: "draft" })));
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(imageCalls).toHaveLength(0);
  });

  test("approved + snapshot — toBuffer 1×, image 1× (imzo qatori), dekan ismi", async () => {
    const { imageCalls, texts } = await render(facultyOpts(facultyDoc({ status: "approved", snapshotChain: true })));
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCalls).toHaveLength(1);
    expect(texts).toContain("R.A.Rahmonov");
  });

  test("approved + token, lekin zanjirda haqiqiy imzo yo'q — toBuffer 1×, image 0× (slot darvozasi)", async () => {
    const fx = facultyDoc({ status: "approved", snapshotChain: false });
    fx.approvalSteps = [{ step: "dean", status: "pending" }];
    const { imageCalls } = await render(facultyOpts(fx));
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCalls).toHaveLength(0);
  });
});

describe("sahifalash", () => {
  test("1 yo'nalish — 3-bet jadvallar ham sig'adi, sarlavha har sahifada (Jadval 1 + Jadval 2)", async () => {
    const { pages, texts } = await render(facultyOpts(facultyDoc({ n: 1 })));
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(texts.filter((t) => t === "Ta'lim yunalishi").length).toBeGreaterThanOrEqual(2);
  });

  test("8 yo'nalish × 6 kurs (Davolash o'lchovi) — ≥ 2 sahifa, yo'nalish yorlig'i har bo'lakda", async () => {
    const { pages, texts } = await render(facultyOpts(facultyDoc({ n: 8 })));
    expect(pages).toBeGreaterThanOrEqual(2);
    expect(texts.filter((t) => t === "JAMI:").length).toBe(8 + 3);
    expect(texts.filter((t) => t === "Ta'lim yunalishi").length).toBeGreaterThanOrEqual(pages);
  });
});
