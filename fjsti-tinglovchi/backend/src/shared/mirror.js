const mongoose = require("mongoose");
const logger = require("./logger");

const { listenerDb } = require("./db");

let _models = null;
function models() {
  if (_models) return _models;
  const conn = listenerDb();

  const mirrorSchema = new mongoose.Schema(
    {
      resource: { type: String, required: true },
      method: String,
      path: String,
      listenerId: { type: String, default: null },
      mainRecordId: { type: String, default: null },
      httpStatus: Number,
      data: mongoose.Schema.Types.Mixed,
      syncedAt: Date,
    },
    { strict: true, timestamps: true },
  );
  mirrorSchema.index({ resource: 1, listenerId: 1 });
  mirrorSchema.index(
    { resource: 1, mainRecordId: 1 },
    { unique: true, partialFilterExpression: { mainRecordId: { $type: "string" } } },
  );

  const outboxSchema = new mongoose.Schema(
    {
      resource: String,
      method: String,
      path: String,
      listenerId: { type: String, default: null },
      mainRecordId: { type: String, default: null },
      httpStatus: Number,
      data: mongoose.Schema.Types.Mixed,
      attempts: { type: Number, default: 0 },
      lastError: String,
    },
    { strict: true, timestamps: true },
  );

  _models = {
    WriteMirror: conn.model("WriteMirror", mirrorSchema),
    Outbox: conn.model("MirrorOutbox", outboxSchema),
  };
  return _models;
}

function deriveResource(originalUrl) {
  const path = String(originalUrl || "").split("?")[0].replace(/^\/api\/?/, "");
  return path.split("/")[0] || "unknown";
}

function extractId(body) {
  if (!body || typeof body !== "object") return null;
  const id = body._id || body.id || body.data?._id || body.data?.id;
  return id ? String(id) : null;
}

function buildDoc(req, httpStatus, body) {
  return {
    resource: deriveResource(req.originalUrl),
    method: req.method,
    path: req.originalUrl,
    listenerId: req.listenerId || null,
    mainRecordId: extractId(body),
    httpStatus,
    data: body,
    syncedAt: new Date(),
  };
}

async function persist(doc) {
  const { WriteMirror } = models();
  if (doc.mainRecordId) {
    await WriteMirror.updateOne(
      { resource: doc.resource, mainRecordId: doc.mainRecordId },
      { $set: doc },
      { upsert: true },
    );
  } else {
    await WriteMirror.create(doc);
  }
}

async function mirrorWrite(req, httpStatus, body) {
  const doc = buildDoc(req, httpStatus, body);
  try {
    await persist(doc);
  } catch (err) {
    try {
      const { Outbox } = models();
      await Outbox.create({ ...doc, lastError: err.message });
      logger.warn(`[mirror] yozuv outbox'ga tushdi (${doc.resource}): ${err.message}`);
    } catch (err2) {
      logger.error(`[mirror] outbox ham muvaffaqiyatsiz (${doc.resource}): ${err2.message}`);
    }
  }
}

let _listenerModel = null;
function listenerModel() {
  if (_listenerModel) return _listenerModel;
  const conn = listenerDb();
  const schema = new mongoose.Schema(
    {
      passport: { type: String, required: true, unique: true },
      fullName: { type: String, default: null },
      listenerId: { type: String, default: null },
      userId: { type: String, default: null },
      lastLoginAt: Date,
      loginCount: { type: Number, default: 0 },
    },
    { strict: true, timestamps: true },
  );
  _listenerModel = conn.model("MirrorListener", schema, "listeners");
  return _listenerModel;
}

async function mirrorListener({ passport, fullName, listenerId, userId }) {
  if (!passport) return;
  try {
    const Model = listenerModel();
    await Model.updateOne(
      { passport },
      {
        $set: { fullName: fullName || null, listenerId: listenerId || null, userId: userId || null, lastLoginAt: new Date() },
        $inc: { loginCount: 1 },
      },
      { upsert: true },
    );
  } catch (err) {
    logger.warn(`[mirror] login mirror xatosi (${passport}): ${err.message}`);
  }
}

const MAX_ATTEMPTS = 20;

async function retryOutbox(limit = 50) {
  let Outbox;
  try {
    ({ Outbox } = models());
  } catch {
    return;
  }
  const pending = await Outbox.find({ attempts: { $lt: MAX_ATTEMPTS } })
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean();
  for (const item of pending) {
    try {
      await persist(item);
      await Outbox.deleteOne({ _id: item._id });
    } catch (err) {
      await Outbox.updateOne(
        { _id: item._id },
        { $inc: { attempts: 1 }, $set: { lastError: err.message } },
      );
    }
  }
}

let retryTimer = null;
function startMirrorRetry(intervalMs = 60_000) {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    retryOutbox().catch((err) => logger.error(`[mirror] retry xatosi: ${err.message}`));
  }, intervalMs);
  if (retryTimer.unref) retryTimer.unref();
}

module.exports = { mirrorWrite, mirrorListener, retryOutbox, startMirrorRetry };
