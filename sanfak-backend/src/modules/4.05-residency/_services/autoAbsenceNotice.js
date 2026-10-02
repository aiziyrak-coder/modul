"use strict";

const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Notification = require("#system/notification/notification.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Notice = require("#modules/4.05-residency/residencyNotice/residencyNotice.model");
const { loadDraftResident, loadDraftRows, titleOf, toRow } = require("./expulsionDraftData");
const { currentAcademicYearTitle, currentAcademicYearWindow, sumUnexcusedHours } = require("./unexcusedWindow");
const { WARNING_HOURS } = require("./attendanceWarning");
const { officeUserIds } = require("./officeRecipients");
const noticeFiles = require("./noticeFiles");
const { uzDayKey } = require("./uzDay");
const {
  buildAutoAbsenceNoticePdf,
  TEMPLATE_VERSION,
  fmtHours,
} = require("#modules/4.05-residency/_pdf/autoAbsenceNotice.pdf");

const { STATUS_IN_STUDY } = Resident;
const { NOTICE_KIND_AUTO, AUTO_STATE_ACTIVE, AUTO_STATE_REVOKED, PROGRAMS } = Notice;

const LOG = "[4.5 autoAbsenceNotice]";
const AUTO_EVENT_TYPE = "residency_absence_notice_auto";
const AUTO_SENDER_NAME = "Tizim (avtomatik)";
const AUTO_TITLE = `Avtomatik bildirgi: sababsiz soatlar ostonasi (${WARNING_HOURS} soat)`;
const ALERT_TITLE = "Davomat bildirgisi (avtomatik)";

const noticeLink = (id) => `/residency/bildirgilar?notice=${id}`;

const accrues = (status) => status === undefined || status === null || status === STATUS_IN_STUDY;

const autoSentence = ({ fullName, year, hours }) =>
  `${fullName || "Rezident"} ${year} o'quv yilida jami ${fmtHours(hours)} soat mashg'ulotni sababsiz qoldirdi va ` +
  `${WARNING_HOURS} soatlik ostonaga yetdi (TZ 4.5.4). Bildirgi tizim tomonidan avtomatik shakllantirildi; ` +
  "qaror bo'lim zimmasida.";

const alertPayload = (notice, name) => ({
  eventType: AUTO_EVENT_TYPE,
  title: ALERT_TITLE,
  body:
    `${name || "Rezident"} — ${notice.auto.countingYear} o'quv yilida ${fmtHours(notice.auto.hoursAtIssue)} soat ` +
    "sababsiz dars qoldirdi. Tizim bildirgi shakllantirdi — ko'rib chiqing.",
  link: noticeLink(notice._id),
  metadata: { residentId: String(notice.resident), noticeId: String(notice._id) },
});

const liveScope = (year) => ({ kind: NOTICE_KIND_AUTO, "auto.state": AUTO_STATE_ACTIVE, "auto.countingYear": year });

const alertFilter = (noticeId) => ({ eventType: AUTO_EVENT_TYPE, "metadata.noticeId": String(noticeId) });
const countAlerts = (noticeId) => Notification.countDocuments(alertFilter(noticeId));
const revokeAlerts = (noticeId) =>
  Notification.updateMany({ ...alertFilter(noticeId), active: true }, { $set: { active: false } });

function eligible(r) {
  if (!r || r.active === false || !accrues(r.status)) return false;
  if (PROGRAMS.includes(r.program)) return true;
  winston.warn(`${LOG} resident=${r._id}: noma'lum dastur "${r.program}" — bildirgi yaratilmadi`);
  return false;
}

const toInput = ({ r, rows, hours, year, now }) => ({
  resident: {
    fullName: r.fullName || null,
    program: r.program,
    specialty: titleOf(r.specialty, r.specialtyTitle),
    department: titleOf(r.department, r.departmentTitle),
    course: r.courseNumber ?? null,
    group: titleOf(r.group, r.groupTitle),
  },
  countingYear: year,
  hours,
  rows: rows.map(toRow),
  sentence: autoSentence({ fullName: r.fullName, year, hours }),
  generatedAt: now,
});

async function createNotice({ r, input, stored, now }) {
  try {
    return await Notice.create({
      kind: NOTICE_KIND_AUTO,
      sender: null,
      senderName: AUTO_SENDER_NAME,
      resident: r._id,
      program: r.program,
      academicYear: input.countingYear,
      title: AUTO_TITLE,
      content: input.sentence,
      status: "yangi",
      document: { ...stored, fileName: `bildirgi-avtomatik-${uzDayKey(now)}.pdf`, generatedAt: now },
      auto: {
        countingYear: input.countingYear,
        state: AUTO_STATE_ACTIVE,
        hoursAtIssue: input.hours,
        templateVersion: TEMPLATE_VERSION,
        notifiedAt: null,
        revokedAt: null,
        hoursAtRevoke: null,
      },
    });
  } catch (err) {
    if (err?.code !== 11000) throw err;
    winston.info(`${LOG} resident=${r._id}: faol bildirgi parallel yaratilgan — fayl yetim qoldi ${stored.storageKey}`);
    return null;
  }
}

async function issueOne(residentId, { year, now }) {
  const r = await loadDraftResident(residentId);
  if (!eligible(r)) return null;
  const rows = await loadDraftRows(residentId, now);
  const hours = sumUnexcusedHours(rows);
  if (!(hours >= WARNING_HOURS)) return null;
  const input = toInput({ r, rows, hours, year, now });
  const stored = await noticeFiles.save(await buildAutoAbsenceNoticePdf(input));
  return createNotice({ r, input, stored, now });
}

async function issueDue(year, now) {
  const due = await Resident.find({
    active: true,
    status: { $in: [null, STATUS_IN_STUDY] },
    totalUnexcusedHours: { $gte: WARNING_HOURS },
  })
    .select("_id")
    .lean();
  if (!due.length) return 0;
  const held = new Set(
    (await Notice.distinct("resident", { ...liveScope(year), resident: { $in: due.map((r) => r._id) } })).map(String),
  );
  let issued = 0;
  for (const { _id } of due.filter((r) => !held.has(String(r._id)))) {
    try {
      if (await issueOne(_id, { year, now })) issued += 1;
    } catch (err) {
      winston.error(`${LOG} bildirgi yaratilmadi resident=${_id}: ${err.message}`);
    }
  }
  return issued;
}

async function revokeOne(notice, now) {
  const hours = sumUnexcusedHours(await loadDraftRows(notice.resident, now));
  if (!(hours < WARNING_HOURS)) return false;
  const res = await Notice.updateOne(
    { _id: notice._id, kind: NOTICE_KIND_AUTO, "auto.state": AUTO_STATE_ACTIVE },
    { $set: { "auto.state": AUTO_STATE_REVOKED, "auto.revokedAt": now, "auto.hoursAtRevoke": hours } },
  );
  if (!res.modifiedCount) return false;
  await revokeAlerts(notice._id).catch((err) =>
    winston.warn(`${LOG} notice=${notice._id} bekor qilindi, xabarlar hozir olinmadi (sweep oladi): ${err.message}`),
  );
  return true;
}

const recentYears = (now) => [
  currentAcademicYearTitle(new Date(currentAcademicYearWindow(now).from.getTime() - 1)),
  currentAcademicYearTitle(now),
];

async function withdrawRevokedAlerts(now) {
  const ids = await Notice.distinct("_id", {
    kind: NOTICE_KIND_AUTO,
    "auto.state": AUTO_STATE_REVOKED,
    "auto.countingYear": { $in: recentYears(now) },
  });
  if (!ids.length) return 0;
  const res = await Notification.updateMany(
    { eventType: AUTO_EVENT_TYPE, "metadata.noticeId": { $in: ids.map(String) }, active: true },
    { $set: { active: false } },
  );
  const withdrawn = res?.modifiedCount || 0;
  if (withdrawn) winston.warn(`${LOG} bekor qilingan bildirgilarning qolib ketgan ${withdrawn} ta xabari olindi`);
  return withdrawn;
}

async function revokeStale(year, now) {
  const open = await Notice.find(liveScope(year)).select("_id resident").lean();
  if (!open.length) return 0;
  const low = await Resident.find({
    _id: { $in: open.map((n) => n.resident) },
    active: true,
    totalUnexcusedHours: { $lt: WARNING_HOURS },
  })
    .select("_id")
    .lean();
  const lowIds = new Set(low.map((r) => String(r._id)));
  let revoked = 0;
  for (const notice of open.filter((n) => lowIds.has(String(n.resident)))) {
    try {
      if (await revokeOne(notice, now)) revoked += 1;
    } catch (err) {
      winston.error(`${LOG} bildirgi bekor qilinmadi notice=${notice._id}: ${err.message}`);
    }
  }
  return revoked;
}

async function sendAlerts(notice, { recipients, send, name }) {
  const payload = alertPayload(notice, name);
  await Promise.all(
    recipients.map((userId) =>
      send({ ...payload, userId, overrideChannels: { inApp: true } }).catch((err) =>
        winston.warn(`${LOG} xabar yuborilmadi user=${userId} notice=${notice._id}: ${err.message}`),
      ),
    ),
  );
}

async function settleAlerts(noticeId) {
  if (!(await Notice.exists({ _id: noticeId, "auto.state": AUTO_STATE_ACTIVE }))) await revokeAlerts(noticeId);
}

async function announceOne(notice, { recipients, send = dispatch, now, name }) {
  const claim = await Notice.updateOne(
    { _id: notice._id, "auto.state": AUTO_STATE_ACTIVE, "auto.notifiedAt": null },
    { $set: { "auto.notifiedAt": now } },
  );
  if (!claim.modifiedCount) return false;
  try {
    await sendAlerts(notice, { recipients, send, name });
    if (await countAlerts(notice._id)) return true;
    await Notice.updateOne({ _id: notice._id, "auto.notifiedAt": now }, { $set: { "auto.notifiedAt": null } });
    return false;
  } finally {
    await settleAlerts(notice._id);
  }
}

async function announcePending(year, now, { send = dispatch } = {}) {
  const pending = await Notice.find({ ...liveScope(year), "auto.notifiedAt": null }).select("_id resident auto").lean();
  if (!pending.length) return 0;
  const recipients = await officeUserIds();
  if (!recipients.length) return 0;
  const residents = await Resident.find({ _id: { $in: pending.map((n) => n.resident) } })
    .select("fullName")
    .lean();
  const names = new Map(residents.map((r) => [String(r._id), r.fullName]));
  let announced = 0;
  for (const notice of pending) {
    try {
      const name = names.get(String(notice.resident));
      if (await announceOne(notice, { recipients, send, now, name })) announced += 1;
    } catch (err) {
      winston.error(`${LOG} bildirgi e'lon qilinmadi notice=${notice._id}: ${err.message}`);
    }
  }
  return announced;
}

async function syncAbsenceNotices(now = new Date(), { send = dispatch } = {}) {
  const year = currentAcademicYearTitle(now);
  const revoked = await revokeStale(year, now);
  await withdrawRevokedAlerts(now);
  const issued = await issueDue(year, now);
  const announced = await announcePending(year, now, { send });
  winston.info(`${LOG} avtomatik bildirgilar: yangi ${issued}, bekor ${revoked}, e'lon ${announced}`);
  return { issued, revoked, announced };
}

module.exports = {
  syncAbsenceNotices,
  issueOne,
  issueDue,
  revokeStale,
  revokeOne,
  withdrawRevokedAlerts,
  announcePending,
  announceOne,
  accrues,
  autoSentence,
  alertPayload,
  AUTO_EVENT_TYPE,
  AUTO_SENDER_NAME,
  AUTO_TITLE,
};
