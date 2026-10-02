"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  EMPTY_SLOT_TITLE,
} = require("#modules/4.02-studyLoad/_shared/electiveQuotaSlot");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const isTargetSlot = (row) =>
  row?.title === EMPTY_SLOT_TITLE &&
  (row?.science === null || row?.science === undefined) &&
  (row?.code === null || row?.code === undefined);

async function cleanup({ db, apply = false, backup = true, dbName = "" }) {
  const perPlan = [];
  const updates = [];
  let totalRemoved = 0;

  const docs = await db.collection("studyplans").find({}).toArray();

  for (const sp of docs) {
    let removed = 0;
    const blocks = (sp.blocks || []).map((block) => {
      const before = (block.sciences || []).length;
      const sciences = (block.sciences || []).filter(
        (row) => !isTargetSlot(row),
      );
      removed += before - sciences.length;
      return { ...block, sciences };
    });

    if (removed > 0) {
      totalRemoved += removed;
      perPlan.push({
        _id: sp._id,
        learningProcess: sp.learningProcess,
        removed,
      });
      updates.push({ _id: sp._id, blocks });
    }
  }

  const result = {
    scannedPlans: docs.length,
    affectedPlans: perPlan.length,
    totalRemoved,
    perPlan,
    backupFile: null,
    written: null,
  };

  if (!apply || totalRemoved === 0) return result;

  if (backup) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `cleanup-elective-slots-${stamp}.json`,
    );
    const ids = updates.map((u) => u._id);
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      removedByPlan: perPlan,
      studyplansBefore: await db
        .collection("studyplans")
        .find({ _id: { $in: ids } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let written = 0;
  for (const u of updates) {
    const r = await db
      .collection("studyplans")
      .updateOne({ _id: u._id }, { $set: { blocks: u.blocks } });
    written += r.modifiedCount;
  }
  result.written = written;

  return result;
}

function printReport(result, { dry, dbName }) {
  log();
  line("═");
  log(
    `  TANLOV SLOTLARINI TOZALASH — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "APPLY (yozildi)"}`,
  );
  log(`  Baza: ${dbName}`);
  line("═");
  log(`\nTekshirilgan o'quv rejalar: ${result.scannedPlans}`);
  log(`Nishon slot topilgan rejalar: ${result.affectedPlans}`);
  log(`Jami o'chiriladigan/o'chirilgan slot: ${result.totalRemoved}`);

  if (result.perPlan.length) {
    log();
    line();
    log("  Reja bo'yicha:");
    line();
    for (const p of result.perPlan) {
      log(`    studyPlan ${p._id} (learningProcess ${p.learningProcess}) — ${p.removed} ta slot`);
    }
  }

  log();
  line("═");
  if (dry) {
    log("  DRY-RUN — hech narsa yozilmadi.");
    log("  Yozish uchun: node scripts/cleanup-elective-slots.js --apply");
  } else if (!result.totalRemoved) {
    log("  Nishon slot topilmadi — yozilmadi.");
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: ${result.written} ta o'quv reja hujjati yangilandi.`);
  }
  line("═");
  log();
}

async function main() {
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));

  const uri = dbArg
    ? process.env.MONGO_HOST.replace(
        /\/[^/?]+(\?|$)/,
        `/${dbArg.slice("--db=".length)}$1`,
      )
    : process.env.MONGO_HOST;

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const dbName = mongoose.connection.name;

  const result = await cleanup({ db, apply, dbName });
  printReport(result, { dry: !apply, dbName });

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { cleanup, isTargetSlot, printReport };
