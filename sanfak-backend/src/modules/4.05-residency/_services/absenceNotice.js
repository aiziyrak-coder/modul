"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const {
  dispatch,
} = require("#system/notification/notificationDispatcher");
const {
  countMissedDays,
  absenceWindow,
  windowRange,
  meetsThreshold,
} = require("./absenceStreak");
const { uzDayKey } = require("./uzDay");
const { officeUserIds } = require("./officeRecipients");
const noticeFiles = require("./noticeFiles");
const {
  buildAbsenceNoticePdf,
} = require("#modules/4.05-residency/_pdf/absenceNotice.pdf");

const WARNING_HOURS = 6;
const EXPULSION_HOURS = 72;

async function residentStreak(residentId, settings, now = new Date()) {
  const today = uzDayKey(now);
  const win = absenceWindow(today, settings?.absenceWindowDays);
  if (!win) return { streak: countMissedDays([], {}), rows: [] };

  const records = await mongoose
    .model("attendance")
    .find({ resident: residentId, active: true, date: windowRange(win) })
    .select("date status hours science scienceTitle lessonType")
    .populate({ path: "science", select: "title" })
    .sort({ date: 1 })
    .lean();

  const streak = countMissedDays(records, { today, windowDays: win.windowDays });
  if (streak.days === 0) return { streak, rows: [] };

  const inStreak = new Set(streak.dayKeys);
  const rows = records
    .filter((r) => r.status === "absent" && inStreak.has(uzDayKey(r.date)))
    .map((r) => ({
      day: uzDayKey(r.date),
      science: r.science?.title || r.scienceTitle || null,
      lessonType: r.lessonType || null,
      hours: r.hours ?? null,
    }));

  return { streak, rows };
}

function checkEligible(streak, settings) {
  const threshold = Number(settings?.absenceStreakDays);
  return {
    eligible: meetsThreshold(streak.days, threshold),
    threshold: Number.isFinite(threshold) ? threshold : null,
  };
}

function notEligibleMessage(streak, threshold) {
  if (!streak?.windowDays || !threshold) {
    return "Davomat bildirgisi hozir yuborib bo'lmaydi — sozlamani tekshiring";
  }
  return (
    `Davomat bildirgisi oxirgi ${streak.windowDays} kunda kamida ${threshold} kun ` +
    `sababsiz qoldirilganda yuboriladi (hozir: ${streak.days} kun)`
  );
}

async function lastDavomatNotice(residentId, windowFrom) {
  if (!windowFrom) return null;
  const doc = await mongoose
    .model("residencyNotice")
    .findOne({ resident: residentId, kind: "davomat", "absence.to": { $gte: windowFrom } })
    .sort({ createdAt: -1 })
    .select("createdAt absence")
    .lean();
  if (!doc?.absence) return null;
  return {
    id: String(doc._id),
    createdAt: doc.createdAt,
    days: doc.absence.days,
    from: doc.absence.from,
    to: doc.absence.to,
  };
}

async function buildDocument({ resident, supervisor, streak, rows, content }) {
  const buffer = await buildAbsenceNoticePdf({
    resident: {
      fullName: resident.fullName,
      program: resident.program,
      specialtyTitle: resident.specialtyTitle,
      departmentTitle: resident.departmentTitle,
      courseNumber: resident.courseNumber,
      groupTitle: resident.groupTitle,
    },
    supervisor,
    streak,
    rows,
    totals: {
      unexcusedHours: resident.totalUnexcusedHours ?? 0,
      warningHours: WARNING_HOURS,
      expulsionHours: EXPULSION_HOURS,
    },
    content,
    issuedAt: new Date(),
  });

  const stored = await noticeFiles.save(buffer);
  return {
    ...stored,
    fileName: `bildirgi-${uzDayKey(new Date())}.pdf`,
    generatedAt: new Date(),
  };
}

async function notifyOffice(notice, resident) {
  const recipients = await officeUserIds();
  const title = "Davomat bildirgisi";
  const a = notice.absence || {};
  const body =
    `${resident.fullName || "Rezident"} — ` +
    (a.windowDays ? `oxirgi ${a.windowDays} kunda ` : "") +
    `${a.days ?? 0} kun sababsiz qoldirdi`;

  await Promise.all(
    recipients.map((userId) =>
      dispatch({
        userId,
        eventType: "residency_absence_notice",
        title,
        body,
        link: `/residency/bildirgilar?notice=${notice._id}`,
      }).catch((err) => {
        winston.error(
          `[4.5] absenceNotice: bildirishnoma yuborilmadi user=${userId} — ${err.message}`,
        );
      }),
    ),
  );
  return recipients.length;
}

module.exports = {
  residentStreak,
  checkEligible,
  notEligibleMessage,
  lastDavomatNotice,
  buildDocument,
  notifyOffice,
  WARNING_HOURS,
  EXPULSION_HOURS,
};
