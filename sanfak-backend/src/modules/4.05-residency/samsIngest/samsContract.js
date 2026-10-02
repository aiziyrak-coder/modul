"use strict";

const { UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");

const SAMS_SCHEMA_VERSION = 1;
const RECONCILE_WINDOW_DAYS = 7;
const MAX_PACKET_DAYS = 31;
const MAX_EMIT_SKEW_MS = 5 * 60_000;
const MAX_EMIT_AGE_DAYS = 31;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DBNAME_RE = /^[A-Za-z0-9_-]{1,100}$/;

const UNMEASURED_REASONS = [
  "unresolved",
  "ambiguous",
  "before_horizon",
  "before_registration",
  "no_schedule",
  "stale",
];
const ORG_UNMEASURED_REASONS = ["before_horizon", "stale"];

const DAY_MS = 86_400_000;

function dayStartUtcMs(day) {
  if (typeof day !== "string" || !DAY_RE.test(day)) return NaN;
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(day, n) {
  const ms = dayStartUtcMs(day);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + n * DAY_MS).toISOString().slice(0, 10);
}

const isDayKey = (s) => typeof s === "string" && DAY_RE.test(s) && addDays(s, 0) === s;

const daysInclusive = (from, to) =>
  Math.round((dayStartUtcMs(to) - dayStartUtcMs(from)) / DAY_MS) + 1;

function enumerateDays(from, to) {
  if (!isDayKey(from) || !isDayKey(to) || from > to) return [];
  const days = [];
  for (let d = from; d <= to && days.length < MAX_PACKET_DAYS; d = addDays(d, 1)) days.push(d);
  return days;
}

const oldestAcceptedDay = (today) => addDays(today, -(MAX_PACKET_DAYS - 1));

const nextDayStartMs = (day) => dayStartUtcMs(day) + DAY_MS - UZ_OFFSET_MINUTES * 60_000;

function isFinalPacket(packetAt, day) {
  if (packetAt === null || packetAt === undefined) return false;
  const ms = new Date(packetAt).getTime();
  const end = nextDayStartMs(day);
  return Number.isFinite(ms) && Number.isFinite(end) && ms >= end;
}

const isFinalRow = (presence, orgDay) =>
  Boolean(presence && orgDay) &&
  orgDay.day === presence.day &&
  orgDay.dbname === presence.dbname &&
  isFinalPacket(presence.packetAt, presence.day) &&
  isFinalPacket(orgDay.packetAt, presence.day);

module.exports = {
  SAMS_SCHEMA_VERSION,
  RECONCILE_WINDOW_DAYS,
  MAX_PACKET_DAYS,
  MAX_EMIT_SKEW_MS,
  MAX_EMIT_AGE_DAYS,
  DAY_RE,
  DBNAME_RE,
  UNMEASURED_REASONS,
  ORG_UNMEASURED_REASONS,
  isDayKey,
  addDays,
  daysInclusive,
  enumerateDays,
  oldestAcceptedDay,
  nextDayStartMs,
  isFinalPacket,
  isFinalRow,
};
