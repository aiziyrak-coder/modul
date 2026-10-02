"use strict";

const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { START_MONTH } = require("#modules/4.05-residency/_services/unexcusedWindow");

const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isCalendarDay(s) {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  return new Date(`${s}T00:00:00.000Z`).toISOString().slice(0, 10) === s;
}

function todayUz(now = new Date()) {
  return uzDayKey(now);
}

function academicYearLastDay(dayKey) {
  const year = Number(dayKey.slice(0, 4));
  const month = Number(dayKey.slice(5, 7));
  const startYear = month >= START_MONTH ? year : year - 1;
  return new Date(Date.UTC(startYear + 1, START_MONTH - 1, 0)).toISOString().slice(0, 10);
}

function announceableRange(now = new Date()) {
  const from = todayUz(now);
  return { from, to: academicYearLastDay(from) };
}

function isDayOpen(day, now = new Date()) {
  return typeof day === "string" && day >= todayUz(now);
}

module.exports = {
  DAY_RE,
  isCalendarDay,
  todayUz,
  academicYearLastDay,
  announceableRange,
  isDayOpen,
};
