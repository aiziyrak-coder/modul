const crypto = require("crypto");
const winston = require("#shared/winston.logger");
const { HemisRecord, HemisSyncRun } = require("./hemis.model");
const { fetchPage } = require("./hemis.client");
const { TYPES, REGULAR_TYPES } = require("./hemis.config");

let running = false; // bitta jarayonda bir vaqtda bitta sinxron
const isRunning = () => running;

const hashOf = (obj) => crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex");
const idOf = (item, type) => {
  const k = TYPES[type].key;
  return String((k && item[k]) ?? item.id ?? item.hash ?? hashOf(item));
};

async function syncType(type, runId) {
  const startedAt = Date.now();
  let page = 1;
  let pageCount = 1;
  let seen = 0;
  let changed = 0;

  do {
    const res = await fetchPage(type, page);
    pageCount = res.pageCount;
    if (res.items.length) {
      const ops = res.items.map((item) => ({
        updateOne: {
          filter: { type, hemisId: idOf(item, type) },
          update: {
            $set: {
              data: item,
              hash: hashOf(item),
              runId,
              missing: false,
              syncedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));
      const r = await HemisRecord.bulkWrite(ops, { ordered: false });
      seen += res.items.length;
      changed += (r.upsertedCount || 0) + (r.modifiedCount || 0);
    }
    page += 1;
  } while (page <= pageCount);

  // To'liq o'tildi — bu runda ko'rinmagan yozuvlarni belgilab qo'yamiz (o'chirmaymiz)
  const gone = await HemisRecord.updateMany(
    { type, runId: { $ne: runId }, missing: false },
    { $set: { missing: true } },
  );
  return {
    seen,
    changed,
    missing: gone.modifiedCount || 0,
    seconds: Math.round((Date.now() - startedAt) / 1000),
  };
}

async function syncAll({ types = REGULAR_TYPES, trigger = "manual" } = {}) {
  if (running) {
    throw Object.assign(new Error("HEMIS sinxroni allaqachon ishlayapti"), { status: 409 });
  }
  const list = types.filter((t) => TYPES[t]);
  if (!list.length) {
    throw Object.assign(new Error("Yaroqli tur ko'rsatilmagan"), { status: 400 });
  }

  running = true;
  const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  try {
    await HemisRecord.createIndexes(); // autoIndex o'chiq — indekslarni o'zimiz ta'minlaymiz
    await HemisSyncRun.create({ runId, types: list, trigger });
    const results = {};
    let failed = 0;
    for (const type of list) {
      try {
        results[type] = { ok: true, ...(await syncType(type, runId)) };
        winston.info(`[hemis] ${type}: ${results[type].seen} ta, o'zgargan ${results[type].changed}`);
      } catch (err) {
        failed += 1;
        results[type] = { ok: false, error: err.message };
        winston.error(`[hemis] ${type} xato: ${err.message}`);
      }
    }
    const status = failed === 0 ? "ok" : failed === list.length ? "failed" : "partial";
    await HemisSyncRun.updateOne({ runId }, { $set: { status, finishedAt: new Date(), results } });
    return { runId, status, results };
  } finally {
    running = false;
  }
}

async function status() {
  const [counts, lastRuns] = await Promise.all([
    HemisRecord.aggregate([
      { $match: { missing: false } },
      { $group: { _id: "$type", count: { $sum: 1 }, lastSync: { $max: "$syncedAt" } } },
      { $sort: { _id: 1 } },
    ]),
    HemisSyncRun.find().sort({ startedAt: -1 }).limit(5).lean(),
  ]);
  return { running, tokenConfigured: !!process.env.HEMIS_API_TOKEN, counts, lastRuns };
}

module.exports = { syncAll, syncType, status, isRunning };
