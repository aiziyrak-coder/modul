"use strict";

const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { notifyUser, EVENTS, LINKS, expulsionOrderLink } = require("./residentNotify");
const { officeUserIds } = require("./officeRecipients");
const { countDecisionNotices, reminderRecipients, supersedeReminders } = require("./expulsionReversal");
const {
  findUndeliveredDecisions,
  markDecisionDelivered,
  findDueReminders,
  moveReminderStage,
  settleDraftNotices,
} = require("./expulsionOrderLifecycle");
const { markSignedBasisLost, isSignable } = require("./expulsionOrderDecision");
const { syncAbsenceNotices } = require("./autoAbsenceNotice");

async function fanOutToOffice(payload) {
  const recipients = await officeUserIds();
  await Promise.all(
    recipients.map((userId) =>
      notifyUser(userId, payload).catch((err) =>
        winston.error(
          `[4.5 expulsionCheck] Bo'lim bildirishnomasi yuborilmadi user=${userId} — ${err.message}`,
        ),
      ),
    ),
  );
}

const EVENT_OF = {
  signed: EVENTS.EXPULSION_SIGNED,
  rejected: EVENTS.EXPULSION_REJECTED,
  basisLost: EVENTS.EXPULSION_BASIS_LOST_OFFICE,
};

const PAYLOADS = {
  signed: (order) => ({
    title: "Chetlatish buyrug'i rasmiylashtirildi",
    body: `Sizni chetlatish to'g'risidagi buyruq № ${order.paperOrderNumber} (${order.paperOrderDate}) bo'lim tomonidan imzolandi va rasmiylashtirildi.`,
  }),
  rejected: () => ({
    title: "Chetlatish buyrug'i loyihasi rad etildi",
    body: "Sizga nisbatan shakllantirilgan chetlatish buyrug'i loyihasi bo'lim tomonidan rad etildi.",
  }),
  basisLost: (order) => ({
    title: "Imzolangan chetlatish: sababsiz soatlar 72 dan tushdi",
    body: `${order.residentName || "Rezident"} — imzolangan chetlatish buyrug'i № ${order.paperOrderNumber} asosidagi sababsiz soatlar ${order.hoursAtBasisLost} ga tushdi (imzoda ${order.hoursAtSign}). Rezident holati o'zgarmadi — qaror bo'limda.`,
    link: expulsionOrderLink(order._id),
  }),
};

async function recipientsOf(order, kind) {
  if (kind === "basisLost") return officeUserIds();
  const resident = await Resident.findOne({ _id: order.resident }).select("user").lean();
  return resident?.user ? [resident.user] : [];
}

async function dispatchInApp(recipients, payload, label, send = dispatch) {
  await Promise.all(
    recipients.map((userId) =>
      send({ ...payload, userId, overrideChannels: { inApp: true } }).catch((err) =>
        winston.warn(`[4.5 expulsionOrder] ${label} yuborilmadi user=${userId}: ${err.message}`),
      ),
    ),
  );
}

async function send(order, kind, recipients) {
  const payload = {
    eventType: EVENT_OF[kind],
    ...PAYLOADS[kind](order),
    metadata: { residentId: String(order.resident), orderId: String(order._id) },
  };
  await dispatchInApp(recipients, payload, "qaror xabari");
}

async function deliverDecision(order, kind) {
  const eventType = EVENT_OF[kind];
  if (!(await countDecisionNotices(order._id, eventType))) {
    const recipients = await recipientsOf(order, kind);
    if (!recipients.length && kind === "basisLost") return false;
    if (recipients.length) {
      await send(order, kind, recipients);
      if (!(await countDecisionNotices(order._id, eventType))) return false;
    }
  }
  await markDecisionDelivered(order._id, kind);
  return true;
}

function deliverDecisionInBackground(order, kind) {
  setImmediate(() => {
    deliverDecision(order, kind).catch((err) =>
      winston.error(`[4.5 expulsionOrder] qaror xabari (${kind}) order=${order._id}: ${err.message}`),
    );
  });
}

async function basisLostEffects({ residentId, source, countHours }) {
  try {
    const claim = await markSignedBasisLost({ residentId, source, countHours });
    return claim ? [{ kind: "basisLostNotice", order: claim.order }] : [];
  } catch (err) {
    winston.error(`[4.5 expulsionOrder] bo'lim xabari da'vosi yiqildi resident=${residentId}: ${err.message}`);
    return [];
  }
}

async function announceDecisionNotices(now = new Date()) {
  for (const { order, kind } of await findUndeliveredDecisions(now)) {
    try {
      await deliverDecision(order, kind);
    } catch (err) {
      winston.error(`[4.5 expulsionOrder] qaror xabari qayta e'lon qilinmadi order=${order._id}: ${err.message}`);
    }
  }
}

const reminderPayload = ({ order, stage, days, resident }) => ({
  eventType: EVENTS.EXPULSION_DRAFT_OFFICE,
  title: "Eslatma: chetlatish buyrug'i loyihasi qaror kutmoqda",
  body: `${resident?.fullName || order.residentName || "Rezident"} — chetlatish buyrug'i loyihasi ${days} kundan beri bo'lim qarorini (imzolash yoki rad etish) kutmoqda.`,
  link: LINKS.ATTENDANCE_OFFICE,
  metadata: { residentId: String(order.resident), orderId: String(order._id), reminderStage: stage },
});

async function actionable(due) {
  const residents = await Resident.find({ _id: { $in: due.map((d) => d.order.resident) } })
    .select("_id status active fullName")
    .lean();
  const byId = new Map(residents.map((r) => [String(r._id), r]));
  const ready = due
    .map((item) => ({ ...item, resident: byId.get(String(item.order.resident)) }))
    .filter((item) => isSignable(item.order, item.resident));
  if (ready.length < due.length) {
    winston.warn(`[4.5 expulsionOrder] eslatma: ${due.length - ready.length} ta loyiha o'tkazib yuborildi — bo'lim hozir qaror qila olmaydi`);
  }
  return ready;
}

async function sendStage(item, from, { recipients, send }) {
  const { order, stage } = item;
  await dispatchInApp(recipients, reminderPayload(item), "eslatma", send);
  const savedFor = await reminderRecipients(order._id, stage);
  if (!savedFor.length) {
    await moveReminderStage(order._id, stage, from);
    return false;
  }
  await supersedeReminders(order._id, stage, savedFor);
  return true;
}

async function remindOne(item, { recipients, send = dispatch }) {
  const { order, stage } = item;
  const from = order.remindedStage ?? null;
  if (!(await moveReminderStage(order._id, from, stage))) return false;
  try {
    return await sendStage(item, from, { recipients, send });
  } finally {
    await settleDraftNotices(order.resident, order._id);
  }
}

async function deliverReminders(items, ctx) {
  let sent = 0;
  for (const item of items) {
    try {
      if (await remindOne(item, ctx)) sent += 1;
    } catch (err) {
      winston.error(`[4.5 expulsionOrder] eslatma yuborilmadi order=${item.order._id}: ${err.message}`);
    }
  }
  return sent;
}

async function remindOpenDrafts(now = new Date(), { send = dispatch } = {}) {
  const due = await findDueReminders(now);
  const ready = due.length ? await actionable(due) : [];
  const recipients = ready.length ? await officeUserIds() : [];
  const sent = recipients.length ? await deliverReminders(ready, { recipients, send }) : 0;
  winston.info(`[4.5 expulsionOrder] eslatmalar: ${sent}/${ready.length} loyiha (muddati kelgan ${due.length})`);
  return sent;
}

async function announceOfficeFollowUps(remind, now = new Date()) {
  const failures = [];
  const failed = (label) => (err) => {
    winston.error(`[4.5 expulsionOrder] ${label} yiqildi: ${err.message}`);
    failures.push(err);
  };
  await announceDecisionNotices(now).catch(failed("qaror xabarlari"));
  if (remind) await remindOpenDrafts(now).catch(failed("loyiha eslatmalari"));
  if (remind) await syncAbsenceNotices(now).catch(failed("avtomatik bildirgilar"));
  if (failures.length) throw failures[0];
}

module.exports = {
  fanOutToOffice,
  deliverDecision,
  deliverDecisionInBackground,
  basisLostEffects,
  announceDecisionNotices,
  announceOfficeFollowUps,
  remindOpenDrafts,
  remindOne,
  DECISION_EVENTS: EVENT_OF,
};
