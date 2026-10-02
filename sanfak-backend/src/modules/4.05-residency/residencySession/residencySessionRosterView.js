"use strict";

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { FRAME_PRESENT, FRAME_ABSENT } = require("./residencySessionRoster.model");

async function rowStatuses(frames) {
  const ids = frames.map((f) => f.attendance).filter(Boolean);
  if (!ids.length) return new Map();
  const rows = await Attendance.find({ _id: { $in: ids } }).select("status").lean();
  return new Map(rows.map((r) => [String(r._id), r.status]));
}

const {
  UNGRADED_LESSON_TYPES,
  LESSON_TYPE_NOT_GRADED,
  isGradedLessonType,
} = require("#modules/4.05-residency/_services/lessonTypeGrading");

function scoreBlockedReason(frame, rowStatus, lessonType) {
  if (!isGradedLessonType(lessonType)) return LESSON_TYPE_NOT_GRADED;
  if (frame.outcome !== FRAME_PRESENT) return "not_confirmed";
  return rowStatus === "present" ? null : "row_missing";
}

function rosterEvidence(frame, rowStatus, lessonType) {
  return {
    state: frame.outcome === FRAME_ABSENT && rowStatus === "excused" ? "excused" : frame.outcome,
    score: frame.outcome === FRAME_PRESENT ? frame.score ?? null : null,
    checkInTime: frame.samsFirstIn ?? null,
    checkOutTime: frame.samsLastOut ?? null,
    scoreBlockedReason: scoreBlockedReason(frame, rowStatus, lessonType),
  };
}

module.exports = { rowStatuses, rosterEvidence, isGradedLessonType, LESSON_TYPE_NOT_GRADED, UNGRADED_LESSON_TYPES };
