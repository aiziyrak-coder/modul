"use strict";

function fmtNum(v) {
  if (typeof v !== "number" || !Number.isFinite(v) || Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

const pad2 = (n) => String(n).padStart(2, "0");

function fmtDocDate(v) {
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? "" : `${pad2(v.getDate())}.${pad2(v.getMonth() + 1)}.${v.getFullYear()}`;
  }
  const s = v == null ? "" : String(v).trim();
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return m ? `${pad2(m[1])}.${pad2(m[2])}.${m[3]}` : s;
}

module.exports = { fmtNum, fmtDocDate };
