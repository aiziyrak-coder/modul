"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  computeSemesterTotals,
} = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const {
  buildBlockSerialIndex,
} = require("#modules/4.02-studyLoad/_shared/planRowType");
const {
  LOCKED_STATUSES,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

function recomputeDoc(wp) {
  const semKeys = Object.keys(wp.semesters || {}).sort(
    (a, b) => Number(a) - Number(b),
  );
  const blockSerialIndex = buildBlockSerialIndex(wp.semesters);
  const diffs = [];

  for (let i = 0; i < semKeys.length; i++) {
    const semKey = semKeys[i];
    const isLast = i === semKeys.length - 1;
    const semData = wp.semesters[semKey];
    if (!semData) continue;

    const before = {
      totalHour: Number(semData.blocksTotal?.totalHour) || 0,
      totalCredit: Number(semData.blocksTotal?.totalCredit) || 0,
    };
    computeSemesterTotals(semData, isLast, blockSerialIndex);
    const after = {
      totalHour: semData.blocksTotal.totalHour,
      totalCredit: semData.blocksTotal.totalCredit,
    };

    if (
      before.totalHour !== after.totalHour ||
      before.totalCredit !== after.totalCredit
    ) {
      diffs.push({ semester: semKey, before, after });
    }
  }
  return { changed: diffs.length > 0, diffs };
}

async function recompute({ db, write = false, backup = true, dbName = "" }) {
  const workingPlans = await db.collection("workingplans").find({}).toArray();
  const schedules = await db.collection("workingschedules").find({}).toArray();
  const wsById = new Map(schedules.map((w) => [String(w._id), w]));

  const stat = {
    docs: workingPlans.length,
    changedDocs: 0,
    unchangedDocs: 0,
    lockedTouched: {},
  };
  const updates = [];

  for (const wp of workingPlans) {
    const { changed, diffs } = recomputeDoc(wp);
    if (!changed) {
      stat.unchangedDocs += 1;
      continue;
    }
    stat.changedDocs += 1;
    const ws = wsById.get(String(wp.workingSchedule));
    const status = ws?.status || "—";
    stat.lockedTouched[status] = (stat.lockedTouched[status] || 0) + 1;
    updates.push({ _id: wp._id, semesters: wp.semesters, diffs, status });
  }

  const result = { stat, updates, written: null, backupFile: null };

  if (!write || !updates.length) return result;

  if (backup) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `recompute-workingplan-totals-${stamp}.json`,
    );
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      workingplans: await db
        .collection("workingplans")
        .find({ _id: { $in: updates.map((u) => u._id) } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let written = 0;
  for (const u of updates) {
    const r = await db
      .collection("workingplans")
      .updateOne({ _id: u._id }, { $set: { semesters: u.semesters } });
    written += r.modifiedCount;
  }
  result.written = written;
  return result;
}

const lockedSummary = (touched) => {
  const locked = LOCKED_STATUSES.reduce((s, k) => s + (touched[k] || 0), 0);
  const all = Object.entries(touched)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return { locked, all: all || "—" };
};

function printReport(result, { dry, dbName }) {
  const { stat, updates } = result;

  log();
  line("═");
  log(
    `  workingPlan blocksTotal/grandTotal QAYTA HISOB — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`,
  );
  log(`  Baza: ${dbName}`);
  line("═");

  log();
  log(`  Hujjat: ${stat.docs}, o'zgaradigan: ${stat.changedDocs}, o'zgarmaydigan: ${stat.unchangedDocs}`);

  const locked = lockedSummary(stat.lockedTouched);
  log(`  Tegiladigan hujjat statuslari      : ${locked.all}`);
  log(
    `  shundan QULFLANGAN (${LOCKED_STATUSES.join("/")}) : ${locked.locked}`,
  );

  if (updates.length) {
    log();
    log("  Hujjat bo'yicha eski→yangi ('Jami' — totalHour/totalCredit):");
    line();
    for (const u of updates) {
      log(`    _id=${u._id}  status=${u.status}`);
      for (const d of u.diffs) {
        log(
          `      semestr ${d.semester}: ${d.before.totalHour}h/${d.before.totalCredit}kr → ${d.after.totalHour}h/${d.after.totalCredit}kr`,
        );
      }
    }
  }

  log();
  line("═");
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(`  Yozish uchun: node scripts/recompute-workingplan-totals.js --write`);
  } else if (!updates.length) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: ${result.written} hujjat`);
  }
  line("═");
  log();
}

async function main() {
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const write = process.argv.includes("--write");
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

  const result = await recompute({ db, write, dbName });
  printReport(result, { dry: !write, dbName });

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    process.exit(1);
  });
}

module.exports = {
  recompute,
  recomputeDoc,
  printReport,
};
