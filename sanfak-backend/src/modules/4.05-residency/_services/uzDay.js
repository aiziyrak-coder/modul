"use strict";

const UZ_OFFSET_MINUTES = 5 * 60;

function uzDayKey(value) {
  if (value === null || value === undefined || value === "") return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + UZ_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 10);
}

function isSameUzDay(a, b) {
  const ka = uzDayKey(a);
  const kb = uzDayKey(b);
  return ka !== null && kb !== null && ka === kb;
}

function uzDaysBetween(a, b) {
  const ka = uzDayKey(a);
  const kb = uzDayKey(b);
  if (ka === null || kb === null) return NaN;
  return Math.round((Date.parse(kb) - Date.parse(ka)) / 86_400_000);
}

module.exports = { uzDayKey, isSameUzDay, uzDaysBetween, UZ_OFFSET_MINUTES };
