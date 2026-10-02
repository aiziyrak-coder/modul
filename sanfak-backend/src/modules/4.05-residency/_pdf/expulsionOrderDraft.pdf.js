"use strict";

const { createDoc, INSTITUTE_NAME, PAGE } = require("#shared/pdfGenerators/pdfHelpers");
const { PALETTE } = require("#shared/pdfGenerators/pdfStyle");
const { EXPULSION_HOURS } = require("#modules/4.05-residency/_services/attendanceWarning");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { uzDate, PROGRAM_LABEL, LESSON_TYPE_LABEL, MISSED_LESSON_COLUMNS } = require("./absenceNotice.pdf");

const TEMPLATE_VERSION = 1;
const DOC_TITLE = "Chetlatish buyrug'i loyihasi";
const FONT = "Helvetica";
const BOLD = "Helvetica-Bold";
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - PAGE.margin - 30;
const FOOTER_Y = PAGE.height - PAGE.margin - 14;
const LABEL_WIDTH = 190;

const COLUMNS = [{ header: "№", key: "no", width: 0.4, align: "right" }, ...MISSED_LESSON_COLUMNS];
const COLUMN_UNITS = COLUMNS.reduce((sum, c) => sum + c.width, 0);
const WIDTHS = COLUMNS.map((c) => (c.width / COLUMN_UNITS) * CONTENT_WIDTH);
const CELL = { fontSize: 8, padX: 3, padY: 4, minHeight: 16 };
const MAX_ROW_HEIGHT = BOTTOM - PAGE.margin - 40;
const HEADER_STYLE = { bold: true, bg: PALETTE.headerBg };
const BODY_STYLE = { bold: false, bg: null };
const TOTAL_STYLE = { bold: true, bg: PALETTE.accentBg };

const dash = (value) => (value === null || value === undefined || value === "" ? "—" : String(value));
const fmtHours = (hours) => String(Number(Number(hours).toFixed(2)));
const dayOf = (date) => uzDate(uzDayKey(date));

const draftFileName = (orderId, now) =>
  `chetlatish-buyrugi-loyihasi-${String(orderId).slice(-6)}-${dayOf(now)}.pdf`;

const operativeSentence = (input) =>
  `${dash(input.resident.fullName)} ${input.countingYear} o'quv yilida jami ${fmtHours(input.total)} soat ` +
  "mashg'ulotni sababsiz qoldirgani uchun rezidenturadan chetlatilsin.";

const courseLabel = (course) => (course === null || course === undefined ? null : `${course}-kurs`);

function residentLines({ resident }) {
  return [
    ["F.I.Sh.", resident.fullName],
    ["Ta'lim dasturi", PROGRAM_LABEL[resident.program] || resident.program],
    ["Mutaxassislik", resident.specialty],
    ["Kafedra", resident.department],
    ["Kurs", courseLabel(resident.course)],
    ["Guruh", resident.group],
  ].map(([label, value]) => [label, dash(value)]);
}

function basisLines(input) {
  const opened = input.hoursAtDraft === null ? "" : ` · ${fmtHours(input.hoursAtDraft)} soat`;
  return [
    ["O'quv yili", dash(input.countingYear)],
    ["Sababsiz qoldirilgan soat (ma'lumot holatiga)", `${fmtHours(input.total)} soat`],
    ["Loyiha shakllantirilgan", `${dayOf(input.draftedAt)}${opened}`],
    ["Chegara (TZ 4.5.4)", `${EXPULSION_HOURS} soat`],
  ];
}

function tableRows({ rows, total }) {
  const body = rows.map((r, i) => ({
    no: String(i + 1),
    day: uzDate(r.day),
    science: dash(r.science),
    lessonType: LESSON_TYPE_LABEL[r.lessonType] || dash(r.lessonType),
    hours: fmtHours(r.hours),
  }));
  return [...body, { no: "", day: "", science: "Jami", lessonType: "", hours: fmtHours(total), isTotal: true }];
}

function drawField(doc, [label, value]) {
  const labelHeight = doc.font(BOLD).fontSize(9).heightOfString(`${label}:`, { width: LABEL_WIDTH });
  const valueHeight = doc.font(FONT).fontSize(9).heightOfString(value, { width: CONTENT_WIDTH - LABEL_WIDTH });
  const needed = Math.min(BOTTOM - PAGE.margin, Math.max(labelHeight, valueHeight));
  if (doc.y + needed > BOTTOM) doc.addPage();
  const y = doc.y;
  doc.font(BOLD).fontSize(9).fillColor(PALETTE.muted).text(`${label}:`, PAGE.margin, y, { width: LABEL_WIDTH });
  const labelEnd = doc.y;
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(PALETTE.text)
    .text(value, PAGE.margin + LABEL_WIDTH, y, { width: CONTENT_WIDTH - LABEL_WIDTH, height: BOTTOM - y, ellipsis: true });
  doc.y = Math.max(labelEnd, doc.y) + 2;
}

function drawBlock(doc, heading, lines) {
  doc.moveDown(0.8);
  doc.font(BOLD).fontSize(10).fillColor(PALETTE.text).text(heading, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(0.3);
  lines.forEach((line) => drawField(doc, line));
}

function drawRule(doc) {
  const y = doc.y;
  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .lineWidth(PALETTE.lineWidth)
    .strokeColor(PALETTE.border)
    .stroke();
}

function drawLetterhead(doc, input) {
  const center = { width: CONTENT_WIDTH, align: "center" };
  doc.font(BOLD).fontSize(11).fillColor(PALETTE.text).text(INSTITUTE_NAME, PAGE.margin, PAGE.margin, center);
  doc.moveDown(0.4);
  drawRule(doc);
  doc.moveDown(1.2);
  doc.font(BOLD).fontSize(14).fillColor(PALETTE.text).text("CHETLATISH BUYRUG'I LOYIHASI", PAGE.margin, doc.y, center);
  doc.font(FONT).fontSize(9).fillColor(PALETTE.muted).text(`Ma'lumot holati: ${dayOf(input.generatedAt)}`, center);
  doc.moveDown(1.2);
  const y = doc.y;
  const half = { width: CONTENT_WIDTH / 2 };
  doc.font(FONT).fontSize(10).fillColor(PALETTE.text).text("№ ______________", PAGE.margin, y, half);
  doc
    .font(FONT)
    .fontSize(10)
    .text("«____» ________________ 20____ y.", PAGE.margin + CONTENT_WIDTH / 2, y, { ...half, align: "right" });
}

function drawOperative(doc, input) {
  doc.moveDown(1.2);
  doc
    .font(FONT)
    .fontSize(11)
    .fillColor(PALETTE.text)
    .text(operativeSentence(input), PAGE.margin, doc.y, { width: CONTENT_WIDTH, align: "justify", indent: 28 });
  doc.moveDown(0.8);
  doc.font(FONT).fontSize(10).text(`Asos: ${"_".repeat(60)}`, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
}

function drawSignatures(doc) {
  if (doc.y + 90 > BOTTOM) doc.addPage();
  doc.moveDown(3);
  const y = doc.y;
  const width = CONTENT_WIDTH / 3;
  ["(lavozim)", "(imzo)", "(F.I.Sh.)"].forEach((caption, i) => {
    const x = PAGE.margin + i * width;
    doc.font(FONT).fontSize(10).fillColor(PALETTE.text).text("____________________", x, y, { width, align: "center" });
    doc.font(FONT).fontSize(8).fillColor(PALETTE.muted).text(caption, x, y + 14, { width, align: "center" });
  });
  doc.y = y + 30;
}

function rowHeight(doc, row, style) {
  return COLUMNS.reduce((h, col, i) => {
    const text = String(row[col.key] ?? "");
    const measured = doc
      .font(style.bold ? BOLD : FONT)
      .fontSize(CELL.fontSize)
      .heightOfString(text, { width: WIDTHS[i] - CELL.padX * 2 });
    return Math.min(MAX_ROW_HEIGHT, Math.max(h, Math.ceil(measured) + CELL.padY * 2));
  }, CELL.minHeight);
}

function drawRow(doc, row, style) {
  const height = rowHeight(doc, row, style);
  const y = doc.y;
  let x = PAGE.margin;
  COLUMNS.forEach((col, i) => {
    if (style.bg) doc.rect(x, y, WIDTHS[i], height).fill(style.bg);
    doc.rect(x, y, WIDTHS[i], height).lineWidth(PALETTE.lineWidth).strokeColor(PALETTE.border).stroke();
    doc
      .font(style.bold ? BOLD : FONT)
      .fontSize(CELL.fontSize)
      .fillColor(PALETTE.text)
      .text(String(row[col.key] ?? ""), x + CELL.padX, y + CELL.padY, {
        width: WIDTHS[i] - CELL.padX * 2,
        height: height - CELL.padY * 2,
        ellipsis: true,
        align: col.align || "left",
      });
    x += WIDTHS[i];
  });
  doc.y = y + height;
}

const HEADER_ROW = Object.fromEntries(COLUMNS.map((c) => [c.key, c.header]));

function drawTable(doc, rows) {
  drawRow(doc, HEADER_ROW, HEADER_STYLE);
  rows.forEach((row) => {
    const style = row.isTotal ? TOTAL_STYLE : BODY_STYLE;
    if (doc.y + rowHeight(doc, row, style) > BOTTOM) {
      doc.addPage();
      doc.y = PAGE.margin;
      drawRow(doc, HEADER_ROW, HEADER_STYLE);
    }
    drawRow(doc, row, style);
  });
}

function drawAnnex(doc, input) {
  doc.addPage();
  const full = { width: CONTENT_WIDTH };
  doc.font(FONT).fontSize(9).fillColor(PALETTE.muted).text(`${DOC_TITLE}ga ilova`, PAGE.margin, PAGE.margin, { ...full, align: "right" });
  doc.moveDown(0.8);
  doc.font(BOLD).fontSize(12).fillColor(PALETTE.text).text("Sababsiz qoldirilgan mashg'ulotlar", { ...full, align: "center" });
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(PALETTE.text)
    .text(`${dash(input.resident.fullName)} · ${input.countingYear} o'quv yili`, { ...full, align: "center" });
  doc.moveDown(0.8);
  drawTable(doc, tableRows(input));
}

function drawFooters(doc, orderId) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.y = FOOTER_Y - 6;
    drawRule(doc);
    const pageLabel = `${i + 1} / ${range.count}`;
    doc.font(FONT).fontSize(7).fillColor(PALETTE.muted);
    doc.text(`${DOC_TITLE} | Holat: Loyiha | Kod: ${orderId}`, PAGE.margin, FOOTER_Y, { lineBreak: false });
    doc.text(pageLabel, PAGE.width - PAGE.margin - doc.widthOfString(pageLabel), FOOTER_Y, { lineBreak: false });
  }
}

function buildExpulsionDraftPdf(input) {
  return new Promise((resolve, reject) => {
    const doc = createDoc({
      info: { Creator: "Institut AIS", Producer: "PDFKit", Title: DOC_TITLE, CreationDate: input.generatedAt },
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      drawLetterhead(doc, input);
      drawBlock(doc, "Rezident", residentLines(input));
      drawBlock(doc, "Asos", basisLines(input));
      drawOperative(doc, input);
      drawSignatures(doc);
      drawAnnex(doc, input);
      drawFooters(doc, input.orderId);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  buildExpulsionDraftPdf,
  draftFileName,
  TEMPLATE_VERSION,
  LAYOUT: { BOTTOM, FOOTER_Y },
  operativeSentence,
  residentLines,
  basisLines,
  tableRows,
};
