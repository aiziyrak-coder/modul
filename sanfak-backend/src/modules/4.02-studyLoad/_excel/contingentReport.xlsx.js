"use strict";

const ExcelJS = require("exceljs");
const {
  NUM_FIELDS,
  MAX_COURSE,
} = require("#modules/4.02-studyLoad/_services/contingentSummary");

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";
const BLANK_NAME = "____________";

const THIN = { style: "thin", color: { argb: "FF000000" } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER_WRAP = { horizontal: "center", vertical: "middle", wrapText: true };
const LEFT_WRAP = { horizontal: "left", vertical: "middle", wrapText: true };
const FONT = { name: "Times New Roman", size: 10 };
const FONT_B = { ...FONT, bold: true };
const FILL_HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDDDDD" } };
const FILL_TOTAL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2F7" } };

const HEADER_TOP = [
  "Ta'lim yunalishi", "Kursi", "Jami talaba", "O'g'il", "Qiz", "Grant", "Shartnoma",
  "Grant", null, "Shartnoma", null, "Guruh soni", "Oqimlar soni",
  "Akademik mobillik yuborilgan", "Akademik mobillik kelgan",
];
const HEADER_SUB = { 8: "O'g'il", 9: "Qiz", 10: "O'g'il", 11: "Qiz" };
const LAST_COL = 15;

const pad2 = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;

function styleRow(ws, r, { font = FONT, fill = null, cols = LAST_COL } = {}) {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(r, c);
    cell.border = BORDER;
    cell.font = font;
    cell.alignment = c === 1 ? LEFT_WRAP : CENTER_WRAP;
    if (fill) cell.fill = fill;
  }
}

function writeTableHeader(ws, r) {
  HEADER_TOP.forEach((text, i) => {
    const c = i + 1;
    if (text === null) return;
    const isGroup = c === 8 || c === 10;
    if (isGroup) {
      ws.mergeCells(r, c, r, c + 1);
    } else {
      ws.mergeCells(r, c, r + 1, c);
    }
    ws.getCell(r, c).value = text;
  });
  for (const [c, text] of Object.entries(HEADER_SUB)) ws.getCell(r + 1, Number(c)).value = text;
  styleRow(ws, r, { font: FONT_B, fill: FILL_HEADER });
  styleRow(ws, r + 1, { font: FONT_B, fill: FILL_HEADER });
  for (let c = 1; c <= LAST_COL; c++) ws.getCell(r, c).alignment = CENTER_WRAP;
  return r + 2;
}

const numbers = (row) => NUM_FIELDS.map((f) => row[f] ?? 0);

function writeTotalRow(ws, r, label, totals) {
  ws.getRow(r).values = [label, null, ...numbers(totals)];
  ws.mergeCells(r, 1, r, 2);
  styleRow(ws, r, { font: FONT_B, fill: FILL_TOTAL });
  ws.getCell(r, 1).alignment = CENTER_WRAP;
  return r + 1;
}

function writeTable1(ws, r, summary, variant) {
  r = writeTableHeader(ws, r);
  for (const fb of summary.facultyBlocks) {
    for (const block of fb.directions) {
      const start = r;
      for (const row of block.rows) {
        ws.getRow(r).values = [block.label, row.course, ...numbers(row)];
        styleRow(ws, r);
        r++;
      }
      if (r > start) {
        if (r - start > 1) ws.mergeCells(start, 1, r - 1, 1);
        ws.getCell(start, 1).alignment = LEFT_WRAP;
      }
      r = writeTotalRow(ws, r, "JAMI:", block.total);
    }
    r = writeTotalRow(ws, r, `${fb.facultyTitle} bo'yicha jami`, fb.total);
  }
  if (variant === "institute") r = writeTotalRow(ws, r, "JAMI:", summary.grandTotal);
  return r;
}

function writeTable2(ws, r, byCourse) {
  r = writeTableHeader(ws, r);
  for (const row of byCourse.rows) {
    ws.getRow(r).values = [`${row.course}-kurs`, null, ...numbers(row)];
    styleRow(ws, r);
    r++;
  }
  return writeTotalRow(ws, r, "JAMI:", byCourse.total);
}

function writeTable3(ws, r, facultyByCourse) {
  const cols = MAX_COURSE + 2;
  ws.getRow(r).values = [
    "Fakultetlar nomi",
    ...Array.from({ length: MAX_COURSE }, (_, i) => i + 1),
    "JAMI",
  ];
  styleRow(ws, r, { font: FONT_B, fill: FILL_HEADER, cols });
  r++;
  for (const row of facultyByCourse.rows) {
    ws.getRow(r).values = [row.facultyShort, ...row.courses, row.total];
    styleRow(ws, r, { cols });
    r++;
  }
  ws.getRow(r).values = ["JAMI:", ...facultyByCourse.total.courses, facultyByCourse.total.total];
  styleRow(ws, r, { font: FONT_B, fill: FILL_TOTAL, cols });
  return r + 1;
}

function writeTable4(ws, r, countries) {
  ws.mergeCells(r, 1, r, 4);
  ws.getCell(r, 1).value = "Xorijlik talabalar kontingenti";
  styleRow(ws, r, { font: FONT_B, fill: FILL_HEADER, cols: 4 });
  ws.getCell(r, 1).alignment = CENTER_WRAP;
  r++;
  ws.getRow(r).values = ["Davlatlar", "Jami talaba", "O'g'il", "Qiz"];
  styleRow(ws, r, { font: FONT_B, fill: FILL_HEADER, cols: 4 });
  r++;
  const blank = (v) => (v ? v : null);
  for (const row of countries.rows) {
    ws.getRow(r).values = [row.country, blank(row.total), blank(row.boys), blank(row.girls)];
    styleRow(ws, r, { cols: 4 });
    r++;
  }
  ws.getRow(r).values = ["JAMI:", countries.total.total, countries.total.boys, countries.total.girls];
  styleRow(ws, r, { font: FONT_B, fill: FILL_TOTAL, cols: 4 });
  return r + 1;
}

function writeTitle(ws, { variant, facultyTitle, asOfDate }) {
  const who = variant === "faculty" && facultyTitle ? ` ${facultyTitle}` : "";
  ws.mergeCells(1, 1, 1, LAST_COL);
  ws.getCell(1, 1).value = `${INSTITUTE}${who} kunduzgi bakalavr ta'lim shaklida o'qiyotgan talabalar kontingenti`;
  ws.getCell(1, 1).font = { ...FONT_B, size: 12 };
  ws.getCell(1, 1).alignment = CENTER_WRAP;
  ws.getRow(1).height = 30;
  ws.mergeCells(2, LAST_COL - 1, 2, LAST_COL);
  ws.getCell(2, LAST_COL - 1).value = fmtDate(asOfDate);
  ws.getCell(2, LAST_COL - 1).font = { ...FONT, italic: true };
  ws.getCell(2, LAST_COL - 1).alignment = { horizontal: "right", vertical: "middle" };
  return 3;
}

function writeSignature(ws, r, { variant, facultyTitle, signatories }) {
  const isFaculty = variant === "faculty";
  const label = isFaculty ? `${facultyTitle || "Fakultet"} dekani:` : "O'quv-uslubiy boshqarma boshlig'i:";
  const person = isFaculty && signatories ? signatories.dean : null;
  ws.getCell(r, 1).value = label;
  ws.getCell(r, 1).font = FONT_B;
  ws.getCell(r, 3).value = (person && person.name) || BLANK_NAME;
  if (person && person.date) ws.getCell(r + 1, 3).value = person.date;
}

function setWidths(ws, first, rest, count) {
  ws.getColumn(1).width = first;
  for (let c = 2; c <= count; c++) ws.getColumn(c).width = rest;
}

function buildContingentWorkbook({ variant, doc, asOfDate, summary, signatories }) {
  const dateObj = new Date(asOfDate || Date.now());
  const wb = new ExcelJS.Workbook();
  wb.creator = "SANFAK AIS";
  const landscape = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const ws1 = wb.addWorksheet("Kontingent", { pageSetup: landscape });
  setWidths(ws1, 42, 11, LAST_COL);
  let r = writeTitle(ws1, { variant, facultyTitle: doc?.facultyTitle, asOfDate: dateObj });
  writeTable1(ws1, r, summary, variant);

  const ws2 = wb.addWorksheet("Kurs jami", { pageSetup: landscape });
  setWidths(ws2, 42, 11, LAST_COL);
  r = writeTable2(ws2, 1, summary.byCourse);
  writeTable3(ws2, r + 1, summary.facultyByCourse);

  const ws3 = wb.addWorksheet("Xorijlik talabalar");
  setWidths(ws3, 36, 14, 4);
  r = writeTable4(ws3, 1, summary.countries);
  writeSignature(ws3, r + 2, { variant, facultyTitle: doc?.facultyTitle, signatories });
  return wb;
}

function contingentFileName({ academicYearTitle, facultyTitle, ext = "xlsx" }) {
  const year = String(academicYearTitle || "")
    .replace(/[^0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fac = String(facultyTitle || "")
    .toLowerCase()
    .replace(/['’ʻ`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `kontingent-hisoboti${year ? `-${year}` : ""}${fac ? `-${fac}` : ""}.${ext}`;
}

module.exports = {
  buildContingentWorkbook,
  contingentFileName,
  INSTITUTE,
  fmtDate,
  HEADER_TOP,
  LAST_COL,
};
