"use strict";

const { ErrorHandler } = require("#shared/error");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { closeOpenOrder, hasSignedOrder } = require("./expulsionOrderLifecycle");

const { STATUS_IN_STUDY } = Resident;
const { ORDER_OPEN, ORDER_SIGNED } = Order;
const STATUS_EXPELLED = "chetlatilgan";
const STATUS_LEAVE = "akademik_tatil";

const fail = (code, message, meta) => new ErrorHandler(code, message, meta.reason, meta);

async function assertNoOrderForLeave(residentId) {
  const order = await Order.findOne({
    resident: residentId,
    status: { $in: [ORDER_OPEN, ORDER_SIGNED] },
  })
    .select("_id")
    .lean();
  if (order) {
    throw fail(409, "Rezidentda chetlatish buyrug'i bor — avval bo'lim qaror qilsin", {
      reason: "expulsion_order_open",
      orderId: String(order._id),
    });
  }
}

async function casConflict(residentId, from, leave) {
  const now = leave
    ? await Resident.findOne({ _id: residentId }).select("status expulsionOrderCreated").lean()
    : null;
  if (now && (now.status ?? null) === from && now.expulsionOrderCreated === true) {
    return fail(409, "Rezidentda chetlatish buyrug'i loyihasi ochildi — avval bo'lim qaror qilsin", {
      reason: "expulsion_order_open",
    });
  }
  return fail(409, "Holat shu orada o'zgardi — sahifani yangilang", { reason: "status_conflict" });
}

async function changeableStatusOf(residentId) {
  const current = await Resident.findOne({ _id: residentId }).select("status").lean();
  if (!current) throw fail(404, "not found", { reason: "resident_not_found" });
  if (current.status === STATUS_EXPELLED) {
    throw fail(409, "Chetlatilgan rezidentning holati bu yo'l bilan o'zgartirilmaydi — chetlatish imzolangan buyruq bilan rasmiylashtirilgan", {
      reason: "resident_expelled",
    });
  }
  return current.status ?? null;
}

async function changeStudyStatus({ residentId, to }) {
  const from = await changeableStatusOf(residentId);
  if ((from ?? STATUS_IN_STUDY) === to) return { changed: false, from };

  const leave = to === STATUS_LEAVE;
  if (leave) await assertNoOrderForLeave(residentId);
  const doc = await Resident.findOneAndUpdate(
    { _id: residentId, status: from, ...(leave && { expulsionOrderCreated: { $ne: true } }) },
    { $set: { status: to } },
    { new: true, runValidators: true },
  );
  if (!doc) throw await casConflict(residentId, from, leave);
  return { changed: true, from, doc };
}

async function closeBeforeResidentDelete(residentId, actor, now = new Date()) {
  const current = await Resident.findOne({ _id: residentId }).select("status").lean();
  if (current?.status === STATUS_EXPELLED) {
    throw fail(409, "Chetlatilgan rezident o'chirilmaydi — chetlatish buyrug'i dalil sifatida ko'rinib turadi", {
      reason: "resident_expelled",
    });
  }
  await closeOpenOrder(
    { resident: residentId },
    { reason: "rezident_ochirildi", hours: null, source: "resident_delete", actor, now },
  );
  if (await hasSignedOrder(residentId)) {
    throw fail(409, "Rezidentning chetlatish buyrug'i imzolangan — o'chirib bo'lmaydi", {
      reason: "expulsion_order_signed",
    });
  }
}

module.exports = { changeStudyStatus, closeBeforeResidentDelete };
