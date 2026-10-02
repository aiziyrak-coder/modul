"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  buildQuotaSlotRow,
  isEmptySlotRow,
} = require("#modules/4.02-studyLoad/_shared/electiveSlotRow");
const { isElectiveBlock } = require("#modules/4.02-studyLoad/_shared/electiveBlock");
const { isLocked } = require("#modules/4.02-studyLoad/_shared/editableStatus");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

const globalSemKeyOf = (courseNum, localSemKey) =>
  String(2 * (Number(courseNum) - 1) + Number(localSemKey));

const planRankOf = (planBlocks, blockCode) => {
  const i = planBlocks.findIndex((b) => b && b.blockCode === blockCode);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

function insertBlockInPlanOrder(blocks, newBlock, planBlocks) {
  const rank = planRankOf(planBlocks, newBlock.blockCode);
  const at = blocks.findIndex((b) => planRankOf(planBlocks, b.blockCode) > rank);
  if (at === -1) blocks.push(newBlock);
  else blocks.splice(at, 0, newBlock);
}

function addSlotToSemester({ semData, planBlock, globalSemKey, planBlocks }) {
  const blocks = semData.blocks || (semData.blocks = []);
  const target = blocks.find((b) => b && b.blockCode === planBlock.blockCode);
  if (target && (target.sciences || []).some(isEmptySlotRow)) return null;

  const slot = buildQuotaSlotRow(planBlock, globalSemKey, {
    existingRows: target ? target.sciences : [],
  });
  if (!slot) return null;

  if (target) {
    target.sciences.push(slot);
    return { blockCode: planBlock.blockCode, credit: slot.totalCredit, hour: slot.weeklyHours, createdBlock: false };
  }
  insertBlockInPlanOrder(
    blocks,
    {
      blockCode: planBlock.blockCode,
      serialNumber: planBlock.serialNumber || null,
      code: planBlock.code || null,
      title: planBlock.title || null,
      sciences: [slot],
    },
    planBlocks,
  );
  return { blockCode: planBlock.blockCode, credit: slot.totalCredit, hour: slot.weeklyHours, createdBlock: true };
}

function backfillSemesters(semesters, planBlocks, courseNum) {
  const added = [];
  const blocksOfPlan = Array.isArray(planBlocks) ? planBlocks : [];
  const electiveBlocks = blocksOfPlan.filter(isElectiveBlock);
  const entries = semesters instanceof Map ? [...semesters.entries()] : Object.entries(semesters || {});

  for (const [localSemKey, semData] of entries) {
    if (!semData) continue;
    const globalSemKey = globalSemKeyOf(courseNum, localSemKey);
    for (const planBlock of electiveBlocks) {
      const res = addSlotToSemester({ semData, planBlock, globalSemKey, planBlocks: blocksOfPlan });
      if (res) added.push({ semKey: localSemKey, globalSemKey, ...res });
    }
  }
  return { added, changed: added.length > 0 };
}

function writeBackup(snapshot, dbName) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(
    BACKUP_DIR,
    `backfill-elective-slots-${dbName || "db"}-${Date.now()}.json`,
  );
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 1));
  return file;
}

async function backfill({ apply = false, backup = true, dbName = "" } = {}) {
  const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
  const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
  const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
  require("#references/direction/direction.model");

  const result = { scanned: 0, skippedLocked: 0, skippedNoPlan: 0, changed: 0, rows: 0, backupFile: null, details: [] };
  const schedules = await WorkingScheduleModel.find({})
    .select("_id status currentCourse direction")
    .populate("direction", "title")
    .lean();
  const byId = new Map(schedules.map((s) => [String(s._id), s]));

  const plans = await WorkingPlanModel.find({}).exec();
  const snapshot = [];

  for (const plan of plans) {
    const schedule = byId.get(String(plan.workingSchedule));
    if (!schedule) continue;
    result.scanned += 1;
    if (isLocked(schedule.status)) {
      result.skippedLocked += 1;
      continue;
    }
    const studyPlan = plan.studyPlan
      ? await StudyPlanModel.findById(plan.studyPlan).select("blocks").lean()
      : null;
    if (!studyPlan) {
      result.skippedNoPlan += 1;
      continue;
    }
    const before = JSON.parse(JSON.stringify(plan.semesters));
    const { added, changed } = backfillSemesters(plan.semesters, studyPlan.blocks, schedule.currentCourse);
    if (!changed) continue;

    result.changed += 1;
    result.rows += added.length;
    result.details.push({
      plan: String(plan._id),
      direction: schedule.direction?.title || "-",
      course: schedule.currentCourse,
      status: schedule.status,
      added,
    });
    snapshot.push({ _id: String(plan._id), semesters: before });
    if (apply) {
      plan.markModified("semesters");
      await plan.save();
    }
  }

  if (apply && backup && snapshot.length > 0) result.backupFile = writeBackup(snapshot, dbName);
  return result;
}

function printReport(result, apply) {
  line("═");
  log(`  BACKFILL ELECTIVE SLOTS — ${apply ? "YOZISH (--apply)" : "DRY-RUN (yozilmadi)"}`);
  line("═");
  for (const d of result.details) {
    log(`  · ${d.direction} | ${d.course}-kurs | ${d.status} | reja ${d.plan.slice(-6)}`);
    for (const a of d.added) {
      log(
        `      s${a.semKey} (global ${a.globalSemKey}) ${a.blockCode}: ` +
          `${a.credit} kredit / ${a.hour} soat${a.createdBlock ? " — blok qo'shildi" : ""}`,
      );
    }
  }
  line();
  log(`  Ko'rilgan ishchi reja : ${result.scanned}`);
  log(`  Qulflangan (skip)     : ${result.skippedLocked}   (in_review / approved — tegilmadi)`);
  log(`  Manba reja yo'q (skip): ${result.skippedNoPlan}`);
  log(`  O'zgargan reja        : ${result.changed}`);
  log(`  Qo'shilgan slot qatori: ${result.rows}`);
  if (result.backupFile) log(`  Zaxira                : ${result.backupFile}`);
  line("═");
  if (!apply && result.changed > 0) log("  Yozish uchun: --apply bayrog'i bilan qayta yurgizing.");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));
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

module.exports = { backfillSemesters, insertBlockInPlanOrder, globalSemKeyOf, backfill };
