"use strict";

const PG = { W: 842, H: 595, M: 18 };
const CW = PG.W - PG.M * 2;
const FOOTER_H = 14;

const C = {
  border: "#000000",
  text: "#000000",
  muted: "#333333",
  headerBg: "#e8e8e8",
  white: "#ffffff",
};

const STATUS_LABEL = {
  draft: "Qoralama",
  submitted: "Yuborilgan",
  approved: "Tasdiqlangan",
  rejected: "Rad etildi",
  completed: "Bajarilgan",
};

function san(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return san(v.uz || v.ru || v.en || v.title || "");
  return String(v)
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"');
}

function fmtDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
}

function bdr(doc, x, y, w, h, fill, lw = 0.4) {
  if (fill) doc.rect(x, y, w, h).fill(fill);
  doc.rect(x, y, w, h).strokeColor(C.border).lineWidth(lw).stroke();
}

function fontOf({ bold = false, italic = false } = {}) {
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

function ct(doc, text, x, y, w, h, opts = {}) {
  const { fs = 6, color = C.text, align = "center" } = opts;
  const str = san(text);
  doc.font(fontOf(opts)).fontSize(fs);
  const textH = doc.heightOfString(str, { width: w - 3, align });
  const ty = y + Math.max(0, (h - textH) / 2);
  doc.fillColor(color).text(str, x + 1.5, ty, {
    width: w - 3,
    height: h,
    align,
    lineBreak: true,
  });
}

function measureCell(doc, text, w, opts = {}) {
  const { fs = 6, align = "center" } = opts;
  doc.font(fontOf(opts)).fontSize(fs);
  return doc.heightOfString(san(text), { width: w - 3, align });
}

function ctUp(doc, text, x, y, w, h, opts = {}) {
  const { fs = 5.5, color = C.text } = opts;
  doc.save();
  doc.translate(x + w / 2, y + h / 2);
  doc.rotate(-90);
  doc
    .font(fontOf(opts))
    .fontSize(fs)
    .fillColor(color)
    .text(san(text), -(h / 2) + 2, -(w / 2) + 1, {
      width: h - 4,
      align: "center",
      lineBreak: true,
    });
  doc.restore();
}

function checkPage(doc, y, needed = 20) {
  if (y + needed > PG.H - PG.M - FOOTER_H) {
    doc.addPage();
    return PG.M;
  }
  return y;
}

function drawFooterLandscape(doc, docTitle, docStatus) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const fy = PG.H - PG.M - 8;
    doc
      .moveTo(PG.M, fy - 3)
      .lineTo(PG.W - PG.M, fy - 3)
      .strokeColor(C.muted)
      .lineWidth(0.4)
      .stroke();
    doc
      .font("Helvetica")
      .fontSize(6)
      .fillColor(C.muted)
      .text(
        `${san(docTitle)} | Holat: ${STATUS_LABEL[docStatus] || san(docStatus)}`,
        PG.M,
        fy,
        { width: CW - 60, align: "left", lineBreak: false },
      )
      .text(`${i - range.start + 1} / ${range.count}`, PG.W - PG.M - 55, fy, {
        width: 55,
        align: "right",
        lineBreak: false,
      });
  }
  return range.count;
}

module.exports = {
  PG,
  CW,
  FOOTER_H,
  C,
  STATUS_LABEL,
  san,
  fmtDate,
  bdr,
  ct,
  ctUp,
  measureCell,
  checkPage,
  drawFooterLandscape,
};
