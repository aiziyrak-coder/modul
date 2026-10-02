const { ErrorHandler } = require("#shared/error");
const QualContract = require("#modules/4.04-qualification/qualContract/qualContract.model");
const QualPayment = require("#modules/4.04-qualification/qualPayment/qualPayment.model");
const QualCourseSubscription = require("#modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");

const REQUIRED_SHARE = 0.5;
const WORKING_DAYS = 10;

const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;

function addWorkingDays(from, days) {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) left -= 1;
  }
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function paymentStatus(listenerId, courseId, now = new Date()) {
  const free = {
    required: false,
    locked: false,
    dueAt: null,
    totalPrice: 0,
    paidAmount: 0,
    requiredAmount: 0,
    educationType: 1,
  };
  if (!listenerId || !courseId) return free;

  const [sub, contract] = await Promise.all([
    QualCourseSubscription.findOne({ course: courseId, listener: listenerId })
      .select("educationType")
      .lean(),
    QualContract.findOne({ course: courseId, listener: listenerId })
      .select("totalPrice createdAt petition")
      .populate({ path: "petition", select: "acceptedAt" })
      .lean(),
  ]);

  if (sub && sub.educationType === 1) return free;
  if (!contract) return free;

  const payments = await QualPayment.find({ contract: contract._id })
    .select("price status")
    .lean();
  const paidAmount = payments
    .filter((p) => p.status === 2)
    .reduce((sum, p) => sum + (p.price || 0), 0);

  const totalPrice = contract.totalPrice || 0;
  const requiredAmount = Math.ceil(totalPrice * REQUIRED_SHARE);
  const acceptedAt =
    (contract.petition && contract.petition.acceptedAt) || contract.createdAt;
  const dueAt = endOfDay(addWorkingDays(acceptedAt, WORKING_DAYS));

  return {
    required: true,
    locked: now > dueAt && paidAmount < requiredAmount,
    dueAt,
    totalPrice,
    paidAmount,
    requiredAmount,
    educationType: (sub && sub.educationType) || 2,
  };
}

const LOCK_MESSAGE =
  "To'lov muddati o'tdi: shartnoma summasining 50% i to'lanmagan. " +
  "Kurs materiallari to'lov amalga oshirilgach ochiladi.";

async function assertNotLocked(listenerId, courseId, now = new Date()) {
  const status = await paymentStatus(listenerId, courseId, now);
  if (status.locked) throw new ErrorHandler(402, LOCK_MESSAGE);
  return status;
}

module.exports = {
  paymentStatus,
  assertNotLocked,
  addWorkingDays,
  endOfDay,
  REQUIRED_SHARE,
  WORKING_DAYS,
  LOCK_MESSAGE,
};
