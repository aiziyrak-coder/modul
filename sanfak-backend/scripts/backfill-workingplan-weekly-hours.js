"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  resolveWeeklyHours,
} = require("#modules/4.02-studyLoad/_services/semesterBreakdown");
const {
  _getCourseKeys: getCourseKeys,
} = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.controller");
const {
  findScienceInPlan: findScienceHit,
} = require("#modules/4.02-studyLoad/_services/scienceProgramMeta");
const { LOCKED_STATUSES } = require("#modules/4.02-studyLoad/_shared/editableStatus");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const ROW_STATUS = {
  ALREADY: "already",
  FILLED: "filled",
  NO_MATCH: "noMatch",
  NO_SOURCE: "noSource",
};

const DOC_SKIP = {
  NO_SCHEDULE: "noSchedule",
  NO_COURSE: "noCourse",
  NO_PLAN: "noPlan",
};

const SP_SKIP = {
  NO_POINTER: "noPointer",
  AMBIGUOUS: "ambiguous",
  NO_MATCH: "noMatch",
  NO_SOURCE: "noSource",
};

const emptyRowStat = () => ({
  [ROW_STATUS.ALREADY]: 0,
  [ROW_STATUS.FILLED]: 0,
  [ROW_STATUS.NO_MATCH]: 0,
  [ROW_STATUS.NO_SOURCE]: 0,
});

const toGlobalSemesterKey = (courseNum, localKey) => {
  const idx = Number(localKey) - 1;
  if (!Number.isInteger(idx) || idx < 0) return null;
  const keys = getCourseKeys(Number(courseNum));
  return keys[idx] != null ? String(keys[idx]) : null;
};

const indexPlanSciences = (plan) => {
  const byScience = new Map();
  const byCode = new Map();
  const dupCodes = new Set();

  for (const block of plan.blocks || []) {
    for (const sci of block.sciences || []) {
      if (sci.science) byScience.set(String(sci.science), sci);
      if (sci.code) {
        if (byCode.has(sci.code)) dupCodes.add(sci.code);
        else byCode.set(sci.code, sci);
      }
    }
  }
  for (const c of dupCodes) byCode.delete(c);
  return { byScience, byCode };
};

const matchSource = (sci, idx) => {
  if (sci.science && idx.byScience.has(String(sci.science))) {
    return idx.byScience.get(String(sci.science));
  }
  if (sci.code && idx.byCode.has(sci.code)) return idx.byCode.get(sci.code);
  return null;
};

const applyRowFill = (sci, srcSem) => {
  if (Number(sci.weeklyHours) > 0) return ROW_STATUS.ALREADY;
  if (!srcSem) return ROW_STATUS.NO_MATCH;

  const value = resolveWeeklyHours(srcSem);
  if (value <= 0) return ROW_STATUS.NO_SOURCE;

  sci.weeklyHours = value;
  return ROW_STATUS.FILLED;
};

const findScienceInPlan = (wp, scienceId) => {
  const hit = findScienceHit(wp, scienceId);
  return hit ? hit.foundSci : null;
};

const fillWorkingPlan = (wp, ws, plan, rowStat) => {
  const idx = indexPlanSciences(plan);
  let changed = 0;

  for (const localKey of Object.keys(wp.semesters || {})) {
    const globalKey = toGlobalSemesterKey(ws.currentCourse, localKey);
    for (const block of (wp.semesters[localKey] || {}).blocks || []) {
      for (const sci of block.sciences || []) {
        const src = globalKey ? matchSource(sci, idx) : null;
        const srcSem = src ? (src.semesters || {})[globalKey] : null;
        const status = applyRowFill(sci, srcSem);
        rowStat[status] += 1;
        if (status === ROW_STATUS.FILLED) changed += 1;
      }
    }
  }
  return changed;
};

const fillScienceProgram = (spg, wpById, allWps, agree) => {
  if (Number(spg.weeklyHours) > 0) return { status: ROW_STATUS.ALREADY };

  if (spg.workingPlan) {
    const wp = wpById.get(String(spg.workingPlan));
    if (!wp) return { status: SP_SKIP.NO_POINTER };
    const sci = findScienceInPlan(wp, spg.science);
    if (!sci) return { status: SP_SKIP.NO_MATCH };
    const value = Number(sci.weeklyHours) || 0;
    if (value <= 0) return { status: SP_SKIP.NO_SOURCE };
    spg.weeklyHours = value;
    return { status: ROW_STATUS.FILLED, value };
  }

  if (!agree) return { status: SP_SKIP.NO_POINTER };

  const values = new Set();
  for (const wp of allWps) {
    const sci = findScienceInPlan(wp, spg.science);
    if (sci) values.add(Number(sci.weeklyHours) || 0);
  }
  if (values.size === 0) return { status: SP_SKIP.NO_MATCH };
  if (values.size > 1) return { status: SP_SKIP.AMBIGUOUS };

  const [value] = [...values];
  if (value <= 0) return { status: SP_SKIP.NO_SOURCE };
  spg.weeklyHours = value;
  return { status: ROW_STATUS.FILLED, value };
};

async function backfill({
  db,
  write = false,
  backup = true,
  dbName = "",
  spAgree = false,
}) {
  const workingPlans = await db.collection("workingplans").find({}).toArray();
  const schedules = await db.collection("workingschedules").find({}).toArray();
  const studyPlans = await db.collection("studyplans").find({}).toArray();
  const programs = await db.collection("scienceprograms").find({}).toArray();

  const wsById = new Map(schedules.map((w) => [String(w._id), w]));
  const planById = new Map(studyPlans.map((p) => [String(p._id), p]));

  const plansByLp = new Map();
  for (const p of studyPlans) {
    const key = String(p.learningProcess);
    if (!plansByLp.has(key)) plansByLp.set(key, []);
    plansByLp.get(key).push(p);
  }

  const wpStat = {
    docs: workingPlans.length,
    changedDocs: 0,
    linkDirect: 0,
    linkViaLearningProcess: 0,
    skip: {
      [DOC_SKIP.NO_SCHEDULE]: 0,
      [DOC_SKIP.NO_COURSE]: 0,
      [DOC_SKIP.NO_PLAN]: 0,
    },
    rows: emptyRowStat(),
    lockedTouched: {},
  };
  const wpUpdates = [];

  for (const wp of workingPlans) {
    const ws = wsById.get(String(wp.workingSchedule));
    if (!ws) {
      wpStat.skip[DOC_SKIP.NO_SCHEDULE] += 1;
      continue;
    }
    if (!Number(ws.currentCourse)) {
      wpStat.skip[DOC_SKIP.NO_COURSE] += 1;
      continue;
    }

    let plan = wp.studyPlan ? planById.get(String(wp.studyPlan)) : null;
    let viaLp = false;
    if (!plan) {
      const candidates = plansByLp.get(String(ws.learningProcess)) || [];
      if (candidates.length === 1) {
        plan = candidates[0];
        viaLp = true;
      }
    }
    if (!plan) {
      wpStat.skip[DOC_SKIP.NO_PLAN] += 1;
      continue;
    }
    if (viaLp) wpStat.linkViaLearningProcess += 1;
    else wpStat.linkDirect += 1;

    const changed = fillWorkingPlan(wp, ws, plan, wpStat.rows);
    if (changed) {
      wpStat.changedDocs += 1;
      const status = ws.status || "—";
      wpStat.lockedTouched[status] = (wpStat.lockedTouched[status] || 0) + 1;
      wpUpdates.push({ _id: wp._id, semesters: wp.semesters, changed, status });
    }
  }

  const wpById = new Map(workingPlans.map((w) => [String(w._id), w]));
  const spStat = {
    docs: programs.length,
    changedDocs: 0,
    [ROW_STATUS.ALREADY]: 0,
    [ROW_STATUS.FILLED]: 0,
    [SP_SKIP.NO_POINTER]: 0,
    [SP_SKIP.AMBIGUOUS]: 0,
    [SP_SKIP.NO_MATCH]: 0,
    [SP_SKIP.NO_SOURCE]: 0,
    lockedTouched: {},
  };
  const spUpdates = [];

  for (const spg of programs) {
    const { status } = fillScienceProgram(spg, wpById, workingPlans, spAgree);
    spStat[status] += 1;
    if (status === ROW_STATUS.FILLED) {
      spStat.changedDocs += 1;
      const st = spg.status || "—";
      spStat.lockedTouched[st] = (spStat.lockedTouched[st] || 0) + 1;
      spUpdates.push({ _id: spg._id, weeklyHours: spg.weeklyHours, status: st });
    }
  }

  const result = {
    wpStat,
    spStat,
    wpUpdates,
    spUpdates,
    totalFilled: wpStat.rows[ROW_STATUS.FILLED] + spStat[ROW_STATUS.FILLED],
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
      `backfill-workingplan-weekly-hours-${stamp}.json`,
    );
    const snapshot = {
      createdAt: stamp,
      db: dbName,
      workingplans: await db
        .collection("workingplans")
        .find({ _id: { $in: wpUpdates.map((u) => u._id) } })
        .toArray(),
      scienceprograms: await db
        .collection("scienceprograms")
        .find({ _id: { $in: spUpdates.map((u) => u._id) } })
        .toArray(),
    };
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 1));
    result.backupFile = backupFile;
  }

  let workingplans = 0;
  for (const u of wpUpdates) {
    const r = await db
      .collection("workingplans")
      .updateOne({ _id: u._id }, { $set: { semesters: u.semesters } });
    workingplans += r.modifiedCount;
  }
  let scienceprograms = 0;
  for (const u of spUpdates) {
    const r = await db
      .collection("scienceprograms")
      .updateOne({ _id: u._id }, { $set: { weeklyHours: u.weeklyHours } });
    scienceprograms += r.modifiedCount;
  }

  result.written = { workingplans, scienceprograms };
  return result;
}

const lockedSummary = (touched) => {
  const locked = LOCKED_STATUSES.reduce((s, k) => s + (touched[k] || 0), 0);
  const all = Object.entries(touched)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return { locked, all: all || "—" };
};

function printReport(result, { dry, dbName, spAgree }) {
  const { wpStat, spStat, totalFilled } = result;
  const rows = wpStat.rows;
  const checked =
    rows[ROW_STATUS.ALREADY] +
    rows[ROW_STATUS.FILLED] +
    rows[ROW_STATUS.NO_MATCH] +
    rows[ROW_STATUS.NO_SOURCE];

  log();
  line("═");
  log(
    `  weeklyHours BACKFILL #2 (workingplans + scienceprograms) — rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`,
  );
  log(`  Baza: ${dbName}${spAgree ? "   [--sp-agree YOQILGAN]" : ""}`);
  line("═");

  log();
  log(
    `  1-FAZA · WORKINGPLANS — hujjat: ${wpStat.docs}, o'zgaradigan hujjat: ${wpStat.changedDocs}`,
  );
  line();
  log(`    manba reja: to'g'ridan-to'g'ri ko'rsatkich : ${wpStat.linkDirect}`);
  log(
    `    manba reja: learningProcess orqali (yagona) : ${wpStat.linkViaLearningProcess}`,
  );
  log(
    `    ⏭  o'tkazildi — manba reja aniqlanmadi      : ${wpStat.skip[DOC_SKIP.NO_PLAN]}`,
  );
  log(
    `    ⏭  o'tkazildi — workingSchedule yo'q        : ${wpStat.skip[DOC_SKIP.NO_SCHEDULE]}`,
  );
  log(
    `    ⏭  o'tkazildi — currentCourse yo'q          : ${wpStat.skip[DOC_SKIP.NO_COURSE]}`,
  );
  log();
  log(`    tekshirilgan fan qatori            : ${checked}`);
  log(`    ✅ to'ldiriladi                     : ${rows[ROW_STATUS.FILLED]}`);
  log(`    ⏭  allaqachon to'ldirilgan (MERGE)  : ${rows[ROW_STATUS.ALREADY]}`);
  log(`    ❓ manba rejada fan topilmadi       : ${rows[ROW_STATUS.NO_MATCH]}`);
  log(`    ⚠️  manba qiymati 0                  : ${rows[ROW_STATUS.NO_SOURCE]}`);

  const wpLocked = lockedSummary(wpStat.lockedTouched);
  log();
  log(`    tegiladigan hujjat statuslari      : ${wpLocked.all}`);
  log(
    `    shundan QULFLANGAN (${LOCKED_STATUSES.join("/")}) : ${wpLocked.locked}`,
  );

  log();
  log(
    `  2-FAZA · SCIENCEPROGRAMS — hujjat: ${spStat.docs}, o'zgaradigan hujjat: ${spStat.changedDocs}`,
  );
  line();
  log(`    ✅ to'ldiriladi                     : ${spStat[ROW_STATUS.FILLED]}`);
  log(`    ⏭  allaqachon to'ldirilgan (MERGE)  : ${spStat[ROW_STATUS.ALREADY]}`);
  log(
    `    ⏭  workingPlan ko'rsatkichi yo'q    : ${spStat[SP_SKIP.NO_POINTER]}  (taxmin QILINMAYDI)`,
  );
  log(
    `    ⏭  nomzodlar kelishmadi (--sp-agree): ${spStat[SP_SKIP.AMBIGUOUS]}`,
  );
  log(`    ❓ rejada fan qatori yo'q           : ${spStat[SP_SKIP.NO_MATCH]}`);
  log(`    ⚠️  manba qiymati 0                  : ${spStat[SP_SKIP.NO_SOURCE]}`);

  const spLocked = lockedSummary(spStat.lockedTouched);
  log();
  log(`    tegiladigan hujjat statuslari      : ${spLocked.all}`);
  log(
    `    shundan QULFLANGAN (${LOCKED_STATUSES.join("/")}) : ${spLocked.locked}`,
  );

  log();
  line("═");
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(
      `  Yozish uchun: node scripts/backfill-workingplan-weekly-hours.js --write`,
    );
  } else if (!totalFilled) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(
      `  YOZILDI: workingplans ${result.written.workingplans} hujjat · scienceprograms ${result.written.scienceprograms} hujjat`,
    );
  }
  log(
    `  Xulosa: workingplans ${rows[ROW_STATUS.FILLED]} fan qatori · scienceprograms ${spStat[ROW_STATUS.FILLED]} hujjat · qulflangan hujjat ${wpLocked.locked + spLocked.locked}`,
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
  const spAgree = process.argv.includes("--sp-agree");
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

  const result = await backfill({ db, write, dbName, spAgree });
  printReport(result, { dry: !write, dbName, spAgree });

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
  fillWorkingPlan,
  fillScienceProgram,
  applyRowFill,
  toGlobalSemesterKey,
  indexPlanSciences,
  matchSource,
  findScienceInPlan,
  emptyRowStat,
  printReport,
  ROW_STATUS,
  DOC_SKIP,
  SP_SKIP,
};
