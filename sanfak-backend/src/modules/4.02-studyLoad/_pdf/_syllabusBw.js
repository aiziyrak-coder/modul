"use strict";

const {
  PAGE,
  CONTENT_WIDTH,
  ensureSpace,
} = require("#shared/pdfGenerators/pdfHelpers");

const BW = Object.freeze({
  border: "#444",
  borderWidth: 0.4,
  text: "#000",
});

const SECTION_FS = 9.5;
const SECTION_MIN_H = 16;
const SECTION_PAD_Y = 3;

function bwSectionTitle(doc, text) {
  const label = String(text ?? "");
  doc.font("Helvetica-Bold").fontSize(SECTION_FS);
  const textH = doc.heightOfString(label, {
    width: CONTENT_WIDTH - 12,
    align: "center",
  });
  const boxH = Math.max(SECTION_MIN_H, Math.ceil(textH) + SECTION_PAD_Y * 2);

  ensureSpace(doc, boxH + 8);
  const startY = doc.y;

  doc
    .rect(PAGE.margin, startY, CONTENT_WIDTH, boxH)
    .lineWidth(BW.borderWidth)
    .strokeColor(BW.border)
    .stroke();

  doc
    .fillColor(BW.text)
    .font("Helvetica-Bold")
    .fontSize(SECTION_FS)
    .text(label, PAGE.margin + 6, startY + SECTION_PAD_Y, {
      width: CONTENT_WIDTH - 12,
      align: "center",
    });

  doc.y = startY + boxH;
  doc.moveDown(0.4);
}

const TABLE_HEADER_FS = 7.5;
const TABLE_ROW_FS_DEFAULT = 8;
const CELL_PAD_X = 3;
const CELL_PAD_Y = 4;
const HEADER_PAD_Y = 5;
const ROW_MIN_H = 18;
const HEADER_MIN_H = 20;

function bwTable(doc, columns, rows, opts = {}) {
  if (!columns.length) return;
  const { rowFontSize = TABLE_ROW_FS_DEFAULT } = opts;

  const totalDef = columns.reduce((s, c) => s + (c.width || 1), 0);
  const colWidths = columns.map(
    (c) => ((c.width || 1) / totalDef) * CONTENT_WIDTH,
  );

  const measure = (text, width, font, fontSize) =>
    doc.font(font).fontSize(fontSize).heightOfString(text, { width });

  const headerH = columns.reduce((h, col, i) => {
    const textH = measure(
      String(col.header ?? ""),
      colWidths[i] - CELL_PAD_X * 2,
      "Helvetica-Bold",
      TABLE_HEADER_FS,
    );
    return Math.max(h, Math.ceil(textH) + HEADER_PAD_Y * 2);
  }, HEADER_MIN_H);

  const rowHeightOf = (row) =>
    columns.reduce((h, col, i) => {
      const cellVal = String(row[col.key] ?? "—");
      const textH = measure(
        cellVal,
        colWidths[i] - CELL_PAD_X * 2,
        "Helvetica",
        rowFontSize,
      );
      return Math.max(h, Math.ceil(textH) + CELL_PAD_Y * 2);
    }, ROW_MIN_H);

  const strokeGrid = (y, h) => {
    doc
      .rect(PAGE.margin, y, CONTENT_WIDTH, h)
      .lineWidth(BW.borderWidth)
      .strokeColor(BW.border)
      .stroke();
    let x = PAGE.margin;
    for (let i = 0; i < columns.length - 1; i++) {
      x += colWidths[i];
      doc
        .moveTo(x, y)
        .lineTo(x, y + h)
        .lineWidth(BW.borderWidth)
        .strokeColor(BW.border)
        .stroke();
    }
  };

  const drawHeaderRow = () => {
    const headerY = doc.y;
    strokeGrid(headerY, headerH);
    let x = PAGE.margin;
    columns.forEach((col, i) => {
      doc
        .fillColor(BW.text)
        .font("Helvetica-Bold")
        .fontSize(TABLE_HEADER_FS)
        .text(String(col.header ?? ""), x + CELL_PAD_X, headerY + HEADER_PAD_Y, {
          width: colWidths[i] - CELL_PAD_X * 2,
          align: col.align || "center",
          lineBreak: true,
        });
      x += colWidths[i];
    });
    doc.y = headerY + headerH;
  };

  ensureSpace(doc, headerH + ROW_MIN_H);
  drawHeaderRow();

  rows.forEach((row) => {
    const rowH = rowHeightOf(row);

    if (doc.y + rowH > PAGE.height - PAGE.margin - 30) {
      doc.addPage();
      doc.y = PAGE.margin;
      drawHeaderRow();
    }

    const rowY = doc.y;
    strokeGrid(rowY, rowH);

    let x = PAGE.margin;
    columns.forEach((col, i) => {
      const cellVal = String(row[col.key] ?? "—");
      doc
        .fillColor(BW.text)
        .font("Helvetica")
        .fontSize(rowFontSize)
        .text(cellVal, x + CELL_PAD_X, rowY + CELL_PAD_Y, {
          width: colWidths[i] - CELL_PAD_X * 2,
          align: col.align || "left",
          lineBreak: true,
        });
      x += colWidths[i];
    });

    doc.y = rowY + rowH;
  });

  doc.moveDown(0.5);
}

const INFO_LABEL_W = 150;
const INFO_FS = 8.5;
const INFO_PAD_X = 4;
const INFO_PAD_Y = 3;
const INFO_MIN_H = 14;

function bwInfoTable(doc, fields) {
  const valueW = CONTENT_WIDTH - INFO_LABEL_W - INFO_PAD_X * 2;

  for (const [label, value] of fields) {
    const text = String(value ?? "—");
    const textH = doc
      .font("Helvetica")
      .fontSize(INFO_FS)
      .heightOfString(text, { width: valueW });
    const rowH = Math.max(INFO_MIN_H, Math.ceil(textH) + INFO_PAD_Y * 2);

    ensureSpace(doc, rowH);
    const rowY = doc.y;

    doc
      .rect(PAGE.margin, rowY, CONTENT_WIDTH, rowH)
      .lineWidth(BW.borderWidth)
      .strokeColor(BW.border)
      .stroke();
    doc
      .moveTo(PAGE.margin + INFO_LABEL_W, rowY)
      .lineTo(PAGE.margin + INFO_LABEL_W, rowY + rowH)
      .lineWidth(BW.borderWidth)
      .strokeColor(BW.border)
      .stroke();

    doc
      .fillColor(BW.text)
      .font("Helvetica-Bold")
      .fontSize(INFO_FS)
      .text(`${label}:`, PAGE.margin + INFO_PAD_X, rowY + INFO_PAD_Y, {
        width: INFO_LABEL_W - INFO_PAD_X * 2,
      });
    doc
      .fillColor(BW.text)
      .font("Helvetica")
      .fontSize(INFO_FS)
      .text(text, PAGE.margin + INFO_LABEL_W + INFO_PAD_X, rowY + INFO_PAD_Y, {
        width: valueW,
      });

    doc.y = rowY + rowH;
  }

  doc.moveDown(0.5);
}

const LIST_FS = 8.5;
const LIST_NUM_W = 16;

function bwList(doc, items = []) {
  if (!items || !items.length) {
    doc
      .fillColor(BW.text)
      .font("Helvetica")
      .fontSize(LIST_FS)
      .text("—", PAGE.margin + 10);
    doc.moveDown(0.2);
    return;
  }

  items.forEach((item, i) => {
    const y = doc.y;
    doc
      .fillColor(BW.text)
      .font("Helvetica")
      .fontSize(LIST_FS)
      .text(`${i + 1}.`, PAGE.margin, y, { width: LIST_NUM_W });
    doc
      .fillColor(BW.text)
      .font("Helvetica")
      .fontSize(LIST_FS)
      .text(String(item), PAGE.margin + LIST_NUM_W, y, {
        width: CONTENT_WIDTH - LIST_NUM_W,
      });
    doc.moveDown(0.15);
  });
  doc.moveDown(0.2);
}

module.exports = { bwSectionTitle, bwTable, bwInfoTable, bwList };
