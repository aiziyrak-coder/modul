"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { isElectiveSlotRow } = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const refId = (v) => {
  if (!v) return null;
  if (typeof v === "object" && v._id) return String(v._id);
  return String(v);
};

const semesterBlocks = (semesters) => {
  if (!semesters) return [];
  const values = semesters instanceof Map ? [...semesters.values()] : Object.values(semesters);
  return values.flatMap((s) => (Array.isArray(s?.blocks) ? s.blocks : []));
};

function collectElectiveScienceIds(blocks, into = new Map()) {
  for (const block of blocks || []) {
    for (const row of block?.sciences || []) {
      if (!isElectiveSlotRow(block, row)) continue;
      const ids = [
        refId(row.science),
        ...(Array.isArray(row.alternatives) ? row.alternatives : []).map((a) => refId(a?.science)),
      ];
      for (const id of ids) {
        if (id && mongoose.isValidObjectId(id)) into.set(id, (into.get(id) || 0) + 1);
      }
    }
  }
  return into;
}

function writeBackup(ids, dbName) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `elective-sciences-${dbName || "default"}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), db: dbName || null, ids }, null, 2));
  return file;
}

async function backfill({ apply = false, dbName = "", backup = true } = {}) {
  const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
  const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
  const ScienceModel = require("#references/science/science.model");

  const counts = new Map();
  const studyPlans = await StudyPlanModel.find({}).select("blocks").lean();
  for (const sp of studyPlans) collectElectiveScienceIds(sp.blocks, counts);
  const workingPlans = await WorkingPlanModel.find({}).select("semesters").lean();
  for (const wp of workingPlans) collectElectiveScienceIds(semesterBlocks(wp.semesters), counts);

  const ids = [...counts.keys()];
  const docs = ids.length
    ? await ScienceModel.find({ _id: { $in: ids } }).select("_id scienceCode title active isElective").lean()
    : [];
  const pending = docs.filter((d) => d.isElective !== true);

  const result = {
    studyPlans: studyPlans.length,
    workingPlans: workingPlans.length,
    referenced: ids.length,
    missingInCatalog: ids.length - docs.length,
    alreadyFlagged: docs.length - pending.length,
    toFlag: pending.map((d) => ({
      id: String(d._id),
      code: d.scienceCode || "",
      title: d.title || "",
      active: d.active !== false,
      uses: counts.get(String(d._id)) || 0,
    })),
    changed: 0,
    backupFile: null,
  };

  if (apply && pending.length > 0) {
    if (backup) result.backupFile = writeBackup(result.toFlag.map((d) => d.id), dbName);
    const res = await ScienceModel.updateMany(
      { _id: { $in: pending.map((d) => d._id) }, isElective: { $ne: true } },
      { $set: { isElective: true } },
    );
    result.changed = res?.modifiedCount ?? res?.nModified ?? 0;
  }
  return result;
}

async function revert({ file }) {
  const ScienceModel = require("#references/science/science.model");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = (Array.isArray(data?.ids) ? data.ids : []).filter((id) => mongoose.isValidObjectId(id));
  if (ids.length === 0) return { ids: 0, changed: 0 };
  const res = await ScienceModel.updateMany({ _id: { $in: ids } }, { $unset: { isElective: "" } });
  return { ids: ids.length, changed: res?.modifiedCount ?? res?.nModified ?? 0 };
}

function printReport(result, apply) {
  line("═");
  log(`  BACKFILL ELECTIVE SCIENCES — ${apply ? "YOZISH (--apply)" : "DRY-RUN (yozilmadi)"}`);
  line("═");
  for (const d of result.toFlag) {
    log(`  · ${d.code || "(kodsiz)"} — ${d.title}${d.active ? "" : " [faol emas]"} · ${d.uses} marta`);
  }
  line();
  log(`  Ko'rilgan o'quv reja     : ${result.studyPlans}`);
  log(`  Ko'rilgan ishchi reja    : ${result.workingPlans}`);
  log(`  Tanlov qatorlaridagi fan : ${result.referenced}`);
  log(`  Katalogda topilmadi      : ${result.missingInCatalog}`);
  log(`  Allaqachon belgili       : ${result.alreadyFlagged}`);
  log(`  Belgilanadigan           : ${result.toFlag.length}`);
  if (apply) log(`  Yozildi                  : ${result.changed}`);
  if (result.backupFile) log(`  Zaxira                   : ${result.backupFile}`);
  line("═");
  if (!apply && result.toFlag.length > 0) log("  Yozish uchun: --apply bayrog'i bilan qayta yurgizing.");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));
  const revertArg = process.argv.find((a) => a.startsWith("--revert="));
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const dbName = dbArg ? dbArg.slice("--db=".length) : "";
  const uri = dbName
    ? process.env.MONGO_HOST.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`)
    : process.env.MONGO_HOST;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    if (revertArg) {
      const r = await revert({ file: revertArg.slice("--revert=".length) });
      log(`  ORQAGA QAYTARISH: zaxirada ${r.ids} ta fan, o'zgardi ${r.changed} ta.`);
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

module.exports = { collectElectiveScienceIds, semesterBlocks, refId, backfill, revert };
