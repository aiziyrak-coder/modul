"use strict";

const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { currentAcademicYearTitle } = require("./unexcusedWindow");
const { uzDaysBetween } = require("./uzDay");

const { ORDER_OPEN, ORDER_SIGNED, ORDER_REJECTED } = Order;
const ANNOUNCE_GRACE_MS = 10 * 60 * 1000;
const FIRST_REMINDER_DAY = 3;
const REMINDER_EVERY_DAYS = 7;

const hasSignedOrder = (residentId) =>
  Order.exists({ resident: residentId, status: ORDER_SIGNED });

function watermarkApplies(last, hours, now) {
  if (!(last?.closedAt instanceof Date)) return false;
  if (currentAcademicYearTitle(last.closedAt) !== currentAcademicYearTitle(now)) return false;
  return !(hours > last.hoursAtClose);
}

const lastRejected = (residentId) =>
  Order.findOne({ resident: residentId, status: ORDER_REJECTED })
    .sort({ createdAt: -1 })
    .select("closedAt hoursAtClose")
    .lean();

async function rejectWatermarkBlocks(residentId, hours, now) {
  return watermarkApplies(await lastRejected(residentId), hours, now);
}

const isDraftOpen = (orderId) => Order.exists({ _id: orderId, status: ORDER_OPEN });

const DECISIONS = {
  signed: { status: ORDER_SIGNED, at: "residentAppliedAt" },
  rejected: { status: ORDER_REJECTED, at: "closedAt" },
  basisLost: { status: ORDER_SIGNED, at: "basisLostAt" },
};

const isDue = (order, kind, before) => {
  const { status, at } = DECISIONS[kind];
  return (
    order.status === status &&
    (order.deliveries?.[kind] ?? null) === null &&
    order[at] instanceof Date &&
    order[at] < before
  );
};

async function findUndeliveredDecisions(now = new Date()) {
  const before = new Date(now.getTime() - ANNOUNCE_GRACE_MS);
  const kinds = Object.keys(DECISIONS);
  const orders = await Order.find({
    $or: kinds.map((kind) => ({
      status: DECISIONS[kind].status,
      [`deliveries.${kind}`]: null,
      [DECISIONS[kind].at]: { $ne: null, $lt: before },
    })),
  })
    .select(
      "_id resident residentName status paperOrderNumber paperOrderDate hoursAtSign hoursAtBasisLost residentAppliedAt closedAt basisLostAt deliveries",
    )
    .lean();
  return orders.flatMap((order) =>
    kinds.filter((kind) => isDue(order, kind, before)).map((kind) => ({ order, kind })),
  );
}

function dueReminderStage(createdAt, now) {
  const d = uzDaysBetween(createdAt, now);
  if (!(d >= FIRST_REMINDER_DAY)) return 0;
  return d < REMINDER_EVERY_DAYS ? 1 : 1 + Math.floor(d / REMINDER_EVERY_DAYS);
}

const announcedToday = (order, now) =>
  order.noticesSentAt != null && !(uzDaysBetween(order.noticesSentAt, now) >= 1);

async function findDueReminders(now = new Date()) {
  const open = await Order.find({
    status: ORDER_OPEN,
    $or: [{ origin: "meros" }, { noticesSentAt: { $ne: null } }],
  })
    .select("_id resident residentName origin createdAt noticesSentAt remindedStage")
    .lean();
  return open
    .map((order) => ({
      order,
      stage: dueReminderStage(order.createdAt, now),
      days: uzDaysBetween(order.createdAt, now),
    }))
    .filter(({ order, stage }) => stage > (order.remindedStage ?? 0) && !announcedToday(order, now));
}

module.exports = {
  hasSignedOrder,
  watermarkApplies,
  lastRejected,
  rejectWatermarkBlocks,
  isDraftOpen,
  findUndeliveredDecisions,
  dueReminderStage,
  findDueReminders,
  ANNOUNCE_GRACE_MS,
};
