"use strict";

const { ErrorHandler } = require("#shared/error");
const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { canAccessResident, buildResidentScope } = require("#modules/4.05-residency/_services/residentScope");
const { resolveSession } = require("#modules/4.05-residency/_services/sessionResolution");
const { todayUz } = require("#modules/4.05-residency/_services/sessionDay");
const { MSG: EVIDENCE_MSG } = require("#modules/4.05-residency/_services/presenceEvidence");
const { isGradedLessonType, LESSON_TYPE_NOT_GRADED } = require("./residencySessionRosterView");
const { LESSON_TYPE_NOT_GRADED_MSG } = require("#modules/4.05-residency/_services/lessonTypeGrading");
const {
  currentAcademicYearWindow,
  currentAcademicYearTitle,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const { SESSION_CANCELLED } = Session;
const { FRAME_PRESENT, FRAME_ABSENT, FRAME_PENDING, FRAME_UNMEASURED, FRAME_VOID, LIVE_FRAME } = Roster;

const MSG = Object.freeze({
  sessionNotFound: "Mashg'ulot topilmadi",
  entryNotFound: "Rezident bu mashg'ulot ro'yxatida topilmadi",
  cancelled: "Mashg'ulot bekor qilingan — ball qo'yilmaydi",
  lessonTypeNotGraded: LESSON_TYPE_NOT_GRADED_MSG,
  notConfirmed: "Rezident SAMS orqali kelgani tasdiqlanmagan — ball qo'yilmaydi (TZ 4.5.4)",
  stateChanged: EVIDENCE_MSG.stateChanged,
  scored: "Ball qo'yildi",
  cleared: "Ball olib tashlandi",
  outOfScope: "Bu rezident sizning ko'rish doirangizda emas",
  residentNotFound: "Rezident topilmadi",
});

const fail = (status, message, reason, extra = {}) => new ErrorHandler(status, message, reason, { reason, ...extra });

const rowScoreCas = (now) => ({ $or: [{ scoreRev: null }, { scoreRev: { $lt: now.getTime() } }] });
const frameScoreCas = (now) => ({ $or: [{ scoredAt: null }, { scoredAt: { $lt: now } }] });
const rowClearCas = (now) => ({ $or: [{ scoreRev: null }, { scoreRev: { $lte: now.getTime() } }] });

const liveEntry = (sessionId, residentId) =>
  Roster.findOne({ session: sessionId, resident: residentId, ...LIVE_FRAME }).lean();

async function loadGradable({ sessionId, residentId, user }) {
  const session = await Session.findById(sessionId).select("status lessonType").lean();
  if (!session) throw fail(404, MSG.sessionNotFound, "session_not_found");
  if (!isGradedLessonType(session.lessonType)) throw fail(409, MSG.lessonTypeNotGraded, LESSON_TYPE_NOT_GRADED);
  if (session.status === SESSION_CANCELLED) throw fail(409, MSG.cancelled, "session_cancelled");
  const resident = await Resident.findById(residentId).select("supervisor department user").lean();
  if (!resident || !canAccessResident(user, resident, "write")) throw fail(404, MSG.entryNotFound, "entry_not_found");
  const entry = await liveEntry(sessionId, residentId);
  if (!entry) throw fail(404, MSG.entryNotFound, "entry_not_found");
  return entry;
}

const newerRowScore = (key, now) =>
  Attendance.findOne({ ...key, scoreRev: { $gt: now.getTime() } }, { _id: 1 }, { includeDeleted: true }).lean();

async function clearScore(entry, user, now) {
  const framed = await Roster.updateOne(
    { _id: entry._id, ...frameScoreCas(now) },
    { $set: { score: null, scoredBy: user._id, scoredAt: now } },
  );
  if (!framed.matchedCount) throw fail(409, MSG.stateChanged, "state_changed");
  const key = { session: entry.session, resident: entry.resident };
  const row = await Attendance.updateOne({ ...key, ...rowClearCas(now) }, { $set: { score: null, scoreRev: now.getTime() } });
  if (!row.matchedCount && (await newerRowScore(key, now))) throw fail(409, MSG.stateChanged, "state_changed");
  return { message: MSG.cleared, outcome: entry.outcome, score: null };
}

async function confirmedPresent(sessionId, residentId, now) {
  const resolved = await resolveSession(sessionId, { now, residentIds: [residentId] });
  if (resolved?.errors) throw new Error(`sessiya yechimi yiqildi session=${sessionId} resident=${residentId}`);
  const fresh = await liveEntry(sessionId, residentId);
  if (!fresh) throw fail(404, MSG.entryNotFound, "entry_not_found");
  if (fresh.outcome !== FRAME_PRESENT) {
    throw fail(409, MSG.notConfirmed, "not_confirmed", { outcome: fresh.outcome, outcomeReason: fresh.outcomeReason });
  }
  return fresh;
}

async function gradeEntry({ sessionId, residentId, score, user, now = new Date() }) {
  const entry = await loadGradable({ sessionId, residentId, user });
  if (score === null) return clearScore(entry, user, now);
  const fresh = await confirmedPresent(sessionId, residentId, now);
  const row = await Attendance.updateOne(
    { session: sessionId, resident: residentId, status: "present", deletedAt: null, ...rowScoreCas(now) },
    { $set: { score, scoreRev: now.getTime() } },
    { runValidators: true },
  );
  if (!row.matchedCount) throw fail(409, MSG.stateChanged, "state_changed");
  const framed = await Roster.updateOne(
    { _id: fresh._id, outcome: FRAME_PRESENT, ...LIVE_FRAME, ...frameScoreCas(now) },
    { $set: { score, scoredBy: user._id, scoredAt: now } },
    { runValidators: true },
  );
  if (!framed.matchedCount) throw fail(409, MSG.stateChanged, "state_changed");
  return { message: MSG.scored, outcome: FRAME_PRESENT, score };
}

const dayKey = (date) => date.toISOString().slice(0, 10);

async function countSessions(frames, residentId, today) {
  const sessions = { total: frames.length, present: 0, absent: 0, excused: 0, unmeasured: 0, pending: 0 };
  for (const f of frames) {
    const outcome = f.outcome === FRAME_PENDING && f.day < today ? FRAME_UNMEASURED : f.outcome;
    if (outcome in sessions) sessions[outcome] += 1;
  }
  const absentSessions = frames.filter((f) => f.outcome === FRAME_ABSENT).map((f) => f.session);
  if (absentSessions.length) {
    sessions.excused = await Attendance.countDocuments({ resident: residentId, session: { $in: absentSessions }, status: "excused" });
    sessions.absent -= sessions.excused;
  }
  return sessions;
}

async function attendanceContext(residentId, user, now = new Date()) {
  const { denied } = await buildResidentScope(user, residentId);
  if (denied) throw fail(403, MSG.outOfScope, "resident_out_of_scope");
  const resident = await Resident.findById(residentId)
    .select("status totalUnexcusedHours warningIssued expulsionOrderCreated")
    .lean();
  if (!resident) throw fail(404, MSG.residentNotFound, "resident_not_found");
  const { from, to } = currentAcademicYearWindow(now);
  const frames = await Roster.find({
    resident: residentId,
    day: { $gte: dayKey(from), $lte: dayKey(to) },
    ...LIVE_FRAME,
    outcome: { $ne: FRAME_VOID },
  })
    .select("session day outcome")
    .lean();
  const sessions = await countSessions(frames, residentId, todayUz(now));
  const measured = sessions.present + sessions.absent + sessions.excused;
  const denominator = sessions.total - sessions.pending;
  return {
    resident: {
      _id: resident._id,
      status: resident.status ?? null,
      totalUnexcusedHours: resident.totalUnexcusedHours ?? 0,
      warningIssued: resident.warningIssued === true,
      expulsionOrderCreated: resident.expulsionOrderCreated === true,
    },
    academicYear: currentAcademicYearTitle(now),
    sessions,
    coverage: { measured, ratio: denominator > 0 ? measured / denominator : null },
  };
}

module.exports = { gradeEntry, attendanceContext, MSG };
