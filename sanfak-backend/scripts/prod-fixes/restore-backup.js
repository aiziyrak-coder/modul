"use strict";

const fs = require("fs");
const mongoose = require("mongoose");
const { connectDb, readBackup, log, line } = require("./_lib");

const WRITE = process.argv.includes("--write");
const FILE = process.argv.slice(2).find((a) => !a.startsWith("--"));

async function isArrayField(db, collection, field, id) {
  const doc = await db.collection(collection).findOne({ _id: id }, { projection: { [field]: 1 } });
  if (!doc) return null;
  const value = field.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), doc);
  return Array.isArray(value);
}

async function run() {
  if (!FILE) {
    log("  Ishlatish: node scripts/prod-fixes/restore-backup.js <zaxira.json> [--write]");
    process.exitCode = 1;
    return;
  }
  if (!fs.existsSync(FILE)) {
    log(`  🔴 zaxira fayli topilmadi: ${FILE}`);
    process.exitCode = 1;
    return;
  }

  const { format, payload } = readBackup(FILE);

  line();
  log(`  Zaxira : ${FILE}`);
  log(`  Format : ${format}${format < 2 ? "  🔴 ESKI" : ""}`);
  log(`  Skript : ${payload.script ?? "(noma'lum)"}`);
  log(`  Yozilgan: ${payload.createdAt ?? "(noma'lum)"}`);
  log(`  Rejim  : ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}`);
  line();

  if (format < 2) {
    log("");
    log("  🔴 ESKI FORMATDAN TIKLAB BO'LMAYDI.");
    log("     Bu fayl `JSON.stringify` bilan yozilgan — `ObjectId` va `Date`");
    log("     allaqachon SATRGA aylangan. Undan tiklash bazani JIMGINA buzardi");
    log("     (`_id` o'rniga satr yozilar va hech qanday xato chiqmasdi).");
    log("     Qiymatlarni qo'lda ko'rib chiqing.");
    process.exitCode = 1;
    return;
  }

  const { db, dbName } = await connectDb();
  try {
    if (payload.db && payload.db !== dbName) {
      log(`  🔴 BAZA MOS EMAS: zaxira "${payload.db}", ulanish "${dbName}".`);
      log("     Noto'g'ri bazaga tiklashning oldi olindi.");
      process.exitCode = 1;
      return;
    }

    const plan = [];
    const refused = [];

    const dupId = payload.duplicate?._id ?? payload.duplicate;
    if (payload.refSnapshots && dupId) {
      for (const [collection, snap] of Object.entries(payload.refSnapshots)) {
        for (const id of snap.ids ?? []) {
          const arr = await isArrayField(db, collection, snap.field, id);
          if (arr === null) {
            refused.push(`${collection}#${id} — hujjat topilmadi`);
            continue;
          }
          if (arr) {
            refused.push(
              `${collection}.${snap.field} (#${id}) — MASSIV maydon, zaxirada a'zolik fakti yo'q`,
            );
            continue;
          }
          plan.push({ collection, field: snap.field, id, to: dupId });
        }
      }
    }

    if (payload.action === "title-repair" && payload.docId && payload.titleBefore !== undefined) {
      plan.push({
        collection: payload.collection,
        field: "title",
        id: payload.docId,
        to: payload.titleBefore,
      });
    }

    let reinsert = null;
    if (payload.collection && payload.duplicate && payload.duplicate._id) {
      const exists = await db
        .collection(payload.collection)
        .countDocuments({ _id: payload.duplicate._id });
      if (!exists) reinsert = payload.duplicate;
    }

    log(`  Qaytariladi   : ${plan.length} ta maydon`);
    log(`  Qayta qo'yiladi: ${reinsert ? 1 : 0} ta hujjat`);
    log(`  RAD etildi     : ${refused.length}\n`);

    for (const p of plan) log(`    · ${p.collection}.${p.field} (#${p.id}) -> ${p.to}`);
    if (reinsert) log(`    + ${payload.collection} hujjati qayta qo'yiladi: #${reinsert._id}`);
    for (const r of refused) log(`    🔴 ${r}`);

    if (refused.length) {
      log("");
      log("  🔴 RAD ETILGANLAR QO'LDA ko'rib chiqilishi kerak — skript taxmin qilmaydi.");
    }

    if (!WRITE) {
      if (plan.length || reinsert) log("\n  ℹ️  Dry-run — yozish uchun `--write` bering");
      return;
    }

    if (reinsert) await db.collection(payload.collection).insertOne(reinsert);
    for (const p of plan) {
      await db.collection(p.collection).updateOne({ _id: p.id }, { $set: { [p.field]: p.to } });
    }
    log(`\n  ✅ ${plan.length} maydon qaytarildi${reinsert ? ", 1 hujjat qayta qo'yildi" : ""}`);
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch((err) => {
    log(`  🔴 XATO: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { isArrayField };
