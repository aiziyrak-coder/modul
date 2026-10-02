"use strict";

const { toMinutes } = require("#modules/4.05-residency/residencySetting/residencySetting.model");
const { uzDayKey, UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");
const { nextDayStartMs, isFinalPacket } = require("#modules/4.05-residency/samsIngest/samsContract");
const { coveringExcuse } = require("#modules/4.05-residency/_services/approvedExcuses");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");

const OUTCOMES = Object.freeze({
  PRESENT: Roster.FRAME_PRESENT,
  ABSENT: Roster.FRAME_ABSENT,
  UNMEASURED: Roster.FRAME_UNMEASURED,
  PENDING: Roster.FRAME_PENDING,
  VOID: Roster.FRAME_VOID,
});

const REASONS = Object.freeze({
  SESSION_CANCELLED: "session_cancelled",
  WITHDRAWN: "withdrawn",
  INVALID_WINDOW: "invalid_window",
  OVERLAP: "overlap",
  OUTAGE_WINDOW: "outage_window",
  IN_PROGRESS: "in_progress",
  AWAITING_CLOSE: "awaiting_close",
  NO_FACTS: "no_facts",
  TENANT_UNMEASURED: "tenant_unmeasured",
  SYNTHETIC_ONLY: "synthetic_only",
  UNKNOWN_DEVICE: "unknown_device",
  UNREADABLE_TIME: "unreadable_time",
  NO_CLOSE_PACKET: "no_close_packet",
  NO_OVERLAP: "no_overlap",
});

const RESOLVER_VERSION = 1;
const RESOLUTION_WINDOW_DAYS = 7;

const REAL_DEVICES = Object.freeze([1, 2]);
const SYNTHETIC_DEVICE = 3;
const LATE_CAP_MINUTES = 600;
const DAY_MINUTES = 1440;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const UZ_OFFSET_MS = UZ_OFFSET_MINUTES * MINUTE_MS;

const dayStartMs = (day) => Date.parse(`${day}T00:00:00.000Z`);

const sessionRowDate = (day) => new Date(`${day}T00:00:00.000Z`);

function uzInstant(day, hhmm) {
  const minutes = toMinutes(hhmm);
  return minutes === null ? null : new Date(dayStartMs(day) + minutes * MINUTE_MS - UZ_OFFSET_MS);
}
const sessionStartInstant = (day, startTime) => uzInstant(day, startTime);
const sessionEndInstant = (day, endTime) => uzInstant(day, endTime);

const dayEndInstant = (day) => new Date(nextDayStartMs(day));

const uzMinutesOf = (now) => Math.floor((((now.getTime() + UZ_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / MINUTE_MS);

const pad2 = (n) => String(n).padStart(2, "0");
const hhmmOf = (minutes) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;

function closedExit(record, inMin) {
  const outMin = record.outDevice === SYNTHETIC_DEVICE ? null : toMinutes(record.exitTime);
  return outMin !== null && outMin >= inMin ? outMin : null;
}

function toInterval(record, { today, nowMin }) {
  const inMin = toMinutes(record?.accessTime);
  if (inMin === null || (today && inMin > nowMin)) return null;
  const outMin = closedExit(record, inMin);
  const openEnd = today ? nowMin : DAY_MINUTES;
  return { inMin, end: outMin ?? openEnd, outMin, inDevice: record.inDevice ?? null };
}

function windowOf(session, fallbackWindow) {
  const endTime = session.endTime ?? fallbackWindow?.to;
  return { startMin: toMinutes(session.startTime ?? fallbackWindow?.from), endMin: toMinutes(endTime), endTime };
}

function buildContext({ session, entry, facts, outages, excuses, now, fallbackWindow }) {
  const { startMin, endMin, endTime } = windowOf(session, fallbackWindow);
  const clock = { today: uzDayKey(now) === session.day, nowMin: uzMinutesOf(now) };
  const records = facts?.records ?? [];
  const intervals = records.map((r) => toInterval(r, clock)).filter(Boolean);
  return {
    day: session.day,
    cancelled: session.cancelled === true,
    withdrawn: entry?.withdrawn === true,
    facts: facts ?? null,
    outages: outages ?? [],
    excuses: excuses ?? [],
    now,
    startMin,
    endMin,
    overlapping: intervals.filter((iv) => iv.inMin < endMin && iv.end > startMin),
    unreadable: records.some((r) => toMinutes(r?.accessTime) === null),
    endI: sessionEndInstant(session.day, endTime),
    dayEndI: dayEndInstant(session.day),
  };
}

const verdict = (outcome, reason) => ({
  outcome,
  reason,
  samsFirstIn: null,
  samsLastOut: null,
  checkInTime: null,
  checkOutTime: null,
  lateMinutes: null,
  devices: [],
  excuse: null,
});

const isReal = (iv) => REAL_DEVICES.includes(iv.inDevice);

function presentVerdict(real, startMin) {
  const firstIn = Math.min(...real.map((iv) => iv.inMin));
  const outs = real.map((iv) => iv.outMin).filter((m) => m !== null);
  const lastOut = outs.length ? Math.max(...outs) : null;
  const paired = lastOut !== null && firstIn < lastOut;
  const late = firstIn - startMin;
  return {
    ...verdict(OUTCOMES.PRESENT, REASONS.OVERLAP),
    samsFirstIn: hhmmOf(firstIn),
    samsLastOut: lastOut === null ? null : hhmmOf(lastOut),
    checkInTime: paired ? hhmmOf(firstIn) : null,
    checkOutTime: paired ? hhmmOf(lastOut) : null,
    lateMinutes: late > 0 ? Math.min(late, LATE_CAP_MINUTES) : null,
    devices: [...new Set(real.map((iv) => iv.inDevice))].sort((a, b) => a - b),
  };
}

const coversOutage = (o, c) =>
  Boolean(o) && o.fromDay <= c.day && c.day <= o.toDay && (!o.dbname || o.dbname === c.facts?.dbname);

const awaitingClose = (c, reasonAfterClose) =>
  c.now < c.dayEndI
    ? verdict(OUTCOMES.PENDING, REASONS.AWAITING_CLOSE)
    : verdict(OUTCOMES.UNMEASURED, reasonAfterClose);

function unverifiedOverlap(c) {
  const unverified = c.overlapping.filter((iv) => !isReal(iv));
  if (!unverified.length) return null;
  const synthetic = unverified.some((iv) => iv.inDevice === SYNTHETIC_DEVICE);
  return verdict(OUTCOMES.UNMEASURED, synthetic ? REASONS.SYNTHETIC_ONLY : REASONS.UNKNOWN_DEVICE);
}

const validWindow = (c) => c.startMin !== null && c.endMin !== null && c.startMin < c.endMin;

const RULES = Object.freeze([
  (c) => (c.cancelled ? verdict(OUTCOMES.VOID, REASONS.SESSION_CANCELLED) : null),
  (c) => (c.withdrawn ? verdict(OUTCOMES.VOID, REASONS.WITHDRAWN) : null),
  (c) => (validWindow(c) ? null : verdict(OUTCOMES.UNMEASURED, REASONS.INVALID_WINDOW)),
  (c) => {
    const real = c.overlapping.filter(isReal);
    return real.length ? presentVerdict(real, c.startMin) : null;
  },
  (c) => (c.outages.some((o) => coversOutage(o, c)) ? verdict(OUTCOMES.UNMEASURED, REASONS.OUTAGE_WINDOW) : null),
  (c) => (c.now < c.endI ? verdict(OUTCOMES.PENDING, REASONS.IN_PROGRESS) : null),
  (c) => (c.facts ? null : awaitingClose(c, REASONS.NO_FACTS)),
  (c) => (c.facts.measured === true ? null : verdict(OUTCOMES.UNMEASURED, c.facts.reason || REASONS.TENANT_UNMEASURED)),
  unverifiedOverlap,
  (c) => (c.unreadable ? verdict(OUTCOMES.UNMEASURED, REASONS.UNREADABLE_TIME) : null),
  (c) => (isFinalPacket(c.facts.packetAt, c.day) ? null : awaitingClose(c, REASONS.NO_CLOSE_PACKET)),
  (c) => ({
    ...verdict(OUTCOMES.ABSENT, REASONS.NO_OVERLAP),
    excuse: coveringExcuse(c.excuses, sessionRowDate(c.day)),
  }),
]);

function resolveEntry(input) {
  const ctx = buildContext(input);
  for (const rule of RULES) {
    const result = rule(ctx);
    if (result) return result;
  }
  /* istanbul ignore next — R10 har doim natija qaytaradi */
  throw new Error("resolveEntry: qoida topilmadi");
}

module.exports = {
  resolveEntry,
  OUTCOMES,
  REASONS,
  RESOLVER_VERSION,
  RESOLUTION_WINDOW_DAYS,
  sessionStartInstant,
  sessionEndInstant,
  dayEndInstant,
  sessionRowDate,
  uzMinutesOf,
};
