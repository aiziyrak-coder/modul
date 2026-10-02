"use strict";

const winston = require("#shared/winston.logger");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { EXPULSION_HOURS } = require("./attendanceWarning");
const { currentAcademicYearTitle } = require("./unexcusedWindow");
const {
  hasSignedOrder,
  watermarkApplies,
  lastRejected,
  rejectWatermarkBlocks,
  isDraftOpen,
  findUndeliveredDecisions,
  findDueReminders,
  ANNOUNCE_GRACE_MS,
} = require("./expulsionOrderQueries");
const {
  revokeExpulsionNotice,
  revokeExpulsionNoticeInBackground,
  revokeNoticesWithoutOpenDraft,
  countOrderNotices,
} = require("./expulsionReversal");

const { STATUS_IN_STUDY } = Resident;
const { ORDER_OPEN, ORDER_SIGNED } = Order;
const DUPLICATE_KEY = 11000;

const canHoldDraft = (status) =>
  status === undefined || status === null || status === STATUS_IN_STUDY;

const isEligible = (live) =>
  Boolean(live) && live.active !== false && canHoldDraft(live.status);

const readLive = (residentId) =>
  Resident.findOne({ _id: residentId }).select("status active").lean();

const actorNameOf = (user) =>
  user
    ? [user.lastName, user.firstName].filter(Boolean).join(" ") || null
    : null;

async function rollbackOwnOrder(orderId) {
  await Order.deleteOne({ _id: orderId, status: ORDER_OPEN, "history.1": { $exists: false } });
}

const sameInstant = (a, b) =>
  a instanceof Date && b instanceof Date && a.getTime() === b.getTime();

const CLEAR_FLAG = { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } };
const REPAIR_ATTEMPTS = 3;

const clearPointerIfAt = (residentId, at) =>
  Resident.updateOne(
    { _id: residentId, expulsionOrderCreated: true, expulsionOrderCreatedAt: at },
    CLEAR_FLAG,
  );

async function clearStalePointer(residentId) {
  const live = await Resident.findOne({ _id: residentId })
    .select("expulsionOrderCreated expulsionOrderCreatedAt")
    .lean();
  if (live?.expulsionOrderCreated !== true) return;
  const held = await Order.exists({
    resident: residentId,
    status: { $in: [ORDER_OPEN, ORDER_SIGNED] },
  });
  if (held) return;
  await clearPointerIfAt(residentId, live.expulsionOrderCreatedAt ?? null);
}

async function decisionBlocks(residentId, hours, now) {
  if (await hasSignedOrder(residentId)) return "signed_order";
  if (await rejectWatermarkBlocks(residentId, hours, now)) return "reject_watermark";
  return null;
}

async function postCreateCheck(residentId, countHours, now) {
  const fresh = await countHours(residentId);
  if (!(fresh >= EXPULSION_HOURS)) return { blocked: "below_threshold", fresh };
  return { blocked: await decisionBlocks(residentId, fresh, now), fresh };
}

async function abandonOwnOrder(residentId, orderId, draftedAt) {
  await rollbackOwnOrder(orderId);
  await clearPointerIfAt(residentId, draftedAt);
}

async function repairPointer(residentId) {
  for (let attempt = 0; attempt < REPAIR_ATTEMPTS; attempt += 1) {
    const open = await Order.findOne({ resident: residentId, status: ORDER_OPEN })
      .select("_id draftedAt")
      .lean();
    if (!open) return;
    if (await hasSignedOrder(residentId)) return;
    const res = await Resident.updateOne(
      {
        _id: residentId,
        $or: [
          { expulsionOrderCreated: { $ne: true } },
          { expulsionOrderCreatedAt: { $ne: open.draftedAt } },
        ],
      },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: open.draftedAt } },
    );
    if (!res.modifiedCount) return;
    if (await Order.exists({ _id: open._id, status: ORDER_OPEN })) return;
    if (await hasSignedOrder(residentId)) return;
    await clearPointerIfAt(residentId, open.draftedAt);
  }
}

async function draftPrecheck(residentId, countHours, now) {
  if (!isEligible(await readLive(residentId))) return { reason: "not_eligible" };
  if (await hasSignedOrder(residentId)) return { reason: "signed_order" };

  const hours = await countHours(residentId);
  if (!(hours >= EXPULSION_HOURS)) return { reason: "below_threshold" };

  if (await rejectWatermarkBlocks(residentId, hours, now)) {
    await clearStalePointer(residentId);
    return { reason: "reject_watermark" };
  }
  return { hours };
}

async function claimOpenedDraft(residentId, orderId, { countHours, now }) {
  const { blocked, fresh } = await postCreateCheck(residentId, countHours, now);
  if (Number.isFinite(fresh)) {
    await Order.updateOne({ _id: orderId, status: ORDER_OPEN }, { $set: { hoursAtDraft: fresh } });
  }
  if (blocked) {
    await abandonOwnOrder(residentId, orderId, now);
    return { reason: blocked };
  }
  const pointed = await Resident.updateOne(
    {
      _id: residentId,
      deletedAt: null,
      active: { $ne: false },
      status: { $in: [STATUS_IN_STUDY, null] },
    },
    { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: now } },
  );
  if (pointed.matchedCount !== 1) {
    await abandonOwnOrder(residentId, orderId, now);
    return { reason: "not_eligible" };
  }
  return { hours: fresh };
}

async function openDraft({ residentId, residentName, source, countHours, now = new Date() }) {
  const pre = await draftPrecheck(residentId, countHours, now);
  if (pre.reason) return { opened: false, reason: pre.reason };
  const { hours } = pre;

  let order;
  try {
    order = await Order.create({
      resident: residentId,
      residentName,
      origin: "tizim",
      status: ORDER_OPEN,
      countingYear: currentAcademicYearTitle(now),
      draftedAt: now,
      hoursAtDraft: hours,
      history: [{ at: now, action: "yaratildi", source, hours }],
    });
  } catch (err) {
    if (err?.code !== DUPLICATE_KEY) throw err;
    await repairPointer(residentId);
    return { opened: false, reason: "already_open" };
  }

  try {
    const claimed = await claimOpenedDraft(residentId, order._id, { countHours, now });
    if (claimed.reason) return { opened: false, reason: claimed.reason };
    return { opened: true, orderId: order._id, hours: claimed.hours };
  } catch (err) {
    await abandonOwnOrder(residentId, order._id, now).catch((rbErr) =>
      winston.error(
        `[4.5 expulsionOrder] yarimta loyiha qaytarilmadi order=${order._id}: ${rbErr.message}`,
      ),
    );
    throw err;
  }
}

async function transitionOpenOrder(filter, change) {
  const { status, action, set = {}, source, actor, hours = null, note = null, now } = change;
  const actorId = actor?._id ?? null;
  return Order.findOneAndUpdate(
    { ...filter, status: ORDER_OPEN },
    {
      $set: { status, ...set },
      $push: {
        history: { at: now, action, source, actor: actorId, actorName: actorNameOf(actor), hours, note },
      },
    },
    { new: true, ...(change.projection && { projection: change.projection }) },
  ).lean();
}

async function closeOpenOrder(filter, { reason, hours, source, actor, now }) {
  return transitionOpenOrder(filter, {
    status: "bekor_qilingan",
    action: "bekor_qilindi",
    set: {
      closedAt: now,
      closedBy: actor?._id ?? null,
      closedByName: actorNameOf(actor),
      closeReason: reason,
      hoursAtClose: hours,
    },
    source,
    actor,
    hours,
    note: reason,
    now,
    projection: { _id: 1 },
  });
}

async function orderToClose(residentId, pointer) {
  const open = await Order.findOne({ resident: residentId, status: ORDER_OPEN })
    .select("_id origin countingYear draftedAt")
    .lean();
  if (!open) return null;
  if (open.origin === "meros" || !sameInstant(open.draftedAt, pointer)) return false;
  return open;
}

const closeReasonFor = (order, now) =>
  order.countingYear === currentAcademicYearTitle(now) ? "soat_72_dan_past" : "yangi_oquv_yili";

async function closeSnapshotOrder(residentId, pointer, { hours, source, now }) {
  const open = await orderToClose(residentId, pointer);
  if (open === false) return false;
  if (!open) return !(await hasSignedOrder(residentId));
  const reason = closeReasonFor(open, now);
  const closed = await closeOpenOrder(
    { _id: open._id },
    { reason, hours, source, actor: null, now },
  );
  return Boolean(closed);
}

async function cancelDraftBelowThreshold(resident, opts) {
  const { hours, source, now = new Date(), awaitRevoke = false } = opts;
  const residentId = resident._id;
  const pointer = resident.expulsionOrderCreatedAt ?? null;
  try {
    if (!(await closeSnapshotOrder(residentId, pointer, { hours, source, now }))) return;
    await Resident.updateOne(
      { _id: residentId, expulsionOrderCreated: true, expulsionOrderCreatedAt: pointer },
      CLEAR_FLAG,
    );
    await revoke(residentId, awaitRevoke);
  } catch (err) {
    winston.error(
      `[4.5 expulsionOrder] loyiha yopilmadi resident=${residentId}: ${err.message}`,
    );
  }
}

async function revoke(residentId, awaitRevoke) {
  if (awaitRevoke) await revokeExpulsionNotice(residentId);
  else revokeExpulsionNoticeInBackground(residentId);
}

async function settleDraftNotices(residentId, orderId) {
  if (await Order.exists({ _id: orderId, status: ORDER_OPEN })) return;
  await revokeExpulsionNotice(residentId);
}

async function markNoticesSent(orderId, now = new Date()) {
  if (!(await countOrderNotices(orderId))) return false;
  await Order.updateOne({ _id: orderId, noticesSentAt: null }, { $set: { noticesSentAt: now } });
  return true;
}

async function findUnannouncedDrafts(now = new Date()) {
  return Order.find({
    status: ORDER_OPEN,
    origin: "tizim",
    noticesSentAt: null,
    draftedAt: { $lt: new Date(now.getTime() - ANNOUNCE_GRACE_MS) },
  })
    .select("_id resident hoursAtDraft")
    .lean();
}

async function closeDraftForDeletedResident(
  residentId,
  actor,
  { now = new Date(), source = "resident_delete", awaitRevoke = false } = {},
) {
  try {
    await closeOpenOrder(
      { resident: residentId },
      { reason: "rezident_ochirildi", hours: null, source, actor, now },
    );
    await Resident.updateOne({ _id: residentId }, CLEAR_FLAG);
    await revoke(residentId, awaitRevoke);
  } catch (err) {
    winston.error(
      `[4.5 expulsionOrder] o'chirilgan rezident loyihasi yopilmadi resident=${residentId}: ${err.message}`,
    );
  }
}

async function reconcileDrafts(now = new Date()) {
  const open = await Order.find({ status: ORDER_OPEN })
    .select("_id resident origin draftedAt hoursAtDraft noticesSentAt")
    .lean();
  for (const o of open) {
    try {
      await reconcileOpenOrder(o, now);
    } catch (err) {
      winston.error(
        `[4.5 expulsionOrder] yarashtirish yiqildi order=${o._id}: ${err.message}`,
      );
    }
  }
  await detectHalfSigned(now).catch((err) =>
    winston.error(`[4.5 expulsionOrder] yarim imzo tekshiruvi yiqildi: ${err.message}`),
  );
  await revokeNoticesWithoutOpenDraft(now).catch((err) =>
    winston.error(`[4.5 expulsionOrder] eskirgan xabarlar olinmadi: ${err.message}`),
  );
  return now;
}

async function reconcileOpenOrder(o, now) {
  if (await hasSignedOrder(o.resident)) {
    await closeOpenOrder(
      { _id: o._id },
      { reason: "imzolangan_buyruq_bor", hours: null, source: "cron", actor: null, now },
    );
    return;
  }
  const live = await Resident.findOne({ _id: o.resident }).select("_id status active").lean();
  if (!live) {
    await closeDraftForDeletedResident(o.resident, null, { now, source: "cron", awaitRevoke: true });
    return;
  }
  if (await isRefusedStray(o, live, now)) {
    await closeOpenOrder(
      { _id: o._id },
      { reason: "yaroqsiz_loyiha", hours: null, source: "cron", actor: null, now },
    );
    await clearPointerIfAt(o.resident, o.draftedAt);
    return;
  }
  await repairPointer(o.resident);
}

async function isRefusedStray(o, live, now) {
  if (o.origin !== "tizim" || o.noticesSentAt) return false;
  if (!(o.draftedAt < new Date(now.getTime() - ANNOUNCE_GRACE_MS))) return false;
  if (!isEligible(live)) return true;
  return watermarkApplies(await lastRejected(o.resident), o.hoursAtDraft, o.draftedAt);
}

async function detectHalfSigned(now) {
  const stuck = await Order.find({
    status: ORDER_SIGNED,
    residentAppliedAt: null,
    signedAt: { $lt: new Date(now.getTime() - ANNOUNCE_GRACE_MS) },
  })
    .select("_id resident draftedAt")
    .lean();
  for (const o of stuck) {
    const r = await Resident.findOneWithDeleted({ _id: o.resident }).select("status").lean();
    if (r?.status === "chetlatilgan") {
      await Order.updateOne(
        { _id: o._id, status: ORDER_SIGNED, residentAppliedAt: null },
        { $set: { residentAppliedAt: now } },
      );
    } else {
      await Resident.updateOne(
        { _id: o.resident, status: { $ne: "chetlatilgan" }, expulsionOrderCreated: { $ne: true } },
        { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: o.draftedAt } },
      );
      winston.error(
        `[4.5 expulsionOrder] imzo YARIM qolgan order=${o._id} resident=${o.resident} — bo'lim imzo so'rovini qayta yuborishi kerak`,
      );
    }
  }
}

const moveReminderStage = async (orderId, from, to) =>
  (
    await Order.updateOne(
      { _id: orderId, status: ORDER_OPEN, remindedStage: from ?? null },
      { $set: { remindedStage: to } },
    )
  ).modifiedCount === 1;

const markDecisionDelivered = (orderId, kind, now = new Date()) =>
  Order.updateOne(
    { _id: orderId, [`deliveries.${kind}`]: null },
    { $set: { [`deliveries.${kind}`]: now } },
  );

module.exports = {
  openDraft,
  cancelDraftBelowThreshold,
  closeDraftForDeletedResident,
  settleDraftNotices,
  markNoticesSent,
  findUnannouncedDrafts,
  isDraftOpen,
  findUndeliveredDecisions,
  findDueReminders,
  moveReminderStage,
  markDecisionDelivered,
  reconcileDrafts,
  canHoldDraft,
  isEligible,
  hasSignedOrder,
  watermarkApplies,
  clearStalePointer,
  transitionOpenOrder,
  closeOpenOrder,
  repairPointer,
  actorNameOf,
};
