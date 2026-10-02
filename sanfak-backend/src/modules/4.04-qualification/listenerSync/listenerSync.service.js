const { ErrorHandler } = require("#shared/error");
const QualTopicModel = require("#modules/4.04-qualification/qualTopic/qualTopic.model");
const QualTopicCompletionModel = require("#modules/4.04-qualification/qualTopicCompletion/qualTopicCompletion.model");
const QualFinalTestResultModel = require("#modules/4.04-qualification/qualFinalTestResult/qualFinalTestResult.model");
const QualAccessTestResultModel = require("#modules/4.04-qualification/qualAccessTestResult/qualAccessTestResult.model");
const QualTestConfig = require("#modules/4.04-qualification/qualTestConfig/qualTestConfig.model");
const {
  getOrCreateListenerIdByPassport,
} = require("#modules/4.04-qualification/_shared/listenerContext");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const { paymentStatus } = require("#modules/4.04-qualification/_shared/paymentGate");

const { emitToUser, isOnlineBatch } = require("#system/_shared/socketHandler");

const LISTENER_ROLE_TITLE = "malaka_tinglovchi";

async function listenerIdOf(ref) {
  const { listenerId, userId } = typeof ref === "object" && ref !== null ? ref : { userId: ref };
  if (listenerId) return listenerId;

  const user = await User.findById(userId).select("+oneIdPin").lean();
  if (!user) throw new ErrorHandler(404, "Foydalanuvchi topilmadi");
  const id = await getOrCreateListenerIdByPassport(user.oneIdPin);
  if (!id) throw new ErrorHandler(403, "Tinglovchi kartochkasi topilmadi");
  return id;
}

async function progressContext(userId, course) {
  if (!course) throw new ErrorHandler(400, "course kerak");
  const listenerId = await listenerIdOf(userId);

  const [topics, entrance, passed, finalCfgs, existing] = await Promise.all([
    QualTopicModel.find({ course })
      .select("title orderNumber duration finalTest")
      .sort({ orderNumber: 1 })
      .lean(),
    QualAccessTestResultModel.findOne({ course, listener: listenerId, status: 2 })
      .select("_id")
      .lean(),
    QualFinalTestResultModel.find({ course, listener: listenerId, isPassed: true })
      .select("topic")
      .lean(),
    QualTestConfig.find({ course, kind: 3 }).select("topic passPercentage").lean(),
    QualTopicCompletionModel.find({ course, listener: listenerId })
      .select("topic status startedAt isLocked scenarioAnswer scenarioImage")
      .lean(),
  ]);

  const payment = await paymentStatus(listenerId, course);

  return {
    listenerId: String(listenerId),
    entranceDone: !!entrance,
    payment: {
      locked: payment.locked,
      dueAt: payment.dueAt,
      requiredAmount: payment.requiredAmount,
      paidAmount: payment.paidAmount,
      totalPrice: payment.totalPrice,
    },
    topics: topics.map((t) => ({
      _id: String(t._id),
      title: t.title,
      orderNumber: t.orderNumber,
      duration: t.duration,
      finalTestPassPercentage: (t.finalTest && t.finalTest.passPercentage) || null,
    })),
    passedTopicIds: passed.map((p) => String(p.topic)),
    passByTopic: Object.fromEntries(
      finalCfgs.filter((c) => c.topic).map((c) => [String(c.topic), c.passPercentage]),
    ),
    existingCompletions: existing.map((c) => ({
      topic: String(c.topic),
      status: c.status,
      startedAt: c.startedAt,
      isLocked: c.isLocked,
      scenarioAnswer: c.scenarioAnswer,
      scenarioImage: c.scenarioImage,
    })),
  };
}

async function upsertTopicCompletion(userId, payload) {
  const { course, topic } = payload || {};
  if (!course || !topic) throw new ErrorHandler(400, "course va topic kerak");
  const listenerId = await listenerIdOf(userId);

  const set = { course, topic, listener: listenerId };
  if (payload.status != null) set.status = payload.status;
  if (payload.startedAt) set.startedAt = payload.startedAt;
  if (payload.isLocked != null) set.isLocked = payload.isLocked;
  if (payload.scenarioAnswer !== undefined) set.scenarioAnswer = payload.scenarioAnswer;
  if (payload.scenarioImage !== undefined) set.scenarioImage = payload.scenarioImage;

  await QualTopicCompletionModel.updateOne(
    { course, topic, listener: listenerId },
    { $set: set },
    { upsert: true },
  );
  return { synced: true };
}

async function listListeners() {
  const cards = await QualListener.find({}).select("_id passport fullName").lean();
  if (!cards.length) return { listeners: [] };

  const passports = cards.map((c) => c.passport).filter(Boolean);
  const users = await User.find({ oneIdPin: { $in: passports } })
    .select(
      "+oneIdPin firstName lastName middleName passportSeria passportNumber email phone active",
    )
    .lean();
  const byPin = new Map(users.map((u) => [u.oneIdPin, u]));

  const listeners = cards
    .filter((c) => c.passport)
    .map((c) => {
      const u = byPin.get(c.passport) || {};
      const parts = String(c.fullName || "").trim().split(/\s+/).filter(Boolean);
      return {
        passport: c.passport,
        listenerId: String(c._id),
        userId: u._id ? String(u._id) : String(c._id),
        fullName:
          c.fullName || [u.lastName, u.firstName, u.middleName].filter(Boolean).join(" ").trim(),
        active: u.active !== false,
        firstName: u.firstName || parts[1] || null,
        lastName: u.lastName || parts[0] || null,
        middleName: u.middleName || parts.slice(2).join(" ") || null,
        passportSeria: u.passportSeria || null,
        passportNumber: u.passportNumber != null ? String(u.passportNumber) : null,
        email: u.email || null,
        phone: u.phone || null,
      };
    });

  return { listeners };
}

const ALLOWED_EVENTS = new Set([
  "receiveMessage",
  "messageSent",
  "messagesRead",
  "typing",
  "stopTyping",
]);

async function notifyUser({ userId, event, payload }) {
  if (!userId || !event) throw new ErrorHandler(400, "userId va event kerak");
  if (!ALLOWED_EVENTS.has(event)) {
    throw new ErrorHandler(403, `"${event}" hodisasini yuborish mumkin emas`);
  }
  return { delivered: await emitToUser(String(userId), event, payload) };
}

async function listUsersForDisplay(ids = []) {
  const clean = (Array.isArray(ids) ? ids : String(ids).split(","))
    .map((s) => String(s).trim())
    .filter((s) => /^[a-f\d]{24}$/i.test(s));
  if (!clean.length) return { users: [] };

  const [users, onlineById] = await Promise.all([
    User.find({ _id: { $in: clean } })
      .select("firstName lastName photo lastSeen workingSchedule")
      .lean(),
    isOnlineBatch(clean),
  ]);

  return {
    users: users.map((u) => ({
      _id: String(u._id),
      firstName: u.firstName || null,
      lastName: u.lastName || null,
      photo: u.photo || null,
      lastSeen: u.lastSeen || null,
      workingSchedule: u.workingSchedule || [],
      online: onlineById.get(String(u._id)) ?? false,
    })),
  };
}

module.exports = {
  progressContext,
  upsertTopicCompletion,
  listListeners,
  notifyUser,
  listUsersForDisplay,
};
