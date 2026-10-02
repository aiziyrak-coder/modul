"use strict";

const {
  createDoc,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawInfoCard,
  drawParagraph,
  drawTable,
  INSTITUTE_NAME,
  COLORS,
  PAGE,
} = require("#shared/pdfGenerators/pdfHelpers");
const { WARNING_HOURS, EXPULSION_HOURS } = require("#modules/4.05-residency/_services/attendanceWarning");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const {
  uzDate,
  PROGRAM_LABEL,
  MISSED_LESSON_COLUMNS,
  missedLessonCells,
  drawFooterLocal,
} = require("./absenceNotice.pdf");

const TEMPLATE_VERSION = 1;
const FOOTER_TEXT =
  "Bildirgi Institut Avtomatlashtirilgan Axborot Tizimi tomonidan avtomatik shakllantirildi (TZ 4.5.4)";
const ADDRESSEE = "Magistratura va klinik ordinatura bo'limi boshlig'iga";
const TABLE_TITLE = "Sababsiz qoldirilgan mashg'ulotlar (joriy o'quv yili)";
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const BOTTOM = PAGE.height - PAGE.margin - 30;

const fmtHours = (hours) => String(Number(Number(hours).toFixed(2)));
const dayOf = (date) => uzDate(uzDayKey(date));
const courseLabel = (course) => (course === null || course === undefined ? null : `${course}-kurs`);

const residentFields = (r = {}) => [
  ["F.I.Sh", r.fullName],
  ["Ta'lim yo'nalishi", PROGRAM_LABEL[r.program] || r.program],
  ["Mutaxassislik", r.specialty],
  ["Kafedra", r.department],
  ["Kurs", courseLabel(r.course)],
  ["Guruh", r.group],
];

const basisFields = ({ countingYear, hours, generatedAt }) => [
  ["O'quv yili", countingYear],
  ["Jami sababsiz soat (joriy o'quv yili)", `${fmtHours(hours)} soat`],
  [
    "Ostona (TZ 4.5.4)",
    `Sababsiz ${WARNING_HOURS} soat — ogohlantirish va bildirgi · ${EXPULSION_HOURS} soat — chetlatish buyrug'i loyihasi`,
  ],
  ["Ma'lumot holati", dayOf(generatedAt)],
];

const tableRows = (rows, hours) => [
  ...rows.map(missedLessonCells),
  { day: "Jami", science: "", lessonType: "", hours: fmtHours(hours) },
];

function ensureRoom(doc, needed) {
  if (doc.y + needed <= BOTTOM) return;
  doc.addPage();
  doc.y = PAGE.margin;
}

function drawAddressee(doc) {
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(ADDRESSEE, PAGE.margin, doc.y, { width: CONTENT_WIDTH, align: "right" });
  doc.moveDown(1);
}

function drawRows(doc, { rows, hours }) {
  if (!rows.length) return;
  drawSectionTitle(doc, TABLE_TITLE);
  drawTable(doc, MISSED_LESSON_COLUMNS, tableRows(rows, hours));
}

function drawSentence(doc, sentence) {
  const text = String(sentence || "");
  if (!text.trim()) return;
  doc.moveDown(0.5);
  const height = doc.font("Helvetica").fontSize(9).heightOfString(text, { width: CONTENT_WIDTH, align: "justify" });
  ensureRoom(doc, height + 4);
  drawParagraph(doc, text);
}

function drawFooters(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    drawFooterLocal(doc, FOOTER_TEXT);
  }
}

function render(doc, input) {
  drawHeader(doc, INSTITUTE_NAME);
  doc.moveDown(1.2);
  drawAddressee(doc);
  drawTitle(doc, "BILDIRGI", `Sana: ${dayOf(input.generatedAt)}`);
  drawSectionTitle(doc, "Talaba ma'lumotlari");
  drawInfoCard(doc, residentFields(input.resident));
  drawSectionTitle(doc, "Asos");
  drawInfoCard(doc, basisFields(input));
  drawRows(doc, input);
  drawSentence(doc, input.sentence);
  drawFooters(doc);
}

function buildAutoAbsenceNoticePdf(input = {}) {
  const data = { resident: {}, rows: [], hours: 0, countingYear: null, sentence: "", ...input };
  return new Promise((resolve, reject) => {
    const doc = createDoc();
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      render(doc, data);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  buildAutoAbsenceNoticePdf,
  TEMPLATE_VERSION,
  FOOTER_TEXT,
  ADDRESSEE,
  fmtHours,
  residentFields,
  basisFields,
  tableRows,
  render,
  LAYOUT: { BOTTOM },
};
