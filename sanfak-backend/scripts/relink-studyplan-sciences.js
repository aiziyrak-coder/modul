"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  LINK_STATUS,
  buildCatalog,
  applyLink,
} = require("#modules/4.02-studyLoad/_services/scienceLinker");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const emptyStat = () => ({
  docs: 0,
  changedDocs: 0,
  [LINK_STATUS.ALREADY]: 0,
  [LINK_STATUS.FILLED]: 0,
  [LINK_STATUS.NO_CODE]: 0,
  [LINK_STATUS.NON_SCIENCE]: 0,
  [LINK_STATUS.NOT_IN_CATALOG]: 0,
});

const relinkBlocks = (blocks, catalog, stat, missing) => {
  let changed = 0;
  for (const block of blocks || []) {
    for (const el of block.sciences || []) {
      const status = applyLink(el, catalog);
      stat[status] += 1;
      if (status === LINK_STATUS.FILLED) changed += 1;

      if (
        status === LINK_STATUS.NOT_IN_CATALOG ||
        status === LINK_STATUS.NON_SCIENCE
      ) {
        const bucket =
          status === LINK_STATUS.NON_SCIENCE
            ? missing.nonScience
            : missing.science;
        const code = String(el.code);
        if (!bucket.has(code)) bucket.set(code, el.title || "—");
      }
    }
  }
  return changed;
};

async function relink({ db, write = false, backup = true, dbName = "" }) {
  const catalog = buildCatalog(
    await db
      .collection("sciences")
      .find({ scienceCode: { $nin: [null, ""] } })
      .toArray(),
  );

  const stat = { studyplans: emptyStat(), workingplans: emptyStat() };
  const missing = { science: new Map(), nonScience: new Map() };
  const studyPlanUpdates = [];
  const workingPlanUpdates = [];

  for (const sp of await db.collection("studyplans").find({}).toArray()) {
    stat.studyplans.docs += 1;
    const changed = relinkBlocks(sp.blocks, catalog, stat.studyplans, missing);
    if (changed) {
      stat.studyplans.changedDocs += 1;
      studyPlanUpdates.push({ _id: sp._id, blocks: sp.blocks, changed });
    }
  }

  for (const wp of await db.collection("workingplans").find({}).toArray()) {
    stat.workingplans.docs += 1;
    let changed = 0;
    for (const semKey of Object.keys(wp.semesters || {})) {
      const sem = wp.semesters[semKey] || {};
      changed += relinkBlocks(sem.blocks, catalog, stat.workingplans, missing);
    }
    if (changed) {
      stat.workingplans.changedDocs += 1;
      workingPlanUpdates.push({ _id: wp._id, semesters: wp.semesters, changed });
    }
  }

  const totalFilled =
    stat.studyplans[LINK_STATUS.FILLED] + stat.workingplans[LINK_STATUS.FILLED];

  const result = {
    catalogSize: catalog.size,
    stat,
    missing,
    totalFilled,
    studyPlanUpdates,
    workingPlanUpdates,
    written: null,
    backupFile: null,
  };

  if (!write || !totalFilled) return result;

  if (backup) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(
      BACKUP_DIR,
      `relink-studyplan-sciences-${stamp}.json`,
    );
    const ids = {
      studyplans: studyPlanUpdates.map((u) => u._id),
      workingplans: workingPlanUpdates.map((u) => u._id),
    };
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      studyplans: await db
        .collection("studyplans")
        .find({ _id: { $in: ids.studyplans } })
        .toArray(),
      workingplans: await db
        .collection("workingplans")
        .find({ _id: { $in: ids.workingplans } })
        .toArray(),
      workloadsFlagged: await db
        .collection("workloads")
        .find(
          { needsRecalculation: { $ne: true } },
          { projection: { _id: 1, needsRecalculation: 1 } },
        )
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let studyplans = 0;
  for (const u of studyPlanUpdates) {
    const r = await db
      .collection("studyplans")
      .updateOne({ _id: u._id }, { $set: { blocks: u.blocks } });
    studyplans += r.modifiedCount;
  }
  let workingplans = 0;
  for (const u of workingPlanUpdates) {
    const r = await db
      .collection("workingplans")
      .updateOne({ _id: u._id }, { $set: { semesters: u.semesters } });
    workingplans += r.modifiedCount;
  }
  const wr = await db
    .collection("workloads")
    .updateMany(
      { needsRecalculation: { $ne: true } },
      { $set: { needsRecalculation: true } },
    );

  result.written = {
    studyplans,
    workingplans,
    workloads: wr.modifiedCount,
  };
  return result;
}

function printReport(result, { dry, dbName, workloadCount, staleWorkloads }) {
  const { stat, missing, totalFilled } = result;

  log();
  line("═");
  log(
    `  ESKI REJALARNI QAYTA BOG'LASH — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`,
  );
  log(`  Baza: ${dbName}`);
  line("═");
  log(`\nKatalogda kodli fan: ${result.catalogSize}`);

  for (const [name, s] of Object.entries(stat)) {
    const checked =
      s[LINK_STATUS.ALREADY] +
      s[LINK_STATUS.FILLED] +
      s[LINK_STATUS.NO_CODE] +
      s[LINK_STATUS.NON_SCIENCE] +
      s[LINK_STATUS.NOT_IN_CATALOG];
    log();
    line();
    log(
      `  ${name.toUpperCase()} — hujjat: ${s.docs}, o'zgaradigan hujjat: ${s.changedDocs}`,
    );
    line();
    log(`    tekshirilgan qator                : ${checked}`);
    log(`    ✅ to'ldiriladi                    : ${s[LINK_STATUS.FILLED]}`);
    log(`    ⏭  allaqachon bog'liq              : ${s[LINK_STATUS.ALREADY]}`);
    log(`    ⚠️  kodsiz qator (yig'indi)         : ${s[LINK_STATUS.NO_CODE]}`);
    log(`    ❓ topilmadi — FAN                 : ${s[LINK_STATUS.NOT_IN_CATALOG]}`);
    log(`    ℹ️  topilmadi — amaliyot/attestatsiya: ${s[LINK_STATUS.NON_SCIENCE]}  (normal)`);
  }

  if (missing.science.size) {
    log();
    line();
    log(
      `  ❓ KATALOGDA YO'Q — HAQIQIY FAN (${missing.science.size}) — e'tibor kerak`,
    );
    log(`     kod AYNAN mos kelishi shart; taxminiy moslash QILINMAYDI`);
    line();
    for (const [code, title] of missing.science) {
      log(`   ${code.padEnd(12)} | ${title}`);
    }
  }

  if (missing.nonScience.size) {
    log();
    line();
    log(
      `  ℹ️  KATALOGDA YO'Q — AMALIYOT/ATTESTATSIYA (${missing.nonScience.size}) — NORMAL, xato emas`,
    );
    line();
    for (const [code, title] of missing.nonScience) {
      log(`   ${code.padEnd(12)} | ${title}`);
    }
  }

  log();
  line();
  log(`  HOSILA — workloads: ${workloadCount} ta`);
  line();
  if (!totalFilled) {
    log(`    Bog'lanish o'zgarmadi → yuklamalarga tegilmaydi.`);
  } else {
    log(`    Manba o'zgargani uchun ${staleWorkloads} ta yuklama`);
    log(`    'needsRecalculation: true' bilan belgilanadi.`);
    log(
      `    Keyin qayta hisoblash: POST /api/workloads/recalculate { needsRecalculation: true }`,
    );
  }

  log();
  line("═");
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(`  Yozish uchun: node scripts/relink-studyplan-sciences.js --write`);
  } else if (!totalFilled) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(
      `  YOZILDI: studyplans ${result.written.studyplans} hujjat · workingplans ${result.written.workingplans} hujjat`,
    );
    log(`  Yuklamalar belgilandi (needsRecalculation): ${result.written.workloads}`);
  }
  log(
    `  Xulosa: bog'landi ${totalFilled} qator (studyplans ${stat.studyplans[LINK_STATUS.FILLED]} + workingplans ${stat.workingplans[LINK_STATUS.FILLED]}) · katalogda yo'q ${missing.science.size} FAN kodi · ${missing.nonScience.size} amaliyot/attestatsiya kodi (normal)`,
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

  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;
  const dbName = mongoose.connection.name;

  const result = await relink({ db, write, dbName });

  const workloadCount = await db.collection("workloads").countDocuments();
  const staleWorkloads = result.totalFilled
    ? await db
        .collection("workloads")
        .countDocuments({ needsRecalculation: { $ne: true } })
    : 0;

  printReport(result, { dry: !write, dbName, workloadCount, staleWorkloads });

  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { relink, relinkBlocks, emptyStat, printReport };
