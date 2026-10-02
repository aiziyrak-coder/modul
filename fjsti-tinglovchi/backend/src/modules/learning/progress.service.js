const { ErrorHandler } = require("#shared/error");
const logger = require("#shared/logger");
const { callMain } = require("#shared/mainApi");
const { TopicCompletion } = require("#shared/models/topicCompletion");

const CTX = "/qualification-listener-sync/progress-context";
const SYNC = "/qualification-listener-sync/topic-completion";

const ctxFor = (userId, course) => callMain(CTX, { actAsListener: userId, query: { course } });

async function writeBack(userId, doc) {
  try {
    await callMain(SYNC, {
      method: "POST",
      actAsListener: userId,
      body: {
        course: doc.course,
        topic: doc.topic,
        status: doc.status,
        startedAt: doc.startedAt,
        isLocked: doc.isLocked,
        scenarioAnswer: doc.scenarioAnswer,
        scenarioImage: doc.scenarioImage,
      },
    });
    await TopicCompletion().updateOne({ _id: doc._id }, { $set: { syncedAt: new Date() } });
  } catch (err) {
    logger.warn(`[progress] write-back kechikdi (${doc.topic}): ${err.message}`);
  }
}

async function importIfEmpty(course, listenerId, existing, userId) {
  if (!existing || !existing.length) return;
  const Model = TopicCompletion();
  await Model.bulkWrite(
    existing.map((c) => ({
      updateOne: {
        filter: { course, topic: String(c.topic), listener: listenerId },
        update: {
          $set: {
            course,
            topic: String(c.topic),
            listener: listenerId,
            status: c.status ?? 1,
            startedAt: c.startedAt || new Date(),
            isLocked: !!c.isLocked,
            scenarioAnswer: c.scenarioAnswer,
            scenarioImage: c.scenarioImage,
            userId,
            syncedAt: new Date(),
          },
        },
        upsert: true,
      },
    })),
  );
  logger.info(`[progress] ${existing.length} ta yozuv asosiydan import qilindi (kurs ${course})`);
}

async function myProgress(userId, course) {
  if (!course) throw new ErrorHandler(400, "course kerak");
  const ctx = await ctxFor(userId, course);

  const Model = TopicCompletion();
  let comps = await Model.find({ course, listener: ctx.listenerId }).lean();
  if (!comps.length) {
    await importIfEmpty(course, ctx.listenerId, ctx.existingCompletions, userId);
    comps = await Model.find({ course, listener: ctx.listenerId }).lean();
  }

  const byTopic = new Map(comps.map((c) => [String(c.topic), c]));
  const passedSet = new Set((ctx.passedTopicIds || []).map(String));

  let prevCompleted = ctx.entranceDone;
  const topics = (ctx.topics || []).map((tp) => {
    const comp = byTopic.get(String(tp._id)) || null;
    const isCompleted = passedSet.has(String(tp._id));
    const unlocked = prevCompleted;
    const status = comp ? comp.status : 0;
    const startedAt = comp ? comp.startedAt : null;
    const durationMs = (tp.duration || 0) * 60 * 60 * 1000;
    const cfgPass = (ctx.passByTopic || {})[String(tp._id)];
    prevCompleted = isCompleted;
    return {
      id: String(tp._id),
      title: tp.title,
      orderNumber: tp.orderNumber,
      duration: tp.duration,
      status,
      isLocked: !unlocked,
      isCompleted,
      progressPercent: isCompleted ? 100 : status > 0 ? Math.round(((status - 1) / 5) * 100) : 0,
      startedAt,
      finalTestAvailableAt: startedAt
        ? new Date(new Date(startedAt).getTime() + durationMs)
        : null,
      passPercentage: cfgPass != null ? cfgPass : tp.finalTestPassPercentage || 50,
    };
  });

  return { entranceDone: ctx.entranceDone, topics, payment: ctx.payment || null };
}

function assertPaid(ctx) {
  if (ctx.payment && ctx.payment.locked) {
    throw new ErrorHandler(
      402,
      "To'lov muddati o'tdi: shartnoma summasining 50% i to'lanmagan. " +
        "Kurs materiallari to'lov amalga oshirilgach ochiladi.",
    );
  }
}

async function startTopic(userId, { course, topic }) {
  if (!course || !topic) throw new ErrorHandler(400, "course va topic kerak");
  const ctx = await ctxFor(userId, course);

  assertPaid(ctx);

  const topicDoc = (ctx.topics || []).find((t) => String(t._id) === String(topic));
  if (!topicDoc) throw new ErrorHandler(404, "Mavzu topilmadi!");
  if (!ctx.entranceDone) throw new ErrorHandler(400, "Avval kirish testini yakunlang!");

  if (topicDoc.orderNumber > 1) {
    const prev = (ctx.topics || []).find((t) => t.orderNumber === topicDoc.orderNumber - 1);
    if (prev && !(ctx.passedTopicIds || []).map(String).includes(String(prev._id))) {
      throw new ErrorHandler(400, "Oldingi mavzuni yakunlang!");
    }
  }

  const Model = TopicCompletion();
  let comp = await Model.findOne({ course, topic, listener: ctx.listenerId });
  if (!comp) {
    comp = await Model.create({
      course,
      topic,
      listener: ctx.listenerId,
      startedAt: new Date(),
      status: 1,
      isLocked: false,
      userId,
    });
    await writeBack(userId, comp);
  }
  return { data: comp };
}

async function advanceTopic(userId, { course, topic }) {
  if (!course || !topic) throw new ErrorHandler(400, "course va topic kerak");
  const ctx = await ctxFor(userId, course);
  assertPaid(ctx);

  const Model = TopicCompletion();
  const comp = await Model.findOne({ course, topic, listener: ctx.listenerId });
  if (!comp) throw new ErrorHandler(404, "Mavzu boshlanmagan!");

  if (comp.status < 5) {
    comp.status = comp.status + 1;
    comp.syncedAt = null;
    comp.userId = userId;
    await comp.save();
    await writeBack(userId, comp);
  }
  return { data: comp };
}

async function retryUnsynced(limit = 50) {
  let pending;
  try {
    pending = await TopicCompletion()
      .find({ syncedAt: null, userId: { $ne: null } })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .lean();
  } catch {
    return;
  }
  for (const doc of pending) {
    await writeBack(doc.userId, doc);
  }
}

let retryTimer = null;
function startProgressSyncRetry(intervalMs = 60_000) {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    retryUnsynced().catch((err) => logger.error(`[progress] retry xatosi: ${err.message}`));
  }, intervalMs);
  if (retryTimer.unref) retryTimer.unref();
}

module.exports = { myProgress, startTopic, advanceTopic, retryUnsynced, startProgressSyncRetry };
