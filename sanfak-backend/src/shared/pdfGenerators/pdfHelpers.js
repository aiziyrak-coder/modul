"use strict";

const PDFDocument = require("pdfkit");
const { appendSignature } = require("../fileAccess");

const COLORS = {
  primary:    "#1a3c5e",
  secondary:  "#2e6da4",
  accent:     "#e8f0fa",
  border:     "#b0c4de",
  text:       "#1a1a1a",
  muted:      "#555555",
  light:      "#f5f8fc",
  white:      "#ffffff",
  approved:   "#1a7a4a",
  pending:    "#b8860b",
  rejected:   "#c0392b",
};

const PAGE = { width: 595, height: 842, margin: 40 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

const INSTITUTE_NAME = "FARG'ONA JAMOAT SALOMATLIGI TIBBIYOT INSTITUTI";

const STATUS_LABEL = {
  draft:     "Qoralama",
  in_review: "Ko'rib chiqilmoqda",
  approved:  "Tasdiqlangan",
  rejected:  "Rad etildi",
};

const STEP_LABEL = {
  teacher:    "O'qituvchi (ERI)",
  kafedra:    "Kafedra mudiri",
  arm:        "Axborot-resurs markazi",
  methodical: "O'quv-metodik ta'minot bo'limi",
  dean:       "Fakultet dekani",
  prorektor:  "O'quv ishlari bo'yicha prorektor",
  rektor:     "Rektor",
};

const path = require("path");
const FONT_DIR = path.join(__dirname, "fonts");
const FONTS = {
  regular: path.join(FONT_DIR, "times.ttf"),
  bold: path.join(FONT_DIR, "timesbd.ttf"),
  italic: path.join(FONT_DIR, "timesi.ttf"),
  boldItalic: path.join(FONT_DIR, "timesbi.ttf"),
};

const FONT_ALIASES = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "TNR",
  "TNR-B",
  "TNR-I",
  "TNR-BI",
];

function registerCyrillicFonts(doc) {
  try {
    for (const alias of FONT_ALIASES) {
      delete doc._fontFamilies?.[alias];
    }

    doc.registerFont("Helvetica", FONTS.regular);
    doc.registerFont("Helvetica-Bold", FONTS.bold);
    doc.registerFont("Helvetica-Oblique", FONTS.italic);
    doc.registerFont("Helvetica-BoldOblique", FONTS.boldItalic);
    doc.registerFont("TNR", FONTS.regular);
    doc.registerFont("TNR-B", FONTS.bold);
    doc.registerFont("TNR-I", FONTS.italic);
    doc.registerFont("TNR-BI", FONTS.boldItalic);
    doc.font("Helvetica");
  } catch (err) {
    console.warn("TNR font register xatolik (default fontlar ishlatiladi):", err.message);
  }
}

function createDoc(opts = {}) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
    info: { Creator: "Institut AIS", Producer: "PDFKit" },
    bufferPages: true,
    ...opts,
  });
  registerCyrillicFonts(doc);
  return doc;
}

function pipeToResponse(res, doc, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
}

function drawHeader(doc, instituteName = INSTITUTE_NAME) {
  const top = doc.page.margins.top - 10;
  doc
    .rect(PAGE.margin - 5, top - 8, CONTENT_WIDTH + 10, 36)
    .fill(COLORS.primary);

  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(instituteName, PAGE.margin, top, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  doc
    .fillColor(COLORS.white)
    .font("Helvetica")
    .fontSize(7)
    .text("Institut Avtomatlashtirilgan Axborot Tizimi (AIS)", PAGE.margin, top + 12, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  doc.y = top - 8 + 36 + 8;
}

function drawTitle(doc, title, subtitle = null) {
  doc
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(title, { align: "center" });

  if (subtitle) {
    doc
      .fillColor(COLORS.secondary)
      .font("Helvetica")
      .fontSize(10)
      .text(subtitle, { align: "center" });
  }

  doc.moveDown(0.8);
  const y = doc.y;
  doc
    .moveTo(PAGE.margin, y)
    .lineTo(PAGE.width - PAGE.margin, y)
    .strokeColor(COLORS.secondary)
    .lineWidth(1.5)
    .stroke();
  doc.moveDown(0.6);
}

function drawSectionTitle(doc, text) {
  if (doc.y + 28 > PAGE.height - PAGE.margin - 30) {
    doc.addPage();
    doc.y = PAGE.margin;
  }
  const startY = doc.y;
  doc
    .rect(PAGE.margin, startY, CONTENT_WIDTH, 18)
    .fill(COLORS.primary);
  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(text, PAGE.margin + 6, startY + 4, {
      width: CONTENT_WIDTH - 12,
    });
  doc.y = startY + 18;
  doc.moveDown(0.5);
}

function drawLabelValue(doc, label, value, opts = {}) {
  const { labelWidth = 180, valueColor = COLORS.text } = opts;
  const startY = doc.y;

  doc
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(label + ":", PAGE.margin, startY, { width: labelWidth, continued: false });

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(valueColor)
    .text(value || "—", PAGE.margin + labelWidth, startY, {
      width: CONTENT_WIDTH - labelWidth,
    });

  doc.moveDown(0.15);
}

function drawInfoCard(doc, fields) {
  const cardY = doc.y;
  const lineH = 16;
  const cardH = fields.length * lineH + 12;

  doc
    .rect(PAGE.margin, cardY, CONTENT_WIDTH, cardH)
    .fill(COLORS.light)
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .stroke();

  doc.y = cardY + 6;
  for (const [label, value, opts] of fields) {
    drawLabelValue(doc, label, String(value ?? "—"), opts);
  }
  doc.moveDown(0.5);
}

function drawParagraph(doc, text) {
  if (!text) return;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(String(text), PAGE.margin, doc.y, { width: CONTENT_WIDTH, align: "justify" });
  doc.moveDown(0.4);
}

function drawList(doc, items = []) {
  if (!items.length) {
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.muted).text("—", PAGE.margin + 10);
    doc.moveDown(0.2);
    return;
  }
  for (const item of items) {
    const y = doc.y;
    doc
      .circle(PAGE.margin + 5, y + 4, 2)
      .fill(COLORS.secondary);
    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor(COLORS.text)
      .text(String(item), PAGE.margin + 14, y, { width: CONTENT_WIDTH - 14 });
    doc.moveDown(0.15);
  }
  doc.moveDown(0.2);
}

function drawTable(doc, columns, rows, opts = {}) {
  const { headerBg = COLORS.primary, headerColor = COLORS.white, rowFontSize = 8 } = opts;

  if (!columns.length) return;

  const totalDef = columns.reduce((s, c) => s + (c.width || 1), 0);
  const colWidths = columns.map((c) => ((c.width || 1) / totalDef) * CONTENT_WIDTH);
  const ROW_H = 18;
  const HEADER_H = 20;
  const HEADER_FS = 7.5;
  const CELL_PAD_X = 3;
  const CELL_PAD_Y = 4;
  const HEADER_PAD_Y = 5;

  const measure = (text, width, font, fontSize) =>
    doc.font(font).fontSize(fontSize).heightOfString(text, { width });

  const rowHeightOf = (row) =>
    columns.reduce((h, col, i) => {
      const cellVal = String(row[col.key] ?? "—");
      const textH = measure(cellVal, colWidths[i] - CELL_PAD_X * 2, "Helvetica", rowFontSize);
      return Math.max(h, Math.ceil(textH) + CELL_PAD_Y * 2);
    }, ROW_H);

  let x = PAGE.margin;
  const headerY = doc.y;
  const headerH = columns.reduce((h, col, i) => {
    const textH = measure(
      String(col.header ?? ""),
      colWidths[i] - CELL_PAD_X * 2,
      "Helvetica-Bold",
      HEADER_FS,
    );
    return Math.max(h, Math.ceil(textH) + HEADER_PAD_Y * 2);
  }, HEADER_H);

  doc.rect(PAGE.margin, headerY, CONTENT_WIDTH, headerH).fill(headerBg);

  columns.forEach((col, i) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(HEADER_FS)
      .fillColor(headerColor)
      .text(col.header, x + CELL_PAD_X, headerY + HEADER_PAD_Y, {
        width: colWidths[i] - CELL_PAD_X * 2,
        align: col.align || "center",
        lineBreak: true,
      });
    x += colWidths[i];
  });

  doc.y = headerY + headerH;

  rows.forEach((row, rowIdx) => {
    const rowH = rowHeightOf(row);

    if (doc.y + rowH > PAGE.height - PAGE.margin - 30) {
      doc.addPage();
      doc.y = PAGE.margin;
    }

    const rowY = doc.y;
    const bg = rowIdx % 2 === 0 ? COLORS.white : COLORS.light;

    doc.rect(PAGE.margin, rowY, CONTENT_WIDTH, rowH).fill(bg);

    x = PAGE.margin;
    columns.forEach((col, i) => {
      const cellVal = String(row[col.key] ?? "—");
      doc
        .font("Helvetica")
        .fontSize(rowFontSize)
        .fillColor(COLORS.text)
        .text(cellVal, x + CELL_PAD_X, rowY + CELL_PAD_Y, {
          width: colWidths[i] - CELL_PAD_X * 2,
          align: col.align || "left",
          lineBreak: true,
        });
      x += colWidths[i];
    });

    doc
      .rect(PAGE.margin, rowY, CONTENT_WIDTH, rowH)
      .strokeColor(COLORS.border)
      .lineWidth(0.3)
      .stroke();

    doc.y = rowY + rowH;
  });

  doc.moveDown(0.5);
}

function drawApprovalSteps(doc, steps = []) {
  if (!steps.length) return;

  drawSectionTitle(doc, "Tasdiqlash jarayoni");

  const columns = [
    { header: "№",          key: "no",       width: 0.4 },
    { header: "Bosqich",    key: "label",    width: 3 },
    { header: "Holat",      key: "status",   width: 1.5 },
    { header: "Tasdiqladi", key: "approver", width: 2.5 },
    { header: "Sana",       key: "date",     width: 1.5 },
    { header: "Izoh",       key: "comment",  width: 2 },
  ];

  const rows = steps.map((s, i) => {
    const statusColor = s.status === "approved"
      ? COLORS.approved
      : s.status === "rejected"
        ? COLORS.rejected
        : COLORS.pending;

    return {
      no:       i + 1,
      label:    s.label || STEP_LABEL[s.step] || s.step,
      status:   STATUS_LABEL[s.status] || s.status,
      approver: s.approvedBy
        ? `${s.approvedBy.lastName || ""} ${s.approvedBy.firstName || ""}`.trim()
        : "—",
      date:    s.date ? new Date(s.date).toLocaleDateString("uz-UZ") : "—",
      comment: s.comment || "—",
    };
  });

  drawTable(doc, columns, rows, { rowFontSize: 7.5 });
}

function drawFooter(doc, docTitle, docStatus, barcode = null) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const footerY = PAGE.height - PAGE.margin + 5;

    doc
      .moveTo(PAGE.margin, footerY - 8)
      .lineTo(PAGE.width - PAGE.margin, footerY - 8)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    const pageLabel = `${i - range.start + 1} / ${range.count}`;
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted);
    doc.text(
      `${docTitle} | Holat: ${STATUS_LABEL[docStatus] || docStatus}${barcode ? ` | Kod: ${barcode}` : ""}`,
      PAGE.margin,
      footerY - 2,
      { lineBreak: false },
    );
    doc.text(
      pageLabel,
      PAGE.width - PAGE.margin - doc.widthOfString(pageLabel),
      footerY - 2,
      { lineBreak: false },
    );
  }
}

function ensureSpace(doc, needed = 40) {
  if (doc.y + needed > PAGE.height - PAGE.margin - 30) {
    doc.addPage();
    doc.y = PAGE.margin;
  }
}

function generateBarcodeImage(code) {
  try {
    const JsBarcode = require("jsbarcode");
    const { createCanvas } = require("canvas");
    const canvas = createCanvas(250, 70);
    JsBarcode(canvas, code, {
      format: "CODE128",
      width: 1.5,
      height: 40,
      fontSize: 10,
      margin: 5,
      displayValue: true,
    });
    return canvas.toBuffer("image/png");
  } catch (err) {
    return null;
  }
}

function drawBarcode(doc, code, x, y, opts = {}) {
  const { width = 150, height = 45 } = opts;
  if (!code) return;
  const buf = generateBarcodeImage(code);
  if (buf) {
    doc.image(buf, x, y, { width, height });
  } else {
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.muted)
      .text(`Kod: ${code}`, x, y + 5, { width, align: "center" });
  }
}

async function saveAndUpdatePdf({ buildFn, Model, id, prefix, fileField = "file" }) {
  const fs = require("fs");
  const path = require("path");
  try {
    const dir = path.join(__dirname, "../../../uploads/pdfs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filename = `${prefix}-${id}.pdf`;
    const filepath = path.join(dir, filename);
    const fileUrl = appendSignature(`/files/pdfs/${filename}`);

    const doc = await buildFn(id);
    await new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filepath);
      stream.on("finish", resolve);
      stream.on("error", reject);
      doc.pipe(stream);
      doc.end();
    });

    await Model.updateOne({ _id: id }, { $set: { [fileField]: fileUrl } });

    return fileUrl;
  } catch (err) {
    console.warn(`[saveAndUpdatePdf] ${prefix}-${id}:`, err.message);
    return null;
  }
}

function shouldRegeneratePdf(oldStatus, newStatus) {
  if (newStatus === "draft") return false;
  return true;
}

module.exports = {
  COLORS,
  PAGE,
  CONTENT_WIDTH,
  INSTITUTE_NAME,
  STATUS_LABEL,
  STEP_LABEL,
  FONTS,
  FONT_DIR,
  createDoc,
  registerCyrillicFonts,
  pipeToResponse,
  drawHeader,
  drawTitle,
  drawSectionTitle,
  drawLabelValue,
  drawInfoCard,
  drawParagraph,
  drawList,
  drawTable,
  drawApprovalSteps,
  drawFooter,
  ensureSpace,
  generateBarcodeImage,
  drawBarcode,
  saveAndUpdatePdf,
  shouldRegeneratePdf,
};
