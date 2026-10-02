"use strict";

const winston = require("#shared/winston.logger");

const HEADING_FS = 10;
const POSITION_FS = 7;
const NAME_FS = 8;
const DATE_FS = 7;
const STATUS_FS = 6;
const GAP_HEADING_POSITION = 1;
const GAP_BETWEEN_POSITION_LINES = 1;
const GAP_BEFORE_SIGNATURE = 16;
const GAP_NAME_DATE = 2;
const GAP_DATE_STATUS = 1;
const COLOR_TEXT = "#000000";
const COLOR_MUTED = "#444444";
const STATUS_TEXT = "Elektron tasdiqlangan";
const GAP_TEXT_FS = 6;

const QR_PAD = 6;
const QR_CAPTION_PAD = 12;
const QR_CAPTION_FS = 5.5;
const GAP_QR_CAPTION = 1;

const ROW_RATIOS_WITH_STATUS = { position: 0.5, status: 0.2, name: 0.3 };
const ROW_RATIOS_NO_STATUS = { position: 0.5, status: 0.08, name: 0.42 };

function san(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function drawLine(doc, font, fs, color, text, x, y, w, align) {
  doc
    .font(font)
    .fontSize(fs)
    .fillColor(color)
    .text(san(text), x, y, { width: w, align, lineBreak: true });
}

function measureLineHeight(doc, font, fs, text, w, align) {
  doc.font(font).fontSize(fs);
  return doc.heightOfString(san(text), { width: w, align, lineBreak: true });
}

function normalizePositionLines(position, positionFsDefault) {
  if (position === null || position === undefined) return [];
  const arr = Array.isArray(position) ? position : [position];
  return arr
    .filter((item) => item !== null && item !== undefined && item !== "")
    .map((item) =>
      typeof item === "string"
        ? { text: item, fs: positionFsDefault, color: COLOR_TEXT }
        : {
            text: item.text,
            fs: item.fs || positionFsDefault,
            color: item.color || COLOR_TEXT,
          },
    );
}

function qrIsDrawable(qr, sig) {
  if (!qr || !Buffer.isBuffer(qr.image) || !(qr.size > 0)) return false;
  return sig.source === "snapshot" || sig.source === "chain";
}

function captionBox(blockX, blockW, qrX, qrSize) {
  const capW = Math.min(blockW, qrSize + 2 * QR_CAPTION_PAD);
  const centered = qrX + qrSize / 2 - capW / 2;
  const capX = Math.max(blockX, Math.min(centered, blockX + blockW - capW));
  return { capX, capW };
}

function layoutStack(doc, opts) {
  const {
    x,
    y,
    w,
    heading,
    position,
    sig = {},
    align = "center",
    fonts = {},
    scale = 1,
    gapSignature,
    gapText,
    qr,
    qrCaption,
    emptySlotGap,
  } = opts;

  const boldFont = fonts.bold || "Helvetica-Bold";
  const regularFont = fonts.regular || "Helvetica";
  const italicFont = fonts.italic || "Helvetica-Oblique";

  const headingFs = HEADING_FS * scale;
  const positionFsDefault = POSITION_FS * scale;
  const nameFs = NAME_FS * scale;
  const dateFs = DATE_FS * scale;
  const statusFs = STATUS_FS * scale;
  const gapHeadingPosition = GAP_HEADING_POSITION * scale;
  const gapBetweenPositionLines = GAP_BETWEEN_POSITION_LINES * scale;
  const gapBeforeSignature =
    (gapSignature === undefined || gapSignature === null
      ? GAP_BEFORE_SIGNATURE
      : gapSignature) * scale;
  const gapNameDate = GAP_NAME_DATE * scale;
  const gapDateStatus = GAP_DATE_STATUS * scale;
  const drawQr = qrIsDrawable(qr, sig);

  let cy = y;
  const boxes = [];
  const images = [];

  if (heading) {
    const h = measureLineHeight(doc, boldFont, headingFs, heading, w, align);
    boxes.push({ font: boldFont, fs: headingFs, color: COLOR_TEXT, text: heading, x, y: cy, w, align });
    cy += h + gapHeadingPosition;
  }

  const lines = normalizePositionLines(position, positionFsDefault);
  lines.forEach((line, idx) => {
    const h = measureLineHeight(doc, regularFont, line.fs, line.text, w, align);
    boxes.push({ font: regularFont, fs: line.fs, color: line.color, text: line.text, x, y: cy, w, align });
    cy += h;
    if (idx < lines.length - 1) cy += gapBetweenPositionLines;
  });

  if (drawQr) {
    cy += QR_PAD;
    const qrX = x + (w - qr.size) / 2;
    images.push({ image: qr.image, x: qrX, y: cy, w: qr.size, h: qr.size });
    cy += qr.size;
    if (qrCaption) {
      const { capX, capW } = captionBox(x, w, qrX, qr.size);
      cy += GAP_QR_CAPTION;
      const h = measureLineHeight(doc, italicFont, QR_CAPTION_FS, qrCaption, capW, "center");
      boxes.push({
        font: italicFont,
        fs: QR_CAPTION_FS,
        color: COLOR_MUTED,
        text: qrCaption,
        x: capX,
        y: cy,
        w: capW,
        align: "center",
      });
      cy += h;
    }
    cy += QR_PAD;
  } else {
    if (gapText) {
      const gtFs = GAP_TEXT_FS * scale;
      const h = measureLineHeight(doc, italicFont, gtFs, gapText, w, align);
      boxes.push({
        font: italicFont,
        fs: gtFs,
        color: COLOR_MUTED,
        text: gapText,
        x,
        y: cy + Math.max(0, (gapBeforeSignature - h) / 2),
        w,
        align,
      });
      cy += gapBeforeSignature;
    } else if (typeof emptySlotGap === "number" && emptySlotGap >= 0) {
      cy += emptySlotGap * scale;
    } else {
      cy += gapBeforeSignature;
    }
  }

  if (sig.name) {
    const h = measureLineHeight(doc, boldFont, nameFs, sig.name, w, align);
    boxes.push({ font: boldFont, fs: nameFs, color: COLOR_TEXT, text: sig.name, x, y: cy, w, align });
    cy += h;
  }
  cy += gapNameDate;
  {
    const dateText = sig.dateText || "";
    const h = measureLineHeight(doc, regularFont, dateFs, dateText, w, align);
    boxes.push({ font: regularFont, fs: dateFs, color: COLOR_MUTED, text: dateText, x, y: cy, w, align });
    cy += h;
  }

  if (!gapText && !drawQr && (sig.source === "snapshot" || sig.source === "chain")) {
    cy += gapDateStatus;
    const h = measureLineHeight(doc, italicFont, statusFs, STATUS_TEXT, w, align);
    boxes.push({ font: italicFont, fs: statusFs, color: COLOR_MUTED, text: STATUS_TEXT, x, y: cy, w, align });
    cy += h;
  }

  return { height: cy - y, boxes, images };
}

function layoutRow(doc, opts) {
  const { x, y, w, position, sig = {}, fonts = {}, scale = 1, qr, qrCaption, statusText } = opts;

  const boldFont = fonts.bold || "Helvetica-Bold";
  const regularFont = fonts.regular || "Helvetica";
  const italicFont = fonts.italic || "Helvetica-Oblique";

  const positionFsDefault = POSITION_FS * scale;
  const nameFs = NAME_FS * scale;
  const dateFs = DATE_FS * scale;
  const statusFs = STATUS_FS * scale;
  const gapBetweenPositionLines = GAP_BETWEEN_POSITION_LINES * scale;
  const gapNameDate = GAP_NAME_DATE * scale;

  const hasStatus = sig.source === "snapshot" || sig.source === "chain";
  const drawQr = qrIsDrawable(qr, sig);
  const ratios = hasStatus ? ROW_RATIOS_WITH_STATUS : ROW_RATIOS_NO_STATUS;
  const posW = w * ratios.position;
  const statusW = w * ratios.status;
  const nameW = w * ratios.name;
  const posX = x;
  const statusX = x + posW;
  const nameX = x + posW + statusW;

  const posBoxes = [];
  const nameBoxes = [];
  const midBoxes = [];
  const images = [];

  const lines = normalizePositionLines(position, positionFsDefault);
  let py = 0;
  lines.forEach((line, idx) => {
    const h = measureLineHeight(doc, regularFont, line.fs, line.text, posW, "left");
    posBoxes.push({ font: regularFont, fs: line.fs, color: line.color, text: line.text, x: posX, y: py, w: posW, align: "left" });
    py += h;
    if (idx < lines.length - 1) py += gapBetweenPositionLines;
  });
  const posH = py;

  let midH = 0;
  if (drawQr) {
    const qrX = statusX + (statusW - qr.size) / 2;
    images.push({ image: qr.image, x: qrX, y: 0, w: qr.size, h: qr.size });
    midH = qr.size;
    if (qrCaption) {
      const { capX, capW } = captionBox(statusX, statusW, qrX, qr.size);
      const h = measureLineHeight(doc, italicFont, QR_CAPTION_FS, qrCaption, capW, "center");
      midBoxes.push({
        font: italicFont,
        fs: QR_CAPTION_FS,
        color: COLOR_MUTED,
        text: qrCaption,
        x: capX,
        y: midH + GAP_QR_CAPTION,
        w: capW,
        align: "center",
      });
      midH += GAP_QR_CAPTION + h;
    }
  } else if (hasStatus) {
    const text = statusText || STATUS_TEXT;
    const h = measureLineHeight(doc, italicFont, statusFs, text, statusW, "center");
    midBoxes.push({ font: italicFont, fs: statusFs, color: COLOR_MUTED, text, x: statusX, y: 0, w: statusW, align: "center" });
    midH = h;
  }

  let ny = 0;
  if (sig.name) {
    const h = measureLineHeight(doc, boldFont, nameFs, sig.name, nameW, "right");
    nameBoxes.push({ font: boldFont, fs: nameFs, color: COLOR_TEXT, text: sig.name, x: nameX, y: ny, w: nameW, align: "right" });
    ny += h;
  }
  ny += gapNameDate;
  {
    const dateText = sig.dateText || "";
    const h = measureLineHeight(doc, regularFont, dateFs, dateText, nameW, "right");
    nameBoxes.push({ font: regularFont, fs: dateFs, color: COLOR_MUTED, text: dateText, x: nameX, y: ny, w: nameW, align: "right" });
    ny += h;
  }
  const nameH = ny;

  const height = Math.max(posH, midH, nameH);
  const posShift = drawQr ? Math.max(0, (height - posH) / 2) : 0;
  const nameShift = drawQr ? Math.max(0, (height - nameH) / 2) : 0;
  const midShift = drawQr ? Math.max(0, (height - midH) / 2) : 0;

  const shift = (arr, dy) => arr.map((b) => ({ ...b, y: y + b.y + dy }));
  const boxes = [...shift(posBoxes, posShift), ...shift(midBoxes, midShift), ...shift(nameBoxes, nameShift)];
  const shiftedImages = shift(images, midShift);

  return { height, boxes, images: shiftedImages };
}

function layoutSignatureBlock(doc, opts = {}) {
  if (opts.layout === "row") return layoutRow(doc, opts);
  return layoutStack(doc, opts);
}

function drawSignatureBlock(doc, opts = {}) {
  const { height, boxes, images } = layoutSignatureBlock(doc, opts);
  for (const img of images) {
    try {
      doc.image(img.image, img.x, img.y, { width: img.w, height: img.h });
    } catch (err) {
      winston.error(`[signatureBlock] QR rasmini chizib bo'lmadi: ${err.message}`);
    }
  }
  for (const box of boxes) {
    drawLine(doc, box.font, box.fs, box.color, box.text, box.x, box.y, box.w, box.align);
  }
  return height;
}

function measureSignatureBlock(doc, opts = {}) {
  return layoutSignatureBlock(doc, { x: 0, y: 0, ...opts }).height;
}

module.exports = {
  drawSignatureBlock,
  measureSignatureBlock,
  layoutSignatureBlock,
  QR_PAD,
  QR_CAPTION_PAD,
  QR_CAPTION_FS,
};
