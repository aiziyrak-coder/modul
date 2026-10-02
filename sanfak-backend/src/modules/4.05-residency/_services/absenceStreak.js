"use strict";

const { uzDayKey } = require("./uzDay");
const {
  isDayKey,
  addDays,
  nextDayStartMs,
} = require("#modules/4.05-residency/samsIngest/samsContract");

const MISS_STATUS = "absent";
const BREAK_STATUSES = ["present", "excused"];

function groupByDay(rows = []) {
  const days = new Map();
  for (const r of rows) {
    const key = uzDayKey(r?.date);
    if (!key) continue;

    const cur = days.get(key) || { miss: false, broken: false };
    if (BREAK_STATUSES.includes(r.status)) cur.broken = true;
    else if (r.status === MISS_STATUS) cur.miss = true;
    days.set(key, cur);
  }
  const out = new Map();
  for (const [key, v] of days) out.set(key, { miss: v.miss && !v.broken });
  return out;
}

function absenceWindow(today, windowDays) {
  if (!isDayKey(today) || !Number.isInteger(windowDays) || windowDays < 1) return null;
  return {
    windowDays,
    windowFrom: addDays(today, -windowDays),
    windowTo: addDays(today, -1),
  };
}

function windowRange({ windowFrom, windowTo }) {
  return {
    $gte: new Date(nextDayStartMs(addDays(windowFrom, -1))),
    $lt: new Date(nextDayStartMs(windowTo)),
  };
}

const EMPTY = Object.freeze({
  days: 0,
  from: null,
  to: null,
  dayKeys: [],
  windowDays: null,
  windowFrom: null,
  windowTo: null,
});

function countMissedDays(rows = [], { today, windowDays } = {}) {
  const win = absenceWindow(today, windowDays);
  if (!win) return { ...EMPTY, dayKeys: [] };

  const dayKeys = [...groupByDay(rows)]
    .filter(([key, v]) => v.miss && key >= win.windowFrom && key <= win.windowTo)
    .map(([key]) => key)
    .sort();
  return {
    days: dayKeys.length,
    from: dayKeys[0] ?? null,
    to: dayKeys[dayKeys.length - 1] ?? null,
    dayKeys,
    ...win,
  };
}

function meetsThreshold(days, threshold) {
  const limit = Number(threshold);
  if (!Number.isFinite(limit) || limit < 1) return false;
  return days >= limit;
}

module.exports = {
  countMissedDays,
  absenceWindow,
  windowRange,
  groupByDay,
  meetsThreshold,
  MISS_STATUS,
  BREAK_STATUSES,
};
