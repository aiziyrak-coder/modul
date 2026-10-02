"use strict";

const winston = require("#shared/winston.logger");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { excusePatch } = require("./approvedExcuses");
const { OUTCOMES, sessionRowDate } = require("./sessionResolver");

const TARGET = Object.freeze({ NONE: "none", PRESENT: "present", ABSENT: "absent", EXCUSED: "excused" });
const DUPLICATE_KEY = 11000;
const DEFAULT_HOURS = 2;

const EXCUSE_CLEARS = Object.freeze({ excuseReason: null, excuseApprovedBy: null, fromDate: null, toDate: null, application: null });
const ABSENT_CLEARS = Object.freeze({
  samsVerified: false,
  manualVerified: false,
  checkInTime: null,
  checkOutTime: null,
  late: false,
  lateMinutes: null,
  score: null,
});

function targetOf(result) {
  if (result.outcome === OUTCOMES.PRESENT) return TARGET.PRESENT;
  if (result.outcome === OUTCOMES.ABSENT) return result.excuse ? TARGET.EXCUSED : TARGET.ABSENT;
  return TARGET.NONE;
}

const isLive = (row) => Boolean(row) && !row.deletedAt;
const idOf = (v) => v?._id ?? v ?? null;

const lessonFields = (session, rev) => ({
  date: sessionRowDate(session.day),
  hours: session.hours,
  science: idOf(session.science),
  scienceTitle: session.scienceTitle ?? null,
  lessonType: session.lessonType,
  teacher: idOf(session.announcedBy),
  group: idOf(session.group),
  active: true,
  deletedAt: null,
  deletedBy: null,
  deletionReason: null,
  sessionRev: rev,
});

const copiesFrameScore = (result, row) =>
  targetOf(result) === TARGET.PRESENT && !(isLive(row) && row.status === "present");

function presentFields(result, row, entry) {
  const fields = {
    status: "present",
    samsVerified: true,
    manualVerified: false,
    checkInTime: result.checkInTime,
    checkOutTime: result.checkOutTime,
    late: Number.isFinite(result.lateMinutes),
    lateMinutes: result.lateMinutes,
    ...EXCUSE_CLEARS,
  };
  if (copiesFrameScore(result, row)) fields.score = entry.score ?? null;
  return fields;
}

const keepsExcuse = (row) => row?.status === "excused";

function statusFields(target, { result, row, entry }) {
  if (target === TARGET.PRESENT) return presentFields(result, row, entry);
  if (keepsExcuse(row)) return {};
  if (target === TARGET.EXCUSED) return { ...ABSENT_CLEARS, ...excusePatch(result.excuse) };
  return { status: "absent", ...ABSENT_CLEARS, ...EXCUSE_CLEARS };
}

const comparable = (v) => {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  return typeof v === "object" ? String(v) : v;
};
const sameAsRow = (row, set) =>
  Object.entries(set).every(([k, v]) => k === "sessionRev" || comparable(row[k]) === comparable(v));

const unexcusedHours = (row) => (isLive(row) && row.status === "absent" ? row.hours || DEFAULT_HOURS : 0);

const revCas = (rev) => ({ $or: [{ sessionRev: null }, { sessionRev: { $lte: rev } }] });
const scorePin = (set, row) => (set.status === "present" && "score" in set ? { scoreRev: row?.scoreRev ?? null } : {});

const outcomeOf = (fields) => ({ changed: false, stale: false, affectsHours: false, rowId: null, skipped: null, ...fields });

async function writeExisting({ key, row, set, rev }) {
  const filter = { ...key, ...revCas(rev), status: row.status, application: row.application ?? null, ...scorePin(set, row) };
  const res = await Attendance.updateOne(filter, { $set: set }, { runValidators: true });
  return res.matchedCount > 0;
}

async function writeNew({ key, set, rev, guard }) {
  const filter = { ...key, ...revCas(rev), ...guard };
  try {
    const res = await Attendance.updateOne(filter, { $set: set }, { upsert: true, runValidators: true });
    return res.upsertedId ?? (res.matchedCount > 0 ? rowIdOf(key) : null);
  } catch (err) {
    if (err?.code !== DUPLICATE_KEY) throw err;
    const res = await Attendance.updateOne(filter, { $set: set }, { runValidators: true });
    if (res.matchedCount > 0) return rowIdOf(key);
    if (err.keyPattern?.session || (await rowIdOf(key))) return null;
    throw err;
  }
}

async function rowIdOf(key) {
  const doc = await Attendance.findOne(key, { _id: 1 }, { includeDeleted: true }).lean();
  return doc?._id ?? null;
}

function lessonConflict(err, ctx) {
  if (err?.code !== DUPLICATE_KEY || err.keyPattern?.session) throw err;
  winston.error(
    `[4.5 sessionProjection] dars kaliti to'qnashuvi session=${ctx.session._id} resident=${ctx.entry.resident} ` +
      `index=${Object.keys(err.keyPattern ?? {}).join(",")}`,
  );
  return outcomeOf({ skipped: "lesson_conflict" });
}

function manualRowExists(session, entry) {
  return Attendance.exists({
    resident: entry.resident,
    date: sessionRowDate(session.day),
    science: idOf(session.science),
    lessonType: session.lessonType,
    session: null,
  });
}

async function hideRow({ session, entry, result, row, rev, now }) {
  if (!isLive(row)) return outcomeOf({});
  const set = { deletedAt: now, deletionReason: `session:${result.outcome}:${result.reason}`, sessionRev: rev };
  const key = { session: session._id, resident: entry.resident };
  const ok = await writeExisting({ key, row, set, rev });
  if (!ok) return outcomeOf({ stale: true, rowId: row._id });
  return outcomeOf({ changed: true, affectsHours: unexcusedHours(row) > 0 });
}

async function persist({ session, entry, row, rev }, set, target) {
  const key = { session: session._id, resident: entry.resident };
  if (row) return (await writeExisting({ key, row, set, rev })) ? row._id : null;
  const guard = target === TARGET.PRESENT ? scorePin(set, null) : { status: { $ne: "excused" } };
  return writeNew({ key, set, rev, guard });
}

async function showRow(ctx, target) {
  const { session, entry, row, rev } = ctx;
  const set = { ...lessonFields(session, rev), ...statusFields(target, ctx) };
  if (isLive(row) && sameAsRow(row, set)) return outcomeOf({ rowId: row._id });
  if (!isLive(row) && (await manualRowExists(session, entry))) {
    winston.warn(`[4.5 sessionProjection] qo'lda yozilgan dars bor — o'tkazildi session=${session._id} resident=${entry.resident}`);
    return outcomeOf({ skipped: "manual_row" });
  }
  const rowId = await persist(ctx, set, target);
  if (!rowId) return outcomeOf({ stale: true, rowId: idOf(row) });
  const status = set.status ?? row.status;
  const after = status === "absent" ? session.hours : 0;
  return outcomeOf({ changed: true, rowId, affectsHours: unexcusedHours(row) !== after });
}

async function applyResult(p) {
  const target = targetOf(p.result);
  try {
    return target === TARGET.NONE ? await hideRow(p) : await showRow(p, target);
  } catch (err) {
    return lessonConflict(err, p);
  }
}

module.exports = { applyResult, copiesFrameScore, targetOf, TARGET };
