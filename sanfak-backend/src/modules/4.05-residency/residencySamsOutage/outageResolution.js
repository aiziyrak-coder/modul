"use strict";

const winston = require("#shared/winston.logger");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { sessionRowDate } = require("#modules/4.05-residency/_services/sessionResolver");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Outage = require("./residencySamsOutage.model");

const TAG = "[4.5 samsOutage]";
const MAX_ATTEMPTS = 5;
const RESUME_BATCH = 50;
const TOKEN_SELECT = "_id from to resolutionPendingSince resolutionAttempts";

const inFlight = new Set();

const isoDay = (date) => date.toISOString().slice(0, 10);
const later = (a, b) => (a > b ? a : b);
const earlier = (a, b) => (a < b ? a : b);
const keyOf = (doc) => `${doc._id}@${new Date(doc.resolutionPendingSince).getTime()}`;
const span = (days) => `${days[0]}..${days[days.length - 1]} (${days.length})`;

function resolutionDays({ from, to }, now = new Date()) {
  const year = currentAcademicYearWindow(now);
  const first = later(from, isoDay(year.from));
  const last = earlier(earlier(to, isoDay(year.to)), uzDayKey(now));
  const days = [];
  for (let d = first; d && d <= last; d = addDays(d, 1)) days.push(d);
  return days;
}

const settle = (doc) =>
  Outage.updateOne(
    { _id: doc._id, resolutionPendingSince: doc.resolutionPendingSince },
    { $set: { resolutionPendingSince: null } },
  );

async function recountWindow(doc, days) {
  try {
    const { runExpulsionCheck } = require("#modules/4.05-residency/_services/expulsionCheck");
    const { RECOUNT_SOURCE } = require("#modules/4.05-residency/_services/sessionResolution");
    const filter = { session: { $ne: null }, date: { $in: days.map(sessionRowDate) } };
    const ids = await Attendance.distinct("resident", filter, { includeDeleted: true });
    let failed = 0;
    for (const id of ids) {
      try {
        await runExpulsionCheck(id, { source: RECOUNT_SOURCE });
      } catch (err) {
        failed += 1;
        winston.error(`${TAG} qayta hisob yiqildi outage=${doc._id} resident=${id}: ${err.message}`);
      }
    }
    winston.info(`${TAG} qayta urinish qayta hisobi outage=${doc._id} days=${span(days)} residents=${ids.length} failed=${failed}`);
    return failed === 0;
  } catch (err) {
    winston.error(`${TAG} qayta urinish qayta hisobi yiqildi outage=${doc._id}: ${err.message}`);
    return false;
  }
}

async function finish(doc, key, days, ok) {
  try {
    const attempt = doc.resolutionAttempts ?? 1;
    if (ok && (attempt < 2 || (await recountWindow(doc, days)))) {
      await settle(doc);
      return;
    }
    const next = attempt >= MAX_ATTEMPTS ? "qayta urinilmaydi" : "monitor tiki qayta urinadi";
    winston.error(
      `${TAG} qayta yechim tugallanmadi outage=${doc._id} days=${span(days)} urinish=${attempt}/${MAX_ATTEMPTS} — ${next}`,
    );
  } finally {
    inFlight.delete(key);
  }
}

async function requestResolution(doc, now = new Date()) {
  try {
    const days = resolutionDays(doc, now);
    if (!days.length) {
      await settle(doc);
      return false;
    }
    const key = keyOf(doc);
    require("#modules/4.05-residency/_services/samsPresenceSync").scheduleSessionResolution({
      days,
      force: true,
      onDone: (ok) => finish(doc, key, days, ok),
    });
    inFlight.add(key);
    return true;
  } catch (err) {
    winston.error(`${TAG} qayta yechim rejalashtirilmadi outage=${doc?._id}: ${err.message}`);
    return false;
  }
}

async function resumePendingResolutions(now = new Date()) {
  const docs = await Outage.find({ resolutionPendingSince: { $ne: null }, resolutionAttempts: { $lt: MAX_ATTEMPTS } })
    .sort({ resolutionPendingSince: 1 })
    .limit(RESUME_BATCH)
    .select(TOKEN_SELECT)
    .lean();
  let resumed = 0;
  for (const doc of docs) {
    if (inFlight.has(keyOf(doc))) continue;
    const claimed = await Outage.findOneAndUpdate(
      { _id: doc._id, resolutionPendingSince: doc.resolutionPendingSince, resolutionAttempts: doc.resolutionAttempts },
      { $inc: { resolutionAttempts: 1 } },
      { new: true, projection: TOKEN_SELECT },
    ).lean();
    if (claimed && (await requestResolution(claimed, now))) resumed += 1;
  }
  if (resumed) winston.warn(`${TAG} qayta yechim qayta rejalashtirildi: outages=${resumed}`);
  return resumed;
}

module.exports = { resolutionDays, requestResolution, resumePendingResolutions, MAX_ATTEMPTS };
