"use strict";

const mongoose = require("mongoose");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { STATUS_IN_STUDY } = require("#modules/4.05-residency/resident/resident.model");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");

const { SESSION_ANNOUNCED, ROSTER_SCOPES } = Session;
const { FRAME_PENDING, FRAME_PRESENT, LIVE_FRAME, SESSION_RESIDENT_INDEX, LIVE_KEY_INDEX } = Roster;

const ORDINATURA = "ordinatura";
const DUPLICATE_KEY = 11000;
const OUR_INDEXES = [SESSION_RESIDENT_INDEX, LIVE_KEY_INDEX];

function studyCutFilter() {
  return {
    program: ORDINATURA,
    active: true,
    status: STATUS_IN_STUDY,
    expulsionOrderCreated: { $ne: true },
    deletedAt: null,
  };
}

const idOf = (v) => v?._id ?? v;

function eligibleFilter(session) {
  const scope = session?.rosterScope;
  const group = idOf(session?.group);
  const supervisor = scope === "supervised" ? idOf(session.announcedBy) : undefined;
  if (!ROSTER_SCOPES.includes(scope) || group == null || (scope === "supervised" && supervisor == null)) {
    throw new Error(`eligibleFilter: sessiya to'liq emas (rosterScope=${scope})`);
  }
  const filter = { ...studyCutFilter(), group };
  if (scope === "supervised") filter.supervisor = supervisor;
  return filter;
}

function selectSessionRoster(session) {
  return Resident.distinct("_id", eligibleFilter(session));
}

function liveFramesOn(session, residentIds) {
  if (!residentIds.length) return Promise.resolve([]);
  return Roster.find({
    resident: { $in: residentIds },
    day: session.day,
    science: idOf(session.science),
    lessonType: session.lessonType,
    ...LIVE_FRAME,
  })
    .select("resident session")
    .lean();
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

async function releaseCancelledHolds(frames) {
  if (!frames.length) return frames;
  const sessionIds = [...new Set(frames.map((f) => String(f.session)))];
  const dead = await Session.distinct("_id", { _id: { $in: sessionIds }, status: { $ne: SESSION_ANNOUNCED } });
  if (!dead.length) return frames;
  await Roster.updateMany({ session: { $in: dead }, ...LIVE_FRAME }, { $set: { cancelledAt: new Date() } });
  const released = new Set(dead.map(String));
  return frames.filter((f) => !released.has(String(f.session)));
}

async function previewRoster(session) {
  const eligible = await selectSessionRoster(session);
  const frames = await releaseCancelledHolds(await liveFramesOn(session, eligible));
  const own = (f) => session._id != null && sameId(f.session, session._id);
  return {
    eligible,
    taken: frames.filter((f) => !own(f)),
    ownFramed: frames.filter(own).map((f) => f.resident),
  };
}

function frameRow(session, residentId) {
  return {
    session: session._id,
    resident: residentId,
    day: session.day,
    science: idOf(session.science),
    lessonType: session.lessonType,
    hours: session.hours,
    outcome: FRAME_PENDING,
    outcomeReason: null,
    attendance: null,
    resolvedAt: null,
    cancelledAt: null,
  };
}

const writeErrorCode = (we) => we?.code ?? we?.err?.code;
const writeErrorMessage = (we) => String(we?.errmsg ?? we?.err?.errmsg ?? we?.message ?? "");
const isOurDuplicate = (we) =>
  writeErrorCode(we) === DUPLICATE_KEY && OUR_INDEXES.some((name) => writeErrorMessage(we).includes(name));
const hasValidationError = (err) =>
  Array.isArray(err?.results) && err.results.some((r) => r instanceof mongoose.Error.ValidationError);

function classifyInsertError(err, rows) {
  if (!Array.isArray(err?.writeErrors) || !err.writeErrors.length || hasValidationError(err)) throw err;
  const notInserted = [];
  for (const we of err.writeErrors) {
    if (!isOurDuplicate(we) || !rows[we.index]) throw err;
    notInserted.push(rows[we.index].resident);
  }
  return notInserted;
}

async function insertFrames(rows) {
  if (!rows.length) return [];
  try {
    await Roster.insertMany(rows, { ordered: false, throwOnValidationError: true });
    return [];
  } catch (err) {
    return classifyInsertError(err, rows);
  }
}

async function cancelFrames(sessionId, at) {
  const res = await Roster.updateMany({ session: sessionId, ...LIVE_FRAME }, { $set: { cancelledAt: at } });
  return res.modifiedCount;
}

async function withdrawFrames(sessionId, residentIds, at, guard = {}) {
  if (!residentIds?.length) return 0;
  const base = { session: sessionId, resident: { $in: residentIds }, outcome: { $ne: FRAME_PRESENT }, ...LIVE_FRAME };
  const res = await Roster.updateMany({ $and: [base, guard] }, { $set: { cancelledAt: at } });
  return res.modifiedCount;
}

async function settleCancelled(sessionId) {
  const live = await Session.exists({ _id: sessionId, status: SESSION_ANNOUNCED });
  if (!live) await cancelFrames(sessionId, new Date());
}

async function markFannedOut(sessionId) {
  const framed = await Roster.countDocuments({ session: sessionId, ...LIVE_FRAME });
  await Session.updateOne(
    { _id: sessionId, status: SESSION_ANNOUNCED },
    { $set: { fannedOutAt: new Date(), framedCount: framed } },
  );
  return framed;
}

const toConflicts = (frames) => frames.map((f) => ({ resident: f.resident, session: f.session }));

async function loadSession(sessionRef) {
  const id = idOf(sessionRef);
  const session = id == null ? null : await Session.findById(id).lean();
  if (!session) throw new Error(`fanOut: sessiya topilmadi (${id})`);
  return session;
}

async function fanOut(sessionRef, hooks = {}) {
  const session = await loadSession(sessionRef);
  if (session.status !== SESSION_ANNOUNCED) {
    await cancelFrames(session._id, session.cancelledAt ?? new Date());
    return { framed: 0, conflicts: [] };
  }
  const { eligible, taken, ownFramed } = await previewRoster(session);
  const skip = new Set([...taken.map((f) => String(f.resident)), ...ownFramed.map(String)]);
  const rows = eligible.filter((id) => !skip.has(String(id))).map((id) => frameRow(session, id));
  if (hooks.beforeWrite) await hooks.beforeWrite();
  let notInserted;
  try {
    notInserted = await insertFrames(rows);
    if (hooks.afterWrite) await hooks.afterWrite();
  } finally {
    await settleCancelled(session._id);
  }
  const framed = await markFannedOut(session._id);
  const late = (await liveFramesOn(session, notInserted)).filter((f) => !sameId(f.session, session._id));
  return { framed, conflicts: toConflicts([...taken, ...late]) };
}

module.exports = {
  studyCutFilter,
  eligibleFilter,
  selectSessionRoster,
  previewRoster,
  fanOut,
  cancelFrames,
  withdrawFrames,
  classifyInsertError,
};
