"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");
const SCRIPT = "migrate-45-sams-verified";
const COLLECTION = "attendances";
const RESIDENTS = "residents";
const CHUNK_SIZE = 1000;

const TARGET = Object.freeze({ samsVerified: true, session: null });
const MIGRATED = Object.freeze({ samsVerified: false, manualVerified: true, session: null });

const GROUPS = Object.freeze(["wasTrue", "wasFalse", "wasNull", "other"]);
const GROUP_MANUAL = Object.freeze({
  wasTrue: true,
  wasFalse: false,
  wasNull: { $type: "null" },
  other: { $nin: [true, false], $not: { $type: "null" } },
});
const REVERT_UPDATE = Object.freeze({
  wasTrue: { $set: { samsVerified: true } },
  wasFalse: { $set: { samsVerified: true, manualVerified: false } },
  wasNull: { $set: { samsVerified: true, manualVerified: null } },
  other: { $set: { samsVerified: true }, $unset: { manualVerified: "" } },
});

const raw = () => mongoose.connection.db.collection(COLLECTION);
const currentDb = () => mongoose.connection.db.databaseName;

function* chunks(list, size = CHUNK_SIZE) {
  for (let i = 0; i < list.length; i += size) yield list.slice(i, i + size);
}

const groupOf = (manual) => {
  if (manual === true) return "wasTrue";
  if (manual === false) return "wasFalse";
  if (manual === null) return "wasNull";
  return "other";
};

async function survey() {
  const queries = {
    total: {},
    deleted: { deletedAt: { $ne: null } },
    samsTrue: TARGET,
    samsTrueDeleted: { ...TARGET, deletedAt: { $ne: null } },
    samsTrueManualTrue: { ...TARGET, manualVerified: true },
    samsTrueScored: { ...TARGET, score: { $ne: null } },
    samsTrueNoTeacher: { ...TARGET, teacher: null },
    samsTrueSession: { samsVerified: true, session: { $ne: null } },
    manualTrue: { manualVerified: true },
    nonPresentWithEvidence: {
      status: { $ne: "present" },
      $or: [{ samsVerified: true }, { manualVerified: true }],
    },
    presentNoEvidence: {
      status: "present",
      samsVerified: { $ne: true },
      manualVerified: { $ne: true },
    },
  };
  const keys = Object.keys(queries);
  const counts = await Promise.all(keys.map((k) => raw().countDocuments(queries[k])));
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]]));
}

const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.n]));

async function breakdown() {
  const match = { $match: TARGET };
  const [byStatus, byProgram, range] = await Promise.all([
    raw().aggregate([match, { $group: { _id: "$status", n: { $sum: 1 } } }]).toArray(),
    raw()
      .aggregate([
        match,
        { $lookup: { from: RESIDENTS, localField: "resident", foreignField: "_id", as: "r" } },
        {
          $group: {
            _id: { $ifNull: [{ $arrayElemAt: ["$r.program", 0] }, "rezidentsiz"] },
            n: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    raw()
      .aggregate([
        match,
        {
          $group: {
            _id: null,
            minCreatedAt: { $min: "$createdAt" },
            maxCreatedAt: { $max: "$createdAt" },
            maxUpdatedAt: { $max: "$updatedAt" },
          },
        },
      ])
      .toArray(),
  ]);
  return { byStatus: toMap(byStatus), byProgram: toMap(byProgram), range: range[0] || null };
}

async function snapshot() {
  const docs = await raw()
    .find(TARGET, { projection: { _id: 1, manualVerified: 1 } })
    .toArray();
  const plan = Object.fromEntries(GROUPS.map((g) => [g, []]));
  for (const d of docs) plan[groupOf(d.manualVerified)].push(d._id);
  return plan;
}

const planIds = (plan) => GROUPS.flatMap((g) => plan[g] || []);
const planSize = (plan) => planIds(plan).length;

async function applyPlan(plan) {
  const out = { planned: 0, modified: 0, modifiedWasTrue: 0, raced: 0 };
  for (const g of GROUPS) {
    const ids = plan[g] || [];
    let modified = 0;
    for (const chunk of chunks(ids)) {
      const res = await raw().updateMany(
        { _id: { $in: chunk }, ...TARGET, manualVerified: GROUP_MANUAL[g] },
        { $set: { samsVerified: false, manualVerified: true } },
      );
      modified += res.modifiedCount ?? 0;
    }
    out.planned += ids.length;
    out.modified += modified;
    if (g === "wasTrue") out.modifiedWasTrue = modified;
  }
  out.raced = out.planned - out.modified;
  return out;
}

const backupBody = (plan, meta, raced = []) => ({
  collection: COLLECTION,
  script: SCRIPT,
  db: meta.db,
  createdAt: meta.createdAt.toISOString(),
  groups: Object.fromEntries(GROUPS.map((g) => [g, (plan[g] || []).map(String)])),
  raced: raced.map(String),
});

function saveBackup(plan, meta, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = meta.createdAt.toISOString().replace(/[:.]/g, "-");
  const file = path.join(backupDir, `sams-verified-${meta.db || "default"}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(backupBody(plan, meta), null, 2), { flag: "wx" });
  return file;
}

async function pruneRaced(file, plan, meta) {
  const still = new Set();
  for (const chunk of chunks(planIds(plan))) {
    const docs = await raw()
      .find({ _id: { $in: chunk }, ...TARGET }, { projection: { _id: 1 } })
      .toArray();
    for (const d of docs) still.add(String(d._id));
  }
  const kept = Object.fromEntries(
    GROUPS.map((g) => [g, plan[g].filter((id) => !still.has(String(id)))]),
  );
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(backupBody(kept, meta, [...still]), null, 2));
  fs.renameSync(`${file}.tmp`, file);
  return still.size;
}

async function verifyPlanned(plan, applied) {
  const out = { inTarget: 0, noEvidence: 0 };
  for (const chunk of chunks(planIds(plan))) {
    const [inTarget, noEvidence] = await Promise.all([
      raw().countDocuments({ _id: { $in: chunk }, ...TARGET }),
      raw().countDocuments({
        _id: { $in: chunk },
        samsVerified: { $ne: true },
        manualVerified: { $ne: true },
      }),
    ]);
    out.inTarget += inTarget;
    out.noEvidence += noEvidence;
  }
  out.ok = out.inTarget === applied.raced && out.noEvidence === 0;
  return out;
}

async function migrate({ apply = false, backupDir = BACKUP_DIR } = {}) {
  const before = await survey();
  const plan = await snapshot();
  const result = {
    before,
    breakdown: await breakdown(),
    planned: Object.fromEntries(GROUPS.map((g) => [g, plan[g].length])),
    backup: null,
    applied: null,
    after: null,
    invariant: null,
    invariantOk: null,
  };
  if (!apply) return result;

  const meta = { db: currentDb(), createdAt: new Date() };
  if (planSize(plan) > 0) result.backup = saveBackup(plan, meta, backupDir);
  result.applied = await applyPlan(plan);
  if (result.applied.raced > 0) {
    result.applied.pruned = await pruneRaced(result.backup, plan, meta);
  }
  result.after = await survey();
  result.invariant = await verifyPlanned(plan, result.applied);
  result.invariantOk = result.invariant.ok;
  return result;
}

const exitCodeFor = (result, apply) =>
  apply && (result.applied.raced > 0 || !result.invariantOk || result.after.samsTrue !== 0)
    ? 1
    : 0;

function readBackup(file, allowOtherDb) {
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  if (backup.script !== SCRIPT || backup.collection !== COLLECTION) {
    throw new Error(`${file} — bu skriptning zaxirasi emas (script/collection mos emas)`);
  }
  if (Number.isNaN(Date.parse(backup.createdAt))) {
    throw new Error(`${file} — zaxirada createdAt yo'q yoki buzuq`);
  }
  if (backup.db !== currentDb() && !allowOtherDb) {
    throw new Error(
      `${file} — "${backup.db}" bazasining zaxirasi, ulangan baza "${currentDb()}". ` +
        "Ataylab bo'lsa: --allow-other-db",
    );
  }
  return backup;
}

async function revert({ file, allowOtherDb = false }) {
  const backup = readBackup(file, allowOtherDb);
  const untouched = { updatedAt: { $not: { $gte: new Date(backup.createdAt) } } };
  const out = { planned: 0, restored: 0, skipped: 0 };
  for (const g of GROUPS) {
    const ids = (backup.groups?.[g] || []).map((id) => new mongoose.Types.ObjectId(id));
    for (const chunk of chunks(ids)) {
      const res = await raw().updateMany(
        { _id: { $in: chunk }, ...MIGRATED, ...untouched },
        REVERT_UPDATE[g],
      );
      out.restored += res.modifiedCount ?? 0;
    }
    out.planned += ids.length;
  }
  out.skipped = out.planned - out.restored;
  return out;
}

const fmtMap = (m) =>
  Object.entries(m || {})
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ") || "—";
const iso = (d) => (d ? new Date(d).toISOString() : "—");

function printSurvey(b, bd) {
  log(`  Davomat yozuvlari (soft-delete bilan):          ${b.total}  (o'chirilgan: ${b.deleted})`);
  line();
  log(`  NISHON — samsVerified:true, session:null:       ${b.samsTrue}`);
  log(`     holat bo'yicha:   ${fmtMap(bd.byStatus)}`);
  log(`     dastur bo'yicha:  ${fmtMap(bd.byProgram)}`);
  log(`     allaqachon qo'lda tasdiqli:                  ${b.samsTrueManualTrue}`);
  log(`     soft-delete qilingan:                        ${b.samsTrueDeleted}`);
  log(`     ball qo'yilgan:                              ${b.samsTrueScored}`);
  log(`     muallifsiz (teacher: null):                  ${b.samsTrueNoTeacher}`);
  log(`     createdAt:  ${iso(bd.range?.minCreatedAt)} .. ${iso(bd.range?.maxCreatedAt)}`);
  log("     ⚠️ eng so'nggi createdAt yangi kod ishga tushirilganidan (reload) KEYIN bo'lsa — TO'XTANG:");
  log("        samsVerified:true ni hali kimdir yozmoqda (yangi kodda mijoz yoza olmaydi).");
  log(`     eng so'nggi updatedAt: ${iso(bd.range?.maxUpdatedAt)}  (ma'lumot uchun — oddiy tahrir ham yangilaydi)`);
  log(`  Sessiya qatorlari (haqiqiy dalil, TEGILMAYDI):  ${b.samsTrueSession}`);
  line();
  log(`  manualVerified:true (jami):                     ${b.manualTrue}`);
  log(`  ⚠️ present bo'lmagan dalilli qatorlar:          ${b.nonPresentWithEvidence}`);
  log(`  Dalilsiz present (o'zgarmasligi SHART):         ${b.presentNoEvidence}`);
  log("  Xulq neytral: har qatorda (samsVerified || manualVerified) o'zgarmaydi.");
}

function printApplied(result) {
  const { applied: x, after: a, planned: p } = result;
  log(`  ✅ KO'CHIRILDI: ${x.modified} / ${x.planned}` +
    `  (${GROUPS.map((g) => `${g} ${p[g]}`).join(" · ")})`);
  if (x.raced) {
    log(`  🔴 ${x.raced} ta qator shu orada o'zgargan — ko'chmadi. Dry-run → --apply qayta.`);
    log(`     Zaxiradan chiqarildi (hali nishonda): ${x.pruned ?? 0} — keyingi --apply o'z zaxirasiga yozadi.`);
  }
  log(a.samsTrue === 0
    ? "  Qamrov: TO'LIQ (nishondagi samsVerified:true qolmadi)"
    : `  🔴 DIQQAT: ${a.samsTrue} ta samsVerified:true (session:null) qoldi — tekshiring!`);
  const inv = result.invariant;
  log(result.invariantOk
    ? `  Invariant: OK (rejadagi qatorlar: nishonda ${inv.inTarget} = raced, dalilsiz 0)`
    : `  🔴 INVARIANT BUZILDI — rejadagi qatorlar: nishonda ${inv.inTarget} (kutilgan ${x.raced}),` +
      ` dalilsiz ${inv.noEvidence} (kutilgan 0) — tekshiring!`);
  log(`  Global (ma'lumot uchun): dalilsiz present ${a.presentNoEvidence}, manualVerified:true ${a.manualTrue}`);
  if (result.backup) log(`  Zaxira: ${result.backup}  ← prod zaxiralari bilan SAQLANG`);
}

function printReport(result, apply, dbName) {
  line("═");
  log("  4.5 — MIJOZ YOZGAN samsVerified → manualVerified");
  log(`  Baza: ${dbName}`);
  line("═");
  printSurvey(result.before, result.breakdown);
  line();
  if (apply) printApplied(result);
  else log(`  DRY-RUN — hech narsa yozilmadi. ${result.before.samsTrue} ta qator kutilmoqda. Yozish: --apply`);
  line("═");
}

function parseArgs(argv) {
  const value = (flag) => {
    const a = argv.find((x) => x.startsWith(`${flag}=`));
    return a ? a.slice(flag.length + 1) : null;
  };
  return {
    apply: argv.includes("--apply"),
    allowOtherDb: argv.includes("--allow-other-db"),
    dbName: value("--db"),
    revertFile: value("--revert"),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!process.env.MONGO_HOST) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const opts = { serverSelectionTimeoutMS: 5000, autoIndex: false };
  if (args.dbName) opts.dbName = args.dbName;
  await mongoose.connect(process.env.MONGO_HOST, opts);
  const dbName = mongoose.connection.db.databaseName;
  try {
    if (args.revertFile) {
      const r = await revert({ file: args.revertFile, allowOtherDb: args.allowOtherDb });
      log(`  Baza: ${dbName}`);
      log(`  QAYTARISH: zaxirada ${r.planned}, qaytarildi ${r.restored}, tegilmadi ${r.skipped}.`);
      if (r.skipped) log("  ⚠️ Tegilmaganlar zaxiradan keyin o'zgargan yoki tahrirlangan (inson yoki server yozgan).");
      return;
    }
    const result = await migrate({ apply: args.apply });
    printReport(result, args.apply, dbName);
    process.exitCode = exitCodeFor(result, args.apply);
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

module.exports = {
  COLLECTION,
  CHUNK_SIZE,
  TARGET,
  survey,
  breakdown,
  snapshot,
  applyPlan,
  migrate,
  exitCodeFor,
  revert,
};
