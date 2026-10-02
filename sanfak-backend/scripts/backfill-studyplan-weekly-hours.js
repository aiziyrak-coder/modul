"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const FILL_STATUS = {
  ALREADY: "already",
  FILLED: "filled",
  NO_SOURCE: "noSource",
};

const emptyStat = () => ({
  docs: 0,
  changedDocs: 0,
  [FILL_STATUS.ALREADY]: 0,
  [FILL_STATUS.FILLED]: 0,
  [FILL_STATUS.NO_SOURCE]: 0,
});

const applyFill = (sem) => {
  if (!sem || typeof sem !== "object") return FILL_STATUS.NO_SOURCE;
  if (Number(sem.weeklyHours) > 0) return FILL_STATUS.ALREADY;

  const hour = Number(sem.hour) || 0;
  if (hour <= 0) return FILL_STATUS.NO_SOURCE;

  sem.weeklyHours = hour;
  return FILL_STATUS.FILLED;
};

const fillBlocks = (blocks, stat) => {
  let changed = 0;
  for (const block of blocks || []) {
    for (const sci of block.sciences || []) {
      const sems = sci.semesters || {};
      for (const key of Object.keys(sems)) {
        const status = applyFill(sems[key]);
        stat[status] += 1;
        if (status === FILL_STATUS.FILLED) changed += 1;
      }
    }
  }
  return changed;
};

async function backfill({ db, write = false, backup = true, dbName = "" }) {
  const stat = emptyStat();
  const updates = [];

  for (const sp of await db.collection("studyplans").find({}).toArray()) {
    stat.docs += 1;
    const changed = fillBlocks(sp.blocks, stat);
    if (changed) {
      stat.changedDocs += 1;
      updates.push({ _id: sp._id, blocks: sp.blocks, changed });
    }
  }

  const result = {
    stat,
    totalFilled: stat[FILL_STATUS.FILLED],
    updates,
    written: null,
    backupFile: null,
  };

  if (!write || !result.totalFilled) return result;

  if (backup) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `backfill-studyplan-weekly-hours-${stamp}.json`,
    );
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      studyplans: await db
        .collection("studyplans")
        .find({ _id: { $in: updates.map((u) => u._id) } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let studyplans = 0;
  for (const u of updates) {
    const r = await db
      .collection("studyplans")
      .updateOne({ _id: u._id }, { $set: { blocks: u.blocks } });
    studyplans += r.modifiedCount;
  }

  result.written = { studyplans };
  return result;
}

function printReport(result, { dry, dbName }) {
  const { stat, totalFilled } = result;
  const checked =
    stat[FILL_STATUS.ALREADY] +
    stat[FILL_STATUS.FILLED] +
    stat[FILL_STATUS.NO_SOURCE];

  log();
  line("═");
  log(
    `  weeklyHours BACKFILL — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`,
  );
  log(`  Baza: ${dbName}`);
  line("═");
  log();
  log(
    `  STUDYPLANS — hujjat: ${stat.docs}, o'zgaradigan hujjat: ${stat.changedDocs}`,
  );
  line();
  log(`    tekshirilgan semestr yozuvi        : ${checked}`);
  log(`    ✅ to'ldiriladi (weeklyHours = hour): ${stat[FILL_STATUS.FILLED]}`);
  log(`    ⏭  allaqachon to'ldirilgan (MERGE)  : ${stat[FILL_STATUS.ALREADY]}`);
  log(`    ⚠️  manba yo'q (hour = 0)            : ${stat[FILL_STATUS.NO_SOURCE]}`);

  log();
  line("═");
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(
      `  Yozish uchun: node scripts/backfill-studyplan-weekly-hours.js --write`,
    );
  } else if (!totalFilled) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: studyplans ${result.written.studyplans} hujjat`);
  }
  log(
    `  Xulosa: to'ldiriladi ${totalFilled} semestr yozuvi · tegilmaydi ${stat[FILL_STATUS.ALREADY]} · manbasiz ${stat[FILL_STATUS.NO_SOURCE]}`,
  );
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

  const result = await backfill({ db, write, dbName });
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
  backfill,
  fillBlocks,
  applyFill,
  emptyStat,
  printReport,
  FILL_STATUS,
};
