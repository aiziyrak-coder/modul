"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  META_FIELDS,
  findScienceInPlan,
  buildScienceProgramMeta,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");
const {
  LOCKED_STATUSES,
} = require("#modules/4.02-studyLoad/_shared/editableStatus");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const PLAN_SPECIFIC_FIELDS = Object.freeze(["academicYear"]);
const AGREEMENT_FIELDS = Object.freeze(
  META_FIELDS.filter((f) => !PLAN_SPECIFIC_FIELDS.includes(f)),
);

const DOC_STATUS = {
  FILLED: "filled",
  ALREADY: "already",
  NO_POINTER: "noPointer",
  NO_MATCH: "noMatch",
  AMBIGUOUS: "ambiguous",
};

const emptyStat = () => ({
  docs: 0,
  [DOC_STATUS.FILLED]: 0,
  [DOC_STATUS.ALREADY]: 0,
  [DOC_STATUS.NO_POINTER]: 0,
  [DOC_STATUS.NO_MATCH]: 0,
  [DOC_STATUS.AMBIGUOUS]: 0,
  linkDirect: 0,
  linkAgreed: 0,
  byField: META_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 0 }), {}),
  lockedTouched: {},
});

const isEmptyValue = (v) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0);

const canonicalMeta = (meta) =>
  JSON.stringify(
    AGREEMENT_FIELDS.map((f) => {
      const v = meta[f];
      if (v === null || v === undefined) return null;
      if (Array.isArray(v)) return v.map((x) => ({ ...x }));
      return typeof v === "object" ? String(v) : v;
    }),
  );

const metaFromPlan = (wp, scienceId, scheduleById) => {
  const hit = findScienceInPlan(wp, scienceId);
  if (!hit) return null;

  const schedule = scheduleById.get(String(wp.workingSchedule)) || null;
  const hydrated = schedule ? { ...wp, workingSchedule: schedule } : wp;

  return buildScienceProgramMeta({
    workingPlan: hydrated,
    foundSci: hit.foundSci,
    foundBlock: hit.foundBlock,
    semesterKey: hit.firstSemester,
  });
};

const resolveMeta = (spg, { wpById, allWps, scheduleById, strict }) => {
  if (spg.workingPlan) {
    const wp = wpById.get(String(spg.workingPlan));
    const meta = wp ? metaFromPlan(wp, spg.science, scheduleById) : null;
    if (!meta) return { status: DOC_STATUS.NO_MATCH };
    return { status: DOC_STATUS.FILLED, meta, via: "direct" };
  }

  if (strict) return { status: DOC_STATUS.NO_POINTER };

  const metas = [];
  for (const wp of allWps) {
    const meta = metaFromPlan(wp, spg.science, scheduleById);
    if (meta) metas.push(meta);
  }
  if (metas.length === 0) return { status: DOC_STATUS.NO_MATCH };

  const keys = new Set(metas.map(canonicalMeta));
  if (keys.size > 1) return { status: DOC_STATUS.AMBIGUOUS };

  const meta = { ...metas[0] };
  for (const f of PLAN_SPECIFIC_FIELDS) meta[f] = null;

  return { status: DOC_STATUS.FILLED, meta, via: "agreed" };
};

const buildPatch = (spg, meta) => {
  const patch = {};
  for (const field of META_FIELDS) {
    if (!isEmptyValue(spg[field])) continue;
    if (isEmptyValue(meta[field])) continue;
    patch[field] = meta[field];
  }
  return patch;
};

async function backfill({
  db,
  write = false,
  backup = true,
  dbName = "",
  strict = false,
}) {
  const programs = await db.collection("scienceprograms").find({}).toArray();
  const workingPlans = await db.collection("workingplans").find({}).toArray();
  const schedules = await db.collection("workingschedules").find({}).toArray();

  const wpById = new Map(workingPlans.map((w) => [String(w._id), w]));
  const scheduleById = new Map(schedules.map((s) => [String(s._id), s]));

  const stat = emptyStat();
  stat.docs = programs.length;
  const updates = [];

  for (const spg of programs) {
    const resolved = resolveMeta(spg, {
      wpById,
      allWps: workingPlans,
      scheduleById,
      strict,
    });

    if (resolved.status !== DOC_STATUS.FILLED) {
      stat[resolved.status] += 1;
      continue;
    }

    const patch = buildPatch(spg, resolved.meta);
    if (!Object.keys(patch).length) {
      stat[DOC_STATUS.ALREADY] += 1;
      continue;
    }

    stat[DOC_STATUS.FILLED] += 1;
    if (resolved.via === "direct") stat.linkDirect += 1;
    else stat.linkAgreed += 1;
    for (const f of Object.keys(patch)) stat.byField[f] += 1;

    const st = spg.status || "—";
    stat.lockedTouched[st] = (stat.lockedTouched[st] || 0) + 1;
    updates.push({ _id: spg._id, patch, status: st });
  }

  const result = {
    stat,
    updates,
    totalFilled: stat[DOC_STATUS.FILLED],
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
      `backfill-scienceprogram-meta-${stamp}.json`,
    );
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      scienceprograms: await db
        .collection("scienceprograms")
        .find({ _id: { $in: updates.map((u) => u._id) } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let scienceprograms = 0;
  for (const u of updates) {
    const r = await db
      .collection("scienceprograms")
      .updateOne({ _id: u._id }, { $set: u.patch });
    scienceprograms += r.modifiedCount;
  }

  result.written = { scienceprograms };
  return result;
}

function printReport(result, { dry, dbName, strict }) {
  const { stat, totalFilled } = result;
  const locked = LOCKED_STATUSES.reduce(
    (s, k) => s + (stat.lockedTouched[k] || 0),
    0,
  );
  const statuses =
    Object.entries(stat.lockedTouched)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "—";

  log();
  line("═");
  log(
    `  142-son §1 META BACKFILL — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`,
  );
  log(`  Baza: ${dbName}${strict ? "   [--strict: kelishuv yo'li O'CHIQ]" : ""}`);
  line("═");

  log();
  log(`  SCIENCEPROGRAMS — hujjat: ${stat.docs}`);
  line();
  log(`    ✅ o'zgaradigan hujjat              : ${stat[DOC_STATUS.FILLED]}`);
  log(`       ├─ workingPlan ko'rsatkichi orqali: ${stat.linkDirect}`);
  log(`       └─ nomzodlar kelishuvi orqali     : ${stat.linkAgreed}`);
  log(`    ⏭  hamma maydon allaqachon to'la    : ${stat[DOC_STATUS.ALREADY]}`);
  log(
    `    ⏭  nomzodlar kelishmadi (to'plam)   : ${stat[DOC_STATUS.AMBIGUOUS]}`,
  );
  log(
    `    ⏭  ko'rsatkich yo'q (--strict)      : ${stat[DOC_STATUS.NO_POINTER]}`,
  );
  log(`    ❓ birorta rejada fan yo'q          : ${stat[DOC_STATUS.NO_MATCH]}`);

  log();
  log(`  HAR MAYDON BO'YICHA (nechta hujjatda to'ladi)`);
  line();
  for (const f of META_FIELDS) {
    const n = stat.byField[f];
    const note = PLAN_SPECIFIC_FIELDS.includes(f)
      ? "   (kelishuv yo'lida YOZILMAYDI — reja xossasi)"
      : n
        ? ""
        : "   (—)";
    log(`    ${f.padEnd(20)} : ${String(n).padStart(4)}${note}`);
  }
  log(`    ${"language".padEnd(20)} :    —   (TEGILMAYDI — manbasi yo'q)`);

  log();
  log(`  tegiladigan hujjat statuslari       : ${statuses}`);
  log(`  shundan QULFLANGAN (${LOCKED_STATUSES.join("/")}) : ${locked}`);

  log();
  line("═");
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(`  Yozish uchun: node scripts/backfill-scienceprogram-meta.js --write`);
  } else if (!totalFilled) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: scienceprograms ${result.written.scienceprograms} hujjat`);
  }
  log(
    `  Xulosa: ${totalFilled} hujjat · qulflangan ${locked} · kelishmagan ${stat[DOC_STATUS.AMBIGUOUS]}`,
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
  const strict = process.argv.includes("--strict");
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

  const result = await backfill({ db, write, dbName, strict });
  printReport(result, { dry: !write, dbName, strict });

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
  resolveMeta,
  buildPatch,
  metaFromPlan,
  canonicalMeta,
  isEmptyValue,
  emptyStat,
  printReport,
  DOC_STATUS,
  AGREEMENT_FIELDS,
  PLAN_SPECIFIC_FIELDS,
};
