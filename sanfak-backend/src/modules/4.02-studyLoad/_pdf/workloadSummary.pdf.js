"use strict";
const PDFDocument = require("pdfkit");
const { registerCyrillicFonts } = require("#shared/pdfGenerators/pdfHelpers");
const { PAGE, PALETTE, cell } = require("#shared/pdfGenerators/pdfStyle");
const { resolveSignatory } = require("#modules/4.02-studyLoad/_shared/signatories");
const {
  drawSignatureBlock,
  measureSignatureBlock,
} = require("#modules/4.02-studyLoad/_shared/signatureBlock");
const {
  prepareVerifyQr,
  QR_SIZE_SLOT,
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");
const {
  HEADER_CELLS,
  rowValues,
  sumRows,
  INSTITUTE,
  fmtDate,
} = require("#modules/4.02-studyLoad/_excel/workloadSummary.xlsx");

const M = PAGE.margin;
const CW = PAGE.contentWidth;
const COL_COUNT = 20;
const W_NO = 18;
const W_DEPT = 152;
const W_HEAD = 92;
const W_NUM = (CW - W_NO - W_DEPT - W_HEAD) / (COL_COUNT - 3);
const HEADER_FIRST_ROW = 10;
const HEADER_UNIT_H = 9;
const ROW_MIN_H = 12;
const FS = 6;
const SIDE_W = 210;
const LINE_H = 14;
const BOTTOM_ROW_GAP = 8;
const TITLE_FS = 9;

const ERI_GAP_TEXT = "(ERI bilan imzolangan)";
const eriGapText = (sig) =>
  sig && (sig.source === "snapshot" || sig.source === "chain") ? ERI_GAP_TEXT : undefined;

const san = (v) => (v === null || v === undefined ? "" : String(v));

function box(doc, { x, y, w, h, text, bold = false, bg = null, align = "center" }) {
  cell(doc, x, y, w, h, "", { bg });
  const t = san(text);
  if (!t) return;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(FS).fillColor(PALETTE.text);
  const th = doc.heightOfString(t, { width: w - 3, align });
  const top = Math.max(1, (h - th) / 2);
  doc.text(t, x + 1.5, y + top, { width: w - 3, height: h - 2, align, ellipsis: true });
}

function colGeometry() {
  const widths = [W_NO, W_DEPT, W_HEAD];
  for (let i = 3; i < COL_COUNT; i++) widths.push(W_NUM);
  let x = M;
  return widths.map((w) => {
    const c = { x, w };
    x += w;
    return c;
  });
}

function parseRange(range) {
  const m = /^([A-Z])(\d+):([A-Z])(\d+)$/.exec(range);
  const colIdx = (ch) => ch.charCodeAt(0) - 65;
  return {
    c0: colIdx(m[1]),
    r0: Number(m[2]) - HEADER_FIRST_ROW,
    c1: colIdx(m[3]),
    r1: Number(m[4]) - HEADER_FIRST_ROW,
  };
}

function drawTableHeader(doc, y, cols) {
  for (const [range, text] of HEADER_CELLS) {
    const { c0, c1, r0, r1 } = parseRange(range);
    const x = cols[c0].x;
    const w = cols[c1].x + cols[c1].w - x;
    const h = (r1 - r0 + 1) * HEADER_UNIT_H;
    box(doc, { x, y: y + r0 * HEADER_UNIT_H, w, h, text, bold: true, bg: PALETTE.headerBg });
  }
  return 9 * HEADER_UNIT_H;
}

function rowHeight(doc, values, cols) {
  doc.font("Helvetica").fontSize(FS);
  let h = ROW_MIN_H;
  for (const i of [1, 2]) {
    const th = doc.heightOfString(san(values[i]), { width: cols[i].w - 3 });
    h = Math.max(h, th + 4);
  }
  return h;
}

function drawRow(doc, { y, values, cols, h }) {
  values.forEach((v, i) => {
    const align = i === 1 || i === 2 ? "left" : "center";
    box(doc, { x: cols[i].x, y, w: cols[i].w, h, text: v, align });
  });
}

function drawTotalsRow(doc, y, totals, cols) {
  const v = rowValues({ ...totals, no: "Jami", department: "", head: "" });
  v[16] = 0;
  v[18] = 0;
  v[19] = 0;
  const mergedW = cols[0].w + cols[1].w + cols[2].w;
  const bg = PALETTE.accentBg;
  box(doc, { x: cols[0].x, y, w: mergedW, h: ROW_MIN_H, text: "Jami", bold: true, bg });
  for (let i = 3; i < COL_COUNT; i++) {
    box(doc, { x: cols[i].x, y, w: cols[i].w, h: ROW_MIN_H, text: v[i] ?? 0, bold: true, bg });
  }
  return ROW_MIN_H;
}

function coverSig(docLike, step) {
  return resolveSignatory(docLike, { step, snapshot: docLike.verify?.snapshot });
}

function drawCover(doc, docLike, qr) {
  const y0 = M + 2;
  const rekSig = coverSig(docLike, "rektor");
  const proSig = coverSig(docLike, "prorektor");
  const slotQr = qr ? { image: qr.image, size: QR_SIZE_SLOT } : undefined;

  const hL = drawSignatureBlock(doc, {
    x: M,
    y: y0,
    w: SIDE_W,
    align: "center",
    heading: '"TASDIQLAYMAN"',
    position: [`${INSTITUTE.replace(" instituti", "")}`, "instituti rektori"],
    sig: rekSig,
    gapText: eriGapText(rekSig),
    qr: slotQr,
  });
  const hR = drawSignatureBlock(doc, {
    x: M + CW - SIDE_W,
    y: y0,
    w: SIDE_W,
    align: "center",
    heading: '"KELISHILDI"',
    position: ["O'quv ishlari bo'yicha", "prorektor"],
    sig: proSig,
    gapText: eriGapText(proSig),
    qr: slotQr,
  });
  return y0 + Math.max(hL, hR) + 6;
}

function drawTitle(doc, y, docLike, dateObj) {
  const title = `${INSTITUTE} ${san(docLike.academicYearTitle)}-o'quv yili uchun kafedralar soatlar hisobi va ish o'rinlari`;
  doc.font("Helvetica-Bold").fontSize(TITLE_FS).fillColor(PALETTE.text);
  doc.text(title, M, y, { width: CW, align: "center" });
  y += doc.heightOfString(title, { width: CW }) + 1;
  doc.text("JADVALI", M, y, { width: CW, align: "center" });
  y += TITLE_FS * 1.3 + 2;
  doc.font("Helvetica").fontSize(FS + 1).fillColor(PALETTE.muted);
  doc.text(`${fmtDate(dateObj)}-yil`, M, y, { width: CW, align: "right" });
  return y + (FS + 1) * 1.3 + 4;
}

function bottomRows(docLike, qr) {
  const mk = (label, step) => {
    const sig = coverSig(docLike, step);
    return {
      x: M + 20,
      w: CW - 40,
      layout: "row",
      position: label,
      sig: { ...sig, dateText: "" },
      statusText: ERI_GAP_TEXT,
      qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
    };
  };
  return [
    mk("O'quv-uslubiy boshqarma boshlig'i:", "methodical"),
    mk("Reja moliya bo'limi boshlig'i:", "financial"),
  ];
}

function drawBottomSignatures(doc, y, docLike, qr) {
  const rows = bottomRows(docLike, qr);
  const rowsH = rows.reduce(
    (sum, o) => sum + Math.max(LINE_H, measureSignatureBlock(doc, o)) + BOTTOM_ROW_GAP,
    0,
  );
  if (y + 10 + rowsH > PAGE.height - M) {
    doc.addPage();
    y = M;
  }
  y += 10;
  for (const o of rows) {
    const h = drawSignatureBlock(doc, { ...o, y });
    y += Math.max(LINE_H, h) + BOTTOM_ROW_GAP;
  }
  return y;
}

function drawFooters(doc, docLike) {
  const range = doc.bufferedPageRange();
  const label = `Kafedralar soatlar hisobi · ${san(docLike.academicYearTitle)}`;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font("Helvetica").fontSize(5).fillColor("#999");
    doc.text(`${label} | ${i + 1} / ${range.count}`, M, PAGE.height - M + 4, {
      width: CW,
      align: "center",
      lineBreak: false,
    });
    doc.page.margins.bottom = bottomMargin;
  }
}

function drawTable(doc, y, docLike, cols) {
  const rows = docLike.snapshot?.rows || [];
  const totals = docLike.snapshot?.totals || sumRows(rows);
  const bottomLimit = PAGE.height - M;
  y += drawTableHeader(doc, y, cols);
  for (const r of rows) {
    const values = rowValues(r);
    const h = rowHeight(doc, values, cols);
    if (y + h > bottomLimit) {
      doc.addPage();
      y = M + drawTableHeader(doc, M, cols);
    }
    drawRow(doc, { y, values, cols, h });
    y += h;
  }
  if (y + ROW_MIN_H > bottomLimit) {
    doc.addPage();
    y = M + drawTableHeader(doc, M, cols);
  }
  return y + drawTotalsRow(doc, y, totals, cols);
}

async function buildWorkloadSummaryPdf(docLike) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: M, bottom: M, left: M, right: M },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
  });
  registerCyrillicFonts(doc);

  const qr = await prepareVerifyQr(docLike, { docType: "workloadSummary" });
  const cols = colGeometry();
  const dateObj = new Date(docLike.snapshot?.generatedAt || docLike.createdAt || Date.now());

  let y = drawCover(doc, docLike, qr);
  y = drawTitle(doc, y, docLike, dateObj);
  y = drawTable(doc, y, docLike, cols);
  drawBottomSignatures(doc, y, docLike, qr);
  drawFooters(doc, docLike);
  return doc;
}

module.exports = { buildWorkloadSummaryPdf };
module.exports._geometry = { colGeometry, parseRange, COL_COUNT, HEADER_UNIT_H };
