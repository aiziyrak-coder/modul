"use strict";
jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("fake-qr")),
}));

const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const { PAGE } = require("#shared/pdfGenerators/pdfStyle");
const { HEADER_CELLS } = require("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx");
const { buildWorkloadSummaryPdf, _geometry } = require("./workloadSummary.pdf");

const PUBLIC_BASE_URL_BACKUP = process.env.PUBLIC_BASE_URL;
beforeAll(() => {
  process.env.PUBLIC_BASE_URL = "https://verify.test";
});
afterAll(() => {
  process.env.PUBLIC_BASE_URL = PUBLIC_BASE_URL_BACKUP;
});
beforeEach(() => jest.clearAllMocks());

const row = (i) => ({
  no: i,
  department: i === 3 ? "Normal anatomiya, operativ jarrohlik va topografik anatomiya kafedrasi" : `Kafedra ${i}`,
  head: "A.R.Abdulxakimov",
  total: 200 + i,
  hourly: 150 + i,
  forDistribution: 50,
  positions: 2.5,
  dh: { professor: 0, docent: 1, seniorTeacher: 0, assistant: 0 },
  ts: { professor: 0, docent: 1, seniorTeacher: 0, assistant: 0.5 },
  supportTotal: 1,
  support: { cabinetHead: 1, laborant: 0 },
});
const totals = {
  total: 1,
  hourly: 1,
  forDistribution: 1,
  positions: 1,
  dh: { professor: 0, docent: 0, seniorTeacher: 0, assistant: 0 },
  ts: { professor: 0, docent: 0, seniorTeacher: 0, assistant: 0 },
  supportTotal: 0,
  support: { cabinetHead: 0, laborant: 0 },
};
const snap = (step, shortName) => ({ step, label: step, shortName, date: new Date(2026, 8, 17) });

function fixture({ n = 1, status = "draft", snapshotChain = false } = {}) {
  const rows = Array.from({ length: n }, (_, i) => row(i + 1));
  return {
    _id: "6aabed57724a5b474e97c53c",
    status,
    academicYearTitle: "2024/2025",
    snapshot: { rows, totals, generatedAt: new Date("2026-09-17T12:00:00Z") },
    approvalSteps: [],
    verify:
      status === "approved"
        ? {
            token: "a".repeat(32),
            revokedAt: null,
            snapshot: snapshotChain
              ? [
                  snap("methodical", "S.Yo'ldoshev"),
                  snap("financial", "M.Aripov"),
                  snap("prorektor", "U.Boltaboyev"),
                  snap("rektor", "A.Sidikov"),
                ]
              : [],
          }
        : {},
  };
}

async function render(docLike) {
  const textSpy = jest.spyOn(PDFDocument.prototype, "text");
  const imageSpy = jest.spyOn(PDFDocument.prototype, "image");
  try {
    const doc = await buildWorkloadSummaryPdf(docLike);
    const pages = doc.bufferedPageRange().count;
    doc.end();
    return {
      pages,
      texts: textSpy.mock.calls.map((c) => c[0]).filter((t) => typeof t === "string"),
      imageCalls: imageSpy.mock.calls,
    };
  } finally {
    textSpy.mockRestore();
    imageSpy.mockRestore();
  }
}

describe("geometriya — Excel bilan bir manba", () => {
  test("20 ustun, yig'indi = kontent kengligi (806)", () => {
    const cols = _geometry.colGeometry();
    expect(cols).toHaveLength(_geometry.COL_COUNT);
    const sum = cols.reduce((a, c) => a + c.w, 0);
    expect(sum).toBeCloseTo(PAGE.contentWidth, 6);
    expect(cols[0].x).toBe(PAGE.margin);
  });

  test("HEADER_CELLS diapazonlari 0..19 ustun / 0..8 qator ichida, A..T to'liq qoplangan", () => {
    const covered = new Set();
    for (const [range] of HEADER_CELLS) {
      const { c0, c1, r0, r1 } = _geometry.parseRange(range);
      expect(c0).toBeGreaterThanOrEqual(0);
      expect(c1).toBeLessThan(_geometry.COL_COUNT);
      expect(r0).toBeGreaterThanOrEqual(0);
      expect(r1).toBeLessThanOrEqual(8);
      expect(c1).toBeGreaterThanOrEqual(c0);
      expect(r1).toBeGreaterThanOrEqual(r0);
      if (r1 === 8) for (let c = c0; c <= c1; c++) covered.add(c);
    }
    expect(covered.size).toBe(_geometry.COL_COUNT);
  });
});

describe("matn — blanka satrlari (Excel bilan bir xil)", () => {
  test("sarlavha, muqova, imzo yorliqlari, Jami", async () => {
    const { texts } = await render(fixture({ n: 2 }));
    const joined = texts.join("\n");
    expect(joined).toContain("2024/2025-o'quv yili uchun kafedralar soatlar hisobi va ish o'rinlari");
    expect(joined).toContain("JADVALI");
    expect(joined).toContain('"TASDIQLAYMAN"');
    expect(joined).toContain('"KELISHILDI"');
    expect(joined).toContain("O'quv-uslubiy boshqarma boshlig'i:");
    expect(joined).toContain("Reja moliya bo'limi boshlig'i:");
    expect(joined).toContain("Jami");
    expect(joined).toContain("17.09.2026-yil");
    for (const [, text] of HEADER_CELLS) expect(texts).toContain(text);
  });

  test("jadval SURATDAN — qator qiymatlari va kafedra nomi chiziladi", async () => {
    const { texts } = await render(fixture({ n: 3 }));
    expect(texts).toContain("Normal anatomiya, operativ jarrohlik va topografik anatomiya kafedrasi");
    expect(texts).toContain("203");
    expect(texts).toContain("A.R.Abdulxakimov");
  });
});

describe("QR darvozasi (ADR-020/021)", () => {
  test("draft — QR yo'q, toBuffer 0×, image 0×", async () => {
    const { imageCalls } = await render(fixture({ n: 1, status: "draft" }));
    expect(QRCode.toBuffer).not.toHaveBeenCalled();
    expect(imageCalls).toHaveLength(0);
  });

  test("approved + token, snapshot bo'sh — toBuffer 1×, lekin image 0× (slot darvozasi: haqiqiy imzo yo'q)", async () => {
    const { imageCalls } = await render(fixture({ n: 1, status: "approved", snapshotChain: false }));
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCalls).toHaveLength(0);
  });

  test("approved + 4 bosqichli snapshot — toBuffer 1×, image 4× (2 muqova + 2 qator), bitta buffer", async () => {
    const { imageCalls, texts } = await render(fixture({ n: 1, status: "approved", snapshotChain: true }));
    expect(QRCode.toBuffer).toHaveBeenCalledTimes(1);
    expect(imageCalls).toHaveLength(4);
    expect(new Set(imageCalls.map((c) => c[0])).size).toBe(1);
    expect(texts).toContain("A.Sidikov");
    expect(texts).toContain("U.Boltaboyev");
    expect(texts).toContain("S.Yo'ldoshev");
    expect(texts).toContain("M.Aripov");
  });
});

describe("sahifalash", () => {
  test("1 qator — aynan 1 sahifa (footer pastki hoshiya tuzog'i yo'q)", async () => {
    const { pages } = await render(fixture({ n: 1 }));
    expect(pages).toBe(1);
  });

  test("55 qator — ≥ 2 sahifa, sarlavha har sahifada takrorlanadi", async () => {
    const { pages, texts } = await render(fixture({ n: 55 }));
    expect(pages).toBeGreaterThanOrEqual(2);
    const headerHits = texts.filter((t) => t === "Kafedra nomi").length;
    expect(headerHits).toBe(pages);
    expect(texts.filter((t) => t === "Jami")).toHaveLength(pages + 1);
  });
});
