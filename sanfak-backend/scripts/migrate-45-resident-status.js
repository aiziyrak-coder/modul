"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const COLLECTION = "residents";
const TARGET_STATUS = "oquvda";

const rawCollection = () => mongoose.connection.db.collection(COLLECTION);

function saveBackup(ids, dbName) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(
    BACKUP_DIR,
    `resident-status-${dbName || "default"}-${stamp}.json`,
  );
  fs.writeFileSync(
    file,
    JSON.stringify({ collection: COLLECTION, field: "status", ids }, null, 2),
  );
  return file;
}

async function survey() {
  const c = rawCollection();
  const [
    total,
    missing,
    present,
    deleted,
    deletedMissing,
    inactive,
    inactiveWithDraft,
    inactiveWithoutDraft,
  ] = await Promise.all([
    c.countDocuments({}),
    c.countDocuments({ status: { $exists: false } }),
    c.countDocuments({ status: { $exists: true } }),
    c.countDocuments({ deletedAt: { $ne: null } }),
    c.countDocuments({ deletedAt: { $ne: null }, status: { $exists: false } }),
    c.countDocuments({ active: false }),
    c.countDocuments({ active: false, expulsionOrderCreated: true }),
    c.countDocuments({ active: false, expulsionOrderCreated: { $ne: true } }),
  ]);
  return {
    total,
    missing,
    present,
    deleted,
    deletedMissing,
    inactive,
    inactiveWithDraft,
    inactiveWithoutDraft,
  };
}

async function backfill({ apply = false, dbName = null } = {}) {
  const c = rawCollection();
  const before = await survey();

  const docs = await c
    .find({ status: { $exists: false } }, { projection: { _id: 1 } })
    .toArray();
  const ids = docs.map((d) => String(d._id));

  if (!apply) return { before, ids, modified: 0, backup: null };

  const backup = ids.length ? saveBackup(ids, dbName) : null;
  const res = await c.updateMany(
    { status: { $exists: false } },
    { $set: { status: TARGET_STATUS } },
  );
  return { before, ids, modified: res.modifiedCount ?? 0, backup };
}

async function revert({ file }) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = (raw.ids || []).map((id) => new mongoose.Types.ObjectId(id));
  if (!ids.length) return { ids: 0, changed: 0 };
  const res = await rawCollection().updateMany(
    { _id: { $in: ids } },
    { $unset: { status: "" } },
  );
  return { ids: ids.length, changed: res.modifiedCount ?? 0 };
}

function printReport(result, apply) {
  const b = result.before;
  line("═");
  log("  4.5 REZIDENT HOLATI (`status`) — BACKFILL");
  line("═");
  log(`  Jami rezident (soft-delete bilan):      ${b.total}`);
  log(`  `.padEnd(3) + `status YO'Q (to'ldiriladi):         ${b.missing}`);
  log(`  `.padEnd(3) + `status BOR (tegilmaydi):            ${b.present}`);
  line();
  log(`  Soft-delete qilingan:                   ${b.deleted}`);
  log(`  `.padEnd(3) + `shundan status yo'q:                ${b.deletedMissing}`);
  line();
  log("  MEROS: `active: false` yozuvlar (hisobot uchun — TEGILMAYDI)");
  log(`  `.padEnd(3) + `jami:                               ${b.inactive}`);
  log(`  `.padEnd(3) + `buyruq loyihasi bilan:              ${b.inactiveWithDraft}`);
  log(`  `.padEnd(3) + `loyihasiz:                          ${b.inactiveWithoutDraft}`);
  log("     ⚠️ Ikkalasi ham `oquvda` oladi: imzosiz chetlatish yo'q.");
  log("        Bo'lim chetlatish buyrug'i orqali rasmiylashtiradi.");
  line();
  if (apply) {
    log(`  ✅ YOZILDI: ${result.modified} ta hujjat → status: "${TARGET_STATUS}"`);
    if (result.backup) log(`  Zaxira: ${result.backup}`);
    const qolgan = b.missing - result.modified;
    if (qolgan !== 0) {
      log(`  🔴 DIQQAT: ${qolgan} ta hujjat to'ldirilmadi — tekshirish kerak!`);
    } else {
      log("  Qamrov: TO'LIQ (status'siz hujjat qolmadi)");
    }
  } else {
    log(`  DRY-RUN — hech narsa yozilmadi. ${result.ids.length} ta hujjat kutilmoqda.`);
    log("  Yozish uchun: --apply");
  }
  line("═");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));
  const revertArg = process.argv.find((a) => a.startsWith("--revert="));

  if (!process.env.MONGO_HOST) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }

  const dbName = dbArg ? dbArg.slice("--db=".length) : null;
  const uri = dbName
    ? process.env.MONGO_HOST.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`)
    : process.env.MONGO_HOST;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    if (revertArg) {
      const r = await revert({ file: revertArg.slice("--revert=".length) });
      log(`  ORQAGA QAYTARISH: zaxirada ${r.ids} ta id, o'zgardi ${r.changed} ta.`);
      return;
    }
    const result = await backfill({ apply, dbName });
    printReport(result, apply);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { survey, backfill, revert, TARGET_STATUS, COLLECTION };
