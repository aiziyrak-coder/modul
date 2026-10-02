"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  CHAINS,
  LEGACY_STEPS,
} = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const COLLECTION = "scienceprograms";
const TARGET_CHAIN = CHAINS.v259;

const isTargetDoc = (doc) =>
  !!doc &&
  (doc.formVersion === "v259" ||
    doc.formVersion === null ||
    doc.formVersion === undefined) &&
  doc.status !== "approved";

function transformSteps(steps, chain = TARGET_CHAIN) {
  const list = Array.isArray(steps) ? steps : [];
  const dropped = [];
  const kept = list.filter((s) => {
    const isLegacy = LEGACY_STEPS.includes(s && s.step);
    const isPending = !s || !s.status || s.status === "pending";
    if (isLegacy && isPending) {
      dropped.push(s.step);
      return false;
    }
    return true;
  });
  const present = new Set(kept.map((s) => s && s.step));
  const added = chain.filter((step) => !present.has(step));
  const result = [
    ...kept,
    ...added.map((step) => ({ step, status: "pending" })),
  ];
  return {
    steps: result,
    changed: dropped.length > 0 || added.length > 0,
    dropped,
    added,
  };
}

async function migrate({ db, apply = false, backup = true, dbName = "" }) {
  const docs = await db
    .collection(COLLECTION)
    .find(
      { status: { $ne: "approved" } },
      { projection: { formVersion: 1, status: 1, approvalSteps: 1 } },
    )
    .toArray();

  const perDoc = [];
  for (const doc of docs) {
    if (!isTargetDoc(doc)) continue;
    const t = transformSteps(doc.approvalSteps);
    if (!t.changed) continue;
    perDoc.push({
      _id: doc._id,
      status: doc.status,
      before: (doc.approvalSteps || []).map((s) => `${s.step}:${s.status || "pending"}`),
      after: t.steps.map((s) => `${s.step}:${s.status || "pending"}`),
      dropped: t.dropped,
      added: t.added,
      steps: t.steps,
    });
  }

  const result = {
    scanned: docs.length,
    affected: perDoc.length,
    perDoc,
    written: 0,
    backupFile: null,
  };

  if (!apply || perDoc.length === 0) return result;

  if (backup) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `migrate-scienceprogram-v259-chain-${stamp}.json`,
    );
    const ids = perDoc.map((d) => d._id);
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      before: await db
        .collection(COLLECTION)
        .find({ _id: { $in: ids } }, { projection: { approvalSteps: 1, status: 1, formVersion: 1 } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let written = 0;
  for (const d of perDoc) {
    const r = await db
      .collection(COLLECTION)
      .updateOne({ _id: d._id }, { $set: { approvalSteps: d.steps } });
    written += r.modifiedCount;
  }
  result.written = written;
  return result;
}

function printReport(result, { dry, dbName }) {
  log();
  line("═");
  log(
    `  FAN DASTURI v259 ZANJIRI → B1 (dekan) — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "APPLY (yozildi)"}`,
  );
  log(`  Baza: ${dbName} · nishon zanjir: ${TARGET_CHAIN.join(" → ")}`);
  line("═");
  log(`\nTekshirilgan (approved bo'lmagan) hujjatlar: ${result.scanned}`);
  log(`O'zgaradigan/o'zgargan hujjatlar: ${result.affected}`);
  if (result.perDoc.length) {
    log();
    line();
    for (const d of result.perDoc) {
      log(`  ${d._id} | ${d.status}`);
      log(`     eski:  ${d.before.join(" → ")}`);
      log(`     yangi: ${d.after.join(" → ")}`);
    }
    line();
  }
  log();
  if (dry) {
    log("  DRY-RUN — hech narsa yozilmadi.");
    log("  Yozish uchun: node scripts/migrate-scienceprogram-v259-chain.js --apply");
  } else if (!result.affected) {
    log("  O'zgaradigan hujjat topilmadi — yozilmadi (idempotent).");
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: ${result.written} ta hujjat yangilandi.`);
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

  const result = await migrate({ db, apply, dbName });
  printReport(result, { dry: !apply, dbName });

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { migrate, transformSteps, isTargetDoc, printReport };
