"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { EXPULSION_HOURS } = require("./attendanceWarning");
const { uzDayKey } = require("./uzDay");
const { MIN_DATE } = require("./dateBounds");
const { currentAcademicYearWindow, currentAcademicYearTitle } = require("./unexcusedWindow");
const {
  transitionOpenOrder,
  cancelDraftBelowThreshold,
  clearStalePointer,
  repairPointer,
  actorNameOf,
} = require("./expulsionOrderLifecycle");
const {
  revokeExpulsionNotice,
  revokeLegacyExpulsionNotice,
} = require("./expulsionReversal");

const { ORDER_OPEN, ORDER_SIGNED, ORDER_REJECTED } = Order;
const STATUS_EXPELLED = "chetlatilgan";
const MAX_HISTORY = 30;

const fail = (code, message, meta) => new ErrorHandler(code, message, meta.reason, meta);
const notOpen = (currentStatus) =>
  fail(409, "Buyruq endi loyiha emas — sahifani yangilang", {
    reason: "order_not_open",
    currentStatus: currentStatus ?? null,
  });

async function loadOrder(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw fail(404, "Buyruq topilmadi", { reason: "order_not_found" });
  return order;
}

async function loadResident(residentId) {
  const resident = await Resident.findOne({ _id: residentId })
    .select("status user active expulsionOrderCreated expulsionOrderCreatedAt")
    .lean();
  if (!resident) throw fail(404, "Rezident topilmadi", { reason: "resident_not_found" });
  return resident;
}

const currentStatusOf = async (orderId) =>
  (await Order.findById(orderId).select("status").lean())?.status;

async function lostSign(orderId) {
  const status = await currentStatusOf(orderId);
  if (status === ORDER_OPEN) {
    return fail(409, "Skan almashtirilgan — sahifani yangilang", { reason: "scan_changed" });
  }
  return notOpen(status);
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function assertPaperDate(order, paperOrderDate, now) {
  const min = order.origin === "tizim" ? uzDayKey(order.draftedAt) : uzDayKey(MIN_DATE);
  const max = uzDayKey(now);
  if (isRealDate(paperOrderDate) && paperOrderDate >= min && paperOrderDate <= max) return;
  throw fail(400, "Buyruq sanasi noto'g'ri: mavjud bo'lmagan, kelajakdagi yoki loyihadan oldingi sana", {
    reason: "paper_date_invalid",
    min,
    max,
  });
}

function assertScan(order, scanSha256) {
  if (!order.scan?.sha256) {
    throw fail(409, "Avval imzolangan buyruq skanini yuklang", { reason: "scan_missing" });
  }
  if (order.scan.sha256 !== scanSha256) {
    throw fail(409, "Skan almashtirilgan — sahifani yangilang", { reason: "scan_changed" });
  }
}

const signableStatus = (order, status) =>
  status === null ||
  status === "oquvda" ||
  (order.origin === "meros" && status === "akademik_tatil");

const isSignable = (order, resident) =>
  Boolean(resident) && signableStatus(order, resident.status ?? null) && resident.active !== false;

function assertSignable(order, resident) {
  const status = resident.status ?? null;
  if (!signableStatus(order, status)) {
    throw fail(409, "Rezident holati imzoga mos emas", {
      reason: "resident_not_signable",
      residentStatus: status,
    });
  }
  assertActive(resident);
}

function assertActive(resident) {
  if (resident.active === false) {
    throw fail(409, "Rezident nofaol — avval `migrate-45-expulsion-orders` yakunlansin", {
      reason: "resident_inactive",
    });
  }
}

function assertCounted(hours) {
  if (!Number.isFinite(hours)) {
    throw fail(500, "Sababsiz soatlar hisoblanmadi — qaror yozilmadi", { reason: "hours_unavailable" });
  }
}

async function assertStillAbove(order, resident, hours, now) {
  if (order.origin !== "tizim" || hours >= EXPULSION_HOURS) return;
  await cancelDraftBelowThreshold(resident, { hours, source: "office", now, awaitRevoke: true });
  throw fail(409, "Sababsiz soatlar 72 dan past — imzolab bo'lmaydi, loyiha bekor qilinadi", {
    reason: "hours_below_threshold",
    hours,
  });
}

const sameSignedPayload = (order, input) =>
  order.paperOrderNumber === input.paperOrderNumber &&
  order.paperOrderDate === input.paperOrderDate &&
  order.scan?.sha256 === input.scanSha256;

async function afterCommit(label, fn) {
  try {
    await fn();
  } catch (err) {
    winston.error(`[4.5 expulsionOrder] ${label}: ${err.message}`);
  }
}

const revokeDraftNotices = (order, resident) =>
  afterCommit(`loyiha xabarlari olinmadi order=${order._id}`, async () => {
    await revokeExpulsionNotice(resident._id);
    if (order.origin === "meros") await revokeLegacyExpulsionNotice(resident.user);
  });

async function applyToResident(order, resident, now) {
  const res = await Resident.updateOne(
    { _id: resident._id, status: { $ne: STATUS_EXPELLED } },
    { $set: { status: STATUS_EXPELLED, expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
  );
  const flipped = res.modifiedCount === 1;
  await Order.updateOne(
    { _id: order._id, status: ORDER_SIGNED, residentAppliedAt: null },
    { $set: { residentAppliedAt: now } },
  );
  await revokeDraftNotices(order, resident);
  return { order, flipped };
}

const signedFields = ({ input, eri, actor, hours, now }) => ({
  signedAt: now,
  signedBy: actor?._id ?? null,
  signedByName: actorNameOf(actor),
  hoursAtSign: hours,
  paperOrderNumber: input.paperOrderNumber,
  paperOrderDate: input.paperOrderDate,
  eriSerialNumber: eri?.serialNumber ?? null,
  eriSubject: eri?.cert?.subject ?? null,
  eriSignedAt: eri?.signedAt ?? null,
});

async function signOrder({ orderId, input, eri, actor, countHours, now = new Date() }) {
  const order = await loadOrder(orderId);
  let resident = await loadResident(order.resident);
  if (order.status === ORDER_SIGNED && sameSignedPayload(order, input)) {
    return applyToResident(order, resident, now);
  }
  if (order.status !== ORDER_OPEN) throw notOpen(order.status);
  assertPaperDate(order, input.paperOrderDate, now);
  assertScan(order, input.scanSha256);
  assertSignable(order, resident);
  if (resident.expulsionOrderCreated !== true) {
    await repairPointer(resident._id);
    resident = await loadResident(order.resident);
  }
  const hours = await countHours(resident._id);
  assertCounted(hours);
  await assertStillAbove(order, resident, hours, now);

  const signed = await transitionOpenOrder(
    { _id: order._id, "scan.sha256": input.scanSha256 },
    {
      status: ORDER_SIGNED,
      action: "imzolandi",
      set: signedFields({ input, eri, actor, hours, now }),
      source: "office",
      actor,
      hours,
      note: `${input.paperOrderNumber} / ${input.paperOrderDate}`,
      now,
    },
  );
  if (!signed) throw await lostSign(order._id);
  return applyToResident(signed, resident, now);
}

async function rejectOrder({ orderId, reason, actor, countHours, now = new Date() }) {
  const order = await loadOrder(orderId);
  if (order.status !== ORDER_OPEN) throw notOpen(order.status);
  const resident = await loadResident(order.resident);
  assertActive(resident);
  const hours = await countHours(resident._id);
  assertCounted(hours);

  const rejected = await transitionOpenOrder(
    { _id: order._id },
    {
      status: ORDER_REJECTED,
      action: "rad_etildi",
      set: {
        closedAt: now,
        closedBy: actor?._id ?? null,
        closedByName: actorNameOf(actor),
        closeReason: null,
        closeNote: reason,
        hoursAtClose: hours,
      },
      source: "office",
      actor,
      hours,
      note: reason,
      now,
    },
  );
  if (!rejected) throw notOpen(await currentStatusOf(order._id));
  await afterCommit(`bayroq tozalanmadi order=${order._id}`, () => clearStalePointer(resident._id));
  await revokeDraftNotices(rejected, resident);
  return { order: rejected };
}

async function attachScan({ orderId, scan, actor, now = new Date() }) {
  const actorId = actor?._id ?? null;
  const actorName = actorNameOf(actor);
  return Order.findOneAndUpdate(
    { _id: orderId, status: ORDER_OPEN, [`history.${MAX_HISTORY - 1}`]: { $exists: false } },
    {
      $set: { scan: { ...scan, uploadedBy: actorId, uploadedByName: actorName, uploadedAt: now } },
      $push: {
        history: {
          at: now,
          action: "skan_yuklandi",
          source: "office",
          actor: actorId,
          actorName,
          note: `sha256 ${scan.sha256}`,
        },
      },
    },
    { new: true },
  ).lean();
}

function assertScanAccepted(order) {
  if (order.status !== ORDER_OPEN) throw notOpen(order.status);
  if ((order.history?.length ?? 0) >= MAX_HISTORY) {
    throw fail(409, "Bu buyruqqa skan yuklash chegarasi tugagan", { reason: "scan_limit" });
  }
}

function assertNoScan(order) {
  if (order.scan) {
    throw fail(409, "Skan allaqachon yuklangan — yangi loyiha PDF'i yaratilmaydi", {
      reason: "scan_already_uploaded",
    });
  }
}

const pointsAtOrder = (resident, order) =>
  resident.expulsionOrderCreated === true &&
  resident.expulsionOrderCreatedAt instanceof Date &&
  order.draftedAt instanceof Date &&
  resident.expulsionOrderCreatedAt.getTime() === order.draftedAt.getTime();

function assertDraftPrintable(order, resident, now) {
  if (order.origin !== "tizim") {
    throw fail(409, "`meros` loyihaga tizim PDF'i yo'q — bo'lim o'z qog'ozini tayyorlaydi", {
      reason: "draft_pdf_not_available",
    });
  }
  assertNoScan(order);
  assertSignable(order, resident);
  if (!order.noticesSentAt || !pointsAtOrder(resident, order)) {
    throw fail(409, "Loyiha hali tayyor emas — birozdan keyin qayta urinib ko'ring", { reason: "draft_not_ready" });
  }
  const current = currentAcademicYearTitle(now);
  if (order.countingYear !== current) {
    throw fail(409, "Loyiha o'tgan o'quv yiliga tegishli — PDF yaratilmaydi", {
      reason: "draft_year_closed",
      countingYear: order.countingYear,
      current,
    });
  }
}

function assertDraftHours(hours) {
  assertCounted(hours);
  if (!(hours >= EXPULSION_HOURS)) {
    throw fail(409, "Sababsiz soatlar 72 dan past — loyiha PDF'i yaratilmaydi", {
      reason: "hours_below_threshold",
      hours,
    });
  }
}

async function attachDraftPdf({ orderId, draftPdf, actor, now = new Date() }) {
  const actorId = actor?._id ?? null;
  const actorName = actorNameOf(actor);
  return Order.findOneAndUpdate(
    { _id: orderId, status: ORDER_OPEN, draftPdf: null, scan: null },
    {
      $set: { draftPdf: { ...draftPdf, generatedBy: actorId, generatedByName: actorName, generatedAt: now } },
      $push: {
        history: {
          at: now,
          action: "pdf_yaratildi",
          source: "office",
          actor: actorId,
          actorName,
          hours: draftPdf.hours,
          note: `sha256 ${draftPdf.sha256}`,
        },
      },
    },
    { new: true },
  ).lean();
}

async function markSignedBasisLost({ residentId, source, countHours, now = new Date() }) {
  const claimable = {
    resident: residentId,
    status: ORDER_SIGNED,
    basisLostAt: null,
    hoursAtSign: { $gte: EXPULSION_HOURS },
    signedAt: { $gte: currentAcademicYearWindow(now).from },
  };
  if (!(await Order.exists(claimable))) return null;
  const hours = await countHours(residentId);
  if (!(hours < EXPULSION_HOURS)) return null;
  const order = await Order.findOneAndUpdate(
    claimable,
    {
      $set: { basisLostAt: now, hoursAtBasisLost: hours },
      $push: { history: { at: now, action: "asos_72_dan_past", source, hours } },
    },
    { new: true },
  ).lean();
  return order ? { order, hours } : null;
}

module.exports = {
  signOrder,
  rejectOrder,
  attachScan,
  attachDraftPdf,
  markSignedBasisLost,
  assertScanAccepted,
  assertDraftPrintable,
  assertDraftHours,
  assertNoScan,
  isSignable,
  MAX_HISTORY,
  _isRealDate: isRealDate,
};
