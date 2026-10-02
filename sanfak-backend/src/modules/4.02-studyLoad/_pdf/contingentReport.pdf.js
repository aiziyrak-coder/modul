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
  QR_SIZE_ROW,
} = require("#modules/4.02-studyLoad/_shared/verifyQr");
const {
  NUM_FIELDS,
  MAX_COURSE,
} = require("#modules/4.02-studyLoad/_services/contingentSummary");

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";

const M = PAGE.margin;
const CW = PAGE.contentWidth;
const W_DIR = 190;
const W_COURSE = 34;
const W_NUM = (CW - W_DIR - W_COURSE) / NUM_FIELDS.length;
const HEADER_UNIT_H = 14;
const ROW_H = 12;
const FS = 6;
const TITLE_FS = 9;
const TABLE_GAP = 14;
const LINE_H = 14;

const HEADER_CELLS = [
  ["Ta'lim yunalishi", 0, 1, 0, 2],
  ["Kursi", 1, 1, 0, 2],
  ["Jami talaba", 2, 1, 0, 2],
  ["O'g'il", 3, 1, 0, 2],
  ["Qiz", 4, 1, 0, 2],
  ["Grant", 5, 1, 0, 2],
  ["Shart-noma", 6, 1, 0, 2],
  ["Grant", 7, 2, 0, 1],
  ["O'g'il", 7, 1, 1, 1],
  ["Qiz", 8, 1, 1, 1],
  ["Shartnoma", 9, 2, 0, 1],
  ["O'g'il", 9, 1, 1, 1],
  ["Qiz", 10, 1, 1, 1],
  ["Guruh soni", 11, 1, 0, 2],
  ["Oqimlar soni", 12, 1, 0, 2],
  ["Akademik mobillik yuborilgan", 13, 1, 0, 2],
  ["Akademik mobillik kelgan", 14, 1, 0, 2],
];

const san = (v) => (v === null || v === undefined ? "" : String(v));
const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

function box(doc, { x, y, w, h, text, bold = false, bg = null, align = "center", fs = FS }) {
  cell(doc, x, y, w, h, "", { bg });
  const t = san(text);
  if (!t) return;
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(fs).fillColor(PALETTE.text);
  const th = doc.heightOfString(t, { width: w - 3, align });
  const top = Math.max(1, (h - th) / 2);
  doc.text(t, x + 1.5, y + top, { width: w - 3, height: h - 2, align, ellipsis: true });
}

function colGeometry() {
  const widths = [W_DIR, W_COURSE, ...NUM_FIELDS.map(() => W_NUM)];
  let x = M;
  return widths.map((w) => {
    const c = { x, w };
    x += w;
    return c;
  });
}

function drawTableHeader(doc, y, cols) {
  for (const [text, c0, span, r0, rows] of HEADER_CELLS) {
    const x = cols[c0].x;
    const w = cols[c0 + span - 1].x + cols[c0 + span - 1].w - x;
    box(doc, {
      x,
      y: y + r0 * HEADER_UNIT_H,
      w,
      h: rows * HEADER_UNIT_H,
      text,
      bold: true,
      bg: PALETTE.headerBg,
    });
  }
  return 2 * HEADER_UNIT_H;
}

function makePager(doc, cols) {
  const bottom = PAGE.height - M;
  const pager = {
    y: M,
    fits(h) {
      return pager.y + h <= bottom;
    },
    ensure(h, redrawHeader = true) {
      if (pager.fits(h)) return false;
      doc.addPage();
      pager.y = M;
      if (redrawHeader) pager.y += drawTableHeader(doc, pager.y, cols);
      return true;
    },
  };
  return pager;
}

function drawNumbers(doc, { y, cols, values, bold = false, bg = null }) {
  NUM_FIELDS.forEach((f, i) => {
    const c = cols[i + 2];
    box(doc, { x: c.x, y, w: c.w, h: ROW_H, text: values[f] ?? 0, bold, bg });
  });
}

function drawTotalRow(doc, { y, cols, label, totals, bg }) {
  const w = cols[0].w + cols[1].w;
  box(doc, { x: cols[0].x, y, w, h: ROW_H, text: label, bold: true, bg });
  drawNumbers(doc, { y, cols, values: totals, bold: true, bg });
  return ROW_H;
}

function drawDirectionBlock(doc, pager, cols, block) {
  let segStart = pager.y;
  const closeSegment = (yEnd) => {
    if (yEnd > segStart) {
      box(doc, {
        x: cols[0].x,
        y: segStart,
        w: cols[0].w,
        h: yEnd - segStart,
        text: block.label,
        align: "center",
      });
    }
  };

  for (const r of block.rows) {
    if (!pager.fits(ROW_H)) {
      closeSegment(pager.y);
      pager.ensure(ROW_H);
      segStart = pager.y;
    }
    box(doc, { x: cols[1].x, y: pager.y, w: cols[1].w, h: ROW_H, text: r.course });
    drawNumbers(doc, { y: pager.y, cols, values: r });
    pager.y += ROW_H;
  }
  closeSegment(pager.y);

  pager.ensure(ROW_H);
  pager.y += drawTotalRow(doc, { y: pager.y, cols, label: "JAMI:", totals: block.total, bg: PALETTE.accentBg });
}

function drawTable1(doc, pager, { cols, summary, variant }) {
  pager.y += drawTableHeader(doc, pager.y, cols);
  for (const fb of summary.facultyBlocks) {
    for (const block of fb.directions) drawDirectionBlock(doc, pager, cols, block);
    pager.ensure(ROW_H);
    pager.y += drawTotalRow(doc, {
      y: pager.y,
      cols,
      label: `${fb.facultyTitle} bo'yicha jami`,
      totals: fb.total,
      bg: PALETTE.subHeaderBg,
    });
  }
  if (variant === "institute") {
    pager.ensure(ROW_H);
    pager.y += drawTotalRow(doc, { y: pager.y, cols, label: "JAMI:", totals: summary.grandTotal, bg: PALETTE.accentBg });
  }
}

function drawTable2(doc, pager, cols, byCourse) {
  const needed = 2 * HEADER_UNIT_H + (MAX_COURSE + 1) * ROW_H;
  pager.ensure(needed, false);
  pager.y += drawTableHeader(doc, pager.y, cols);
  for (const r of byCourse.rows) {
    box(doc, { x: cols[0].x, y: pager.y, w: cols[0].w, h: ROW_H, text: `${r.course}-kurs` });
    box(doc, { x: cols[1].x, y: pager.y, w: cols[1].w, h: ROW_H, text: "" });
    drawNumbers(doc, { y: pager.y, cols, values: r });
    pager.y += ROW_H;
  }
  pager.y += drawTotalRow(doc, { y: pager.y, cols, label: "JAMI:", totals: byCourse.total, bg: PALETTE.accentBg });
}

function drawTable3(doc, pager, facultyByCourse) {
  const W_NAME = 300;
  const W_C = 28;
  const needed = ROW_H * (facultyByCourse.rows.length + 2);
  pager.ensure(needed, false);
  const headers = ["Fakultetlar nomi", ...Array.from({ length: MAX_COURSE }, (_, i) => i + 1), "JAMI"];
  let x = M;
  headers.forEach((h, i) => {
    const w = i === 0 ? W_NAME : W_C;
    box(doc, { x, y: pager.y, w, h: ROW_H, text: h, bold: true, bg: PALETTE.headerBg });
    x += w;
  });
  pager.y += ROW_H;
  const line = (label, courses, total, opts = {}) => {
    let cx = M;
    box(doc, { x: cx, y: pager.y, w: W_NAME, h: ROW_H, text: label, align: opts.bold ? "center" : "left", ...opts });
    cx += W_NAME;
    for (const v of courses) {
      box(doc, { x: cx, y: pager.y, w: W_C, h: ROW_H, text: v, ...opts });
      cx += W_C;
    }
    box(doc, { x: cx, y: pager.y, w: W_C, h: ROW_H, text: total, ...opts });
    pager.y += ROW_H;
  };
  for (const r of facultyByCourse.rows) line(r.facultyShort, r.courses, r.total);
  line("JAMI:", facultyByCourse.total.courses, facultyByCourse.total.total, {
    bold: true,
    bg: PALETTE.accentBg,
  });
}

function drawTable4(doc, pager, countries) {
  if (!countries.rows.length) return;
  const W_C = 220;
  const W_N = 77;
  const total = W_C + W_N * 3;
  const blank = (v) => (v ? v : "");
  pager.ensure(ROW_H * 3, false);
  box(doc, { x: M, y: pager.y, w: total, h: ROW_H, text: "Xorijlik talabalar kontingenti", bold: true, bg: PALETTE.headerBg });
  pager.y += ROW_H;
  const heads = ["Davlatlar", "Jami talaba", "O'g'il", "Qiz"];
  heads.forEach((h, i) => {
    const x = M + (i === 0 ? 0 : W_C + (i - 1) * W_N);
    box(doc, { x, y: pager.y, w: i === 0 ? W_C : W_N, h: ROW_H, text: h, bold: true, bg: PALETTE.headerBg });
  });
  pager.y += ROW_H;
  const line = (label, r, opts = {}) => {
    pager.ensure(ROW_H, false);
    box(doc, { x: M, y: pager.y, w: W_C, h: ROW_H, text: label, ...opts });
    [r.total, r.boys, r.girls].forEach((v, i) => {
      box(doc, { x: M + W_C + i * W_N, y: pager.y, w: W_N, h: ROW_H, text: opts.bold ? v : blank(v), ...opts });
    });
    pager.y += ROW_H;
  };
  for (const r of countries.rows) line(r.country, r);
  line("JAMI:", countries.total, { bold: true, bg: PALETTE.accentBg });
}

function drawTitle(doc, y, { variant, facultyTitle, asOfDate }) {
  const who = variant === "faculty" && facultyTitle ? ` ${facultyTitle}` : "";
  const title = `${INSTITUTE}${who} kunduzgi bakalavr ta'lim shaklida o'qiyotgan talabalar kontingenti`;
  doc.font("Helvetica-Bold").fontSize(TITLE_FS).fillColor(PALETTE.text);
  doc.text(title, M, y, { width: CW, align: "center" });
  y += doc.heightOfString(title, { width: CW }) + 2;
  doc.font("Helvetica-Oblique").fontSize(FS + 1).fillColor(PALETTE.muted);
  doc.text(fmtDate(asOfDate), M, y, { width: CW, align: "right" });
  return y + (FS + 1) * 1.3 + 3;
}

function signatureRow({ variant, doc: docLike, qr }) {
  const sig =
    variant === "faculty"
      ? resolveSignatory(docLike, { step: "dean", snapshot: docLike?.verify?.snapshot })
      : { name: "", dateText: "", source: "none" };
  const position =
    variant === "faculty"
      ? `${docLike?.facultyTitle || "Fakultet"} dekani:`
      : "O'quv-uslubiy boshqarma boshlig'i:";
  return {
    x: M + 20,
    w: CW - 40,
    layout: "row",
    position,
    sig,
    qr: qr ? { image: qr.image, size: QR_SIZE_ROW } : undefined,
  };
}

function drawSignature(doc, pager, opts) {
  const row = signatureRow(opts);
  const h = Math.max(LINE_H, measureSignatureBlock(doc, row));
  pager.ensure(h + 16, false);
  pager.y += 16;
  drawSignatureBlock(doc, { ...row, y: pager.y });
  pager.y += h;
}

function drawFooters(doc, label) {
  const range = doc.bufferedPageRange();
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

async function buildContingentReportPdf({ variant, doc: docLike, academicYearTitle, asOfDate, summary }) {
  const pdf = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: M, bottom: M, left: M, right: M },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
  });
  registerCyrillicFonts(pdf);

  const qr =
    variant === "faculty" ? await prepareVerifyQr(docLike, { docType: "contingentReport" }) : null;
  const cols = colGeometry();
  const pager = makePager(pdf, cols);
  const dateObj = new Date(asOfDate || Date.now());

  pager.y = drawTitle(pdf, M + 2, { variant, facultyTitle: docLike?.facultyTitle, asOfDate: dateObj });
  drawTable1(pdf, pager, { cols, summary, variant });
  pager.y += TABLE_GAP;
  drawTable2(pdf, pager, cols, summary.byCourse);
  pager.y += TABLE_GAP;
  drawTable3(pdf, pager, summary.facultyByCourse);
  pager.y += TABLE_GAP;
  drawTable4(pdf, pager, summary.countries);
  drawSignature(pdf, pager, { variant, doc: docLike, qr });
  drawFooters(pdf, `Talabalar kontingenti · ${san(academicYearTitle)}`);
  return pdf;
}

module.exports = { buildContingentReportPdf, INSTITUTE, fmtDate };
module.exports._geometry = { colGeometry, HEADER_CELLS, W_NUM, ROW_H, HEADER_UNIT_H };
