"use strict";

const PAGE = { width: 842, height: 595, margin: 18 };
PAGE.contentWidth = PAGE.width - PAGE.margin * 2;

const PALETTE = {
  border: "#444",
  lineWidth: 0.4,
  text: "#000",
  muted: "#333",
  headerBg: "#ddd",
  subHeaderBg: "#eee",
  accentBg: "#eef2f7",
  white: "#fff",
};

const KEY_COLORS = {
  T: "#4a90d9",
  A: "#f39c12",
  K: "#27ae60",
  I: "#8e44ad",
  M: "#e74c3c",
  D: "#16a085",
  G: "#2c3e50",
};
const getKeyBg = (k) => KEY_COLORS[(k || "").trim().toUpperCase()] || null;

function cell(doc, x, y, w, h, text, opts = {}) {
  const {
    fs = 6,
    bold = false,
    color = PALETTE.text,
    align = "center",
    bg = null,
    valign = "mid",
  } = opts;
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc
    .rect(x, y, w, h)
    .strokeColor(PALETTE.border)
    .lineWidth(PALETTE.lineWidth)
    .stroke();
  const top = valign === "top" ? 2 : Math.max(1, (h - fs * 1.3) / 2);
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(fs)
    .fillColor(color)
    .text(String(text ?? ""), x + 1.5, y + top, {
      width: w - 3,
      height: h - 2,
      align,
      lineBreak: true,
      ellipsis: true,
    });
}

module.exports = { PAGE, PALETTE, KEY_COLORS, getKeyBg, cell };
