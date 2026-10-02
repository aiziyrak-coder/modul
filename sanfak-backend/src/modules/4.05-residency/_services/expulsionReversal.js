"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const Notification = require("#system/notification/notification.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { EXPULSION_HOURS } = require("./attendanceWarning");

const RESIDENT_EVENT_TYPE = "residency_expulsion";
const OFFICE_EVENT_TYPE = "residency_expulsion_draft_office";

function shouldCancelDraft(resident, hours) {
  if (!(hours < EXPULSION_HOURS)) return false;
  if (!resident?.expulsionOrderCreated) return false;
  if (resident.status === "chetlatilgan") return false;
  if (resident.active === false) return false;
  return true;
}

function signedBasisLost(resident, hours) {
  return resident?.status === "chetlatilgan" && hours < EXPULSION_HOURS;
}

async function revokeExpulsionNotice(residentId) {
  if (!residentId) return 0;
  const open = await Order.findOne({ resident: residentId, status: Order.ORDER_OPEN })
    .select("_id")
    .lean();
  const filter = {
    eventType: { $in: [RESIDENT_EVENT_TYPE, OFFICE_EVENT_TYPE] },
    "metadata.residentId": String(residentId),
    active: true,
  };
  if (open) filter["metadata.orderId"] = { $ne: String(open._id) };
  const res = await Notification.updateMany(filter, { active: false });
  return res.modifiedCount ?? 0;
}

async function revokeNoticesWithoutOpenDraft(startedAt = new Date()) {
  const base = {
    eventType: { $in: [RESIDENT_EVENT_TYPE, OFFICE_EVENT_TYPE] },
    active: true,
    createdAt: { $lt: startedAt },
  };
  const withNotices = (await Notification.distinct("metadata.residentId", base)).filter(
    (id) => mongoose.isValidObjectId(id),
  );
  if (!withNotices.length) return 0;
  const openOrders = await Order.find({
    status: Order.ORDER_OPEN,
    resident: { $in: withNotices },
  })
    .select("_id resident")
    .lean();
  const openByResident = new Map(openOrders.map((o) => [String(o.resident), String(o._id)]));
  const stale = withNotices.filter((id) => !openByResident.has(String(id)));
  const perOpen = [...openByResident].map(([residentId, orderId]) => ({
    "metadata.residentId": residentId,
    "metadata.orderId": { $exists: true, $ne: orderId },
  }));
  const or = [...perOpen, ...(stale.length ? [{ "metadata.residentId": { $in: stale } }] : [])];
  if (!or.length) return 0;
  const res = await Notification.updateMany({ ...base, $or: or }, { active: false });
  return res.modifiedCount ?? 0;
}

async function countOrderNotices(orderId) {
  return Notification.countDocuments({
    eventType: { $in: [RESIDENT_EVENT_TYPE, OFFICE_EVENT_TYPE] },
    "metadata.orderId": String(orderId),
  });
}

async function countDecisionNotices(orderId, eventType) {
  return Notification.countDocuments({ eventType, "metadata.orderId": String(orderId) });
}

async function reminderRecipients(orderId, stage) {
  return Notification.distinct("user", {
    eventType: OFFICE_EVENT_TYPE,
    "metadata.orderId": String(orderId),
    "metadata.reminderStage": stage,
  });
}

async function supersedeReminders(orderId, stage, userIds) {
  const res = await Notification.updateMany(
    {
      eventType: OFFICE_EVENT_TYPE,
      "metadata.orderId": String(orderId),
      "metadata.reminderStage": { $lt: stage },
      user: { $in: userIds },
      active: true,
    },
    { active: false },
  );
  return res.modifiedCount ?? 0;
}

async function revokeLegacyExpulsionNotice(userId) {
  if (!userId) return 0;
  const res = await Notification.updateMany(
    {
      eventType: RESIDENT_EVENT_TYPE,
      user: userId,
      "metadata.residentId": { $exists: false },
      active: true,
    },
    { active: false },
  );
  return res.modifiedCount ?? 0;
}

function revokeExpulsionNoticeInBackground(residentId) {
  setImmediate(() => {
    revokeExpulsionNotice(residentId).catch((err) =>
      winston.error(
        `[expulsionReversal] bekor qilish yiqildi (${residentId}): ${err.message}`,
      ),
    );
  });
}

module.exports = {
  RESIDENT_EVENT_TYPE,
  OFFICE_EVENT_TYPE,
  shouldCancelDraft,
  signedBasisLost,
  revokeExpulsionNotice,
  revokeExpulsionNoticeInBackground,
  revokeNoticesWithoutOpenDraft,
  revokeLegacyExpulsionNotice,
  countOrderNotices,
  countDecisionNotices,
  reminderRecipients,
  supersedeReminders,
};
