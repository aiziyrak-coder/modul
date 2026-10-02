"use strict";

const { uzDayKey, UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");
const { addDays, isDayKey, isFinalPacket, isFinalRow, nextDayStartMs } = require("./samsContract");
const { monitorConfig } = require("./samsMonitorConfig");

const DAY_MS = 86_400_000;
const MAX_DAY_RANGE = 93;

const dayStartMs = (key) =>
  isDayKey(key) ? Date.parse(`${key}T00:00:00.000Z`) - UZ_OFFSET_MINUTES * 60_000 : NaN;

function dayRange(from, to) {
  if (!isDayKey(from) || !isDayKey(to)) throw new RangeError(`dayRange: yaroqsiz kun ${from}..${to}`);
  if (from > to) return [];
  const span = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
  if (span > MAX_DAY_RANGE) throw new RangeError(`dayRange: ${span} kun > ${MAX_DAY_RANGE}`);
  return Array.from({ length: span }, (_v, i) => addDays(from, i));
}

const isFinal = (org) => Boolean(org) && isFinalPacket(org.packetAt, org.day);

const isOverdue = (day, now, cfg) => now.getTime() >= nextDayStartMs(day) + cfg.closeGraceMs;

function isStale(org, now, cfg = monitorConfig()) {
  if (!org || isFinal(org)) return false;
  const today = uzDayKey(now);
  if (org.day === today) return now.getTime() - new Date(org.receivedAt).getTime() > cfg.staleAfterMs;
  if (org.day < today) return isOverdue(org.day, now, cfg);
  return false;
}

function deliveryState(org, now, cfg = monitorConfig()) {
  if (!org) return "none";
  if (isFinal(org)) return "final";
  if (org.unmeasuredReason === "stale" || isStale(org, now, cfg)) return "stale";
  return "open";
}

const countsForAccrual = (presence, org) =>
  presence?.measured === true && org?.measured === true && isFinalRow(presence, org);

module.exports = {
  MAX_DAY_RANGE,
  addDays,
  dayStartMs,
  dayRange,
  isFinal,
  isOverdue,
  isStale,
  deliveryState,
  countsForAccrual,
};
