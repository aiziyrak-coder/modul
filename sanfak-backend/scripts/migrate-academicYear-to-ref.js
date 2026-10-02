require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const CREATE_MISSING = args.includes("--create");
const COLLECTION_ARG = args.find((a) => a.startsWith("--collection="));
const TARGET_COLLECTION = COLLECTION_ARG ? COLLECTION_ARG.split("=")[1] : null;

const MONGO_URI = process.env.MONGO_HOST;
if (!MONGO_URI) {
  console.error("✗ MONGO_HOST env variable yo'q. .env faylni tekshiring.");
  process.exit(1);
}

const log = (...args) => console.log(...args);
const warn = (...args) => console.warn("⚠", ...args);
const err = (...args) => console.error("✗", ...args);

function normalizeTitle(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (/^\d{4}\/\d{4}$/.test(t)) return t;
  let m = t.match(/^(\d{4})\s*[-/–—]\s*(\d{4})$/);
  if (m) return `${m[1]}/${m[2]}`;
  m = t.match(/^(\d{4})\s*[-/–—]\s*(\d{2})$/);
  if (m) {
    const start = parseInt(m[1], 10);
    const endShort = parseInt(m[2], 10);
    const startShort = start % 100;
    const endFull =
      endShort < startShort
        ? Math.floor(start / 100 + 1) * 100 + endShort
        : Math.floor(start / 100) * 100 + endShort;
    return `${start}/${endFull}`;
  }
  m = t.match(/^(\d{4})$/);
  if (m) {
    const start = parseInt(m[1], 10);
    return `${start}/${start + 1}`;
  }
  return null;
}

async function migrateCollection(modelName, ModelDef, AcademicYearModel) {
  log(`\n── ${modelName} ─────────────────────────────────────────────────`);
  const total = await ModelDef.countDocuments({});
  log(`  Jami hujjatlar: ${total}`);

  if (!total) return { total: 0, updated: 0, skipped: 0, missing: 0 };

  const docs = await ModelDef.find({}, { academicYear: 1 }).lean();

  let updated = 0;
  let skipped = 0;
  let missing = 0;
  const missingTitles = new Set();

  for (const doc of docs) {
    const ay = doc.academicYear;
    if (!ay) {
      skipped++;
      continue;
    }

    if (
      typeof ay === "object" &&
      mongoose.Types.ObjectId.isValid(ay) &&
      !(typeof ay === "string")
    ) {
      skipped++;
      continue;
    }

    if (typeof ay === "string" && /^[a-f0-9]{24}$/i.test(ay)) {
      if (!DRY_RUN) {
        await ModelDef.updateOne(
          { _id: doc._id },
          { $set: { academicYear: new mongoose.Types.ObjectId(ay) } },
        );
      }
      updated++;
      continue;
    }

    const norm = normalizeTitle(ay);
    if (!norm) {
      warn(`  [${doc._id}] academicYear formati noto'g'ri: "${ay}" — skip`);
      skipped++;
      continue;
    }

    let yearDoc = await AcademicYearModel.findOne({ title: norm }).lean();

    if (!yearDoc) {
      if (CREATE_MISSING) {
        if (!DRY_RUN) {
          yearDoc = await AcademicYearModel.create({ title: norm });
          log(`  + AcademicYear yaratildi: "${norm}" → ${yearDoc._id}`);
        } else {
          log(`  [DRY] AcademicYear yaratiladi: "${norm}"`);
        }
      } else {
        missingTitles.add(norm);
        missing++;
        continue;
      }
    }

    if (yearDoc) {
      if (!DRY_RUN) {
        await ModelDef.updateOne(
          { _id: doc._id },
          { $set: { academicYear: yearDoc._id } },
        );
      }
      updated++;
    }
  }

  log(`  ✓ Yangilandi:  ${updated}`);
  log(`  • O'tkazildi: ${skipped}  (allaqachon ObjectId yoki bo'sh)`);
  log(`  • Topilmadi:  ${missing}`);

  if (missingTitles.size > 0) {
    log(`\n  Topilmagan title'lar (--create bilan yaratish mumkin):`);
    for (const t of missingTitles) log(`    - "${t}"`);
  }

  return { total, updated, skipped, missing };
}

async function main() {
  log(
    `\n═══ academicYear String → ObjectId migratsiya ═══${
      DRY_RUN ? "  [DRY-RUN]" : ""
    }`,
  );
  log(`  CREATE_MISSING: ${CREATE_MISSING}`);
  if (TARGET_COLLECTION) log(`  TARGET: ${TARGET_COLLECTION}`);

  await mongoose.connect(MONGO_URI);
  log(`✓ Ulanishildi: ${MONGO_URI}`);

  const modelsDir = path.join(__dirname, "..", "src", "models");
  const AcademicYearModel = require(
    path.join(modelsDir, "_references", "academicYear.model.js"),
  );

  const summary = {};

  if (!TARGET_COLLECTION || TARGET_COLLECTION === "workload") {
    const Workload = require(
      path.join(modelsDir, "4.02-studyLoad", "workload.model.js"),
    );
    summary.workload = await migrateCollection(
      "workload",
      Workload,
      AcademicYearModel,
    );
  }

  if (!TARGET_COLLECTION || TARGET_COLLECTION === "workloadDistribution") {
    const WorkloadDistribution = require(
      path.join(modelsDir, "4.02-studyLoad", "workloadDistribution.model.js"),
    );
    summary.workloadDistribution = await migrateCollection(
      "workloadDistribution",
      WorkloadDistribution,
      AcademicYearModel,
    );
  }

  const OTHER_COLLECTIONS = [
    {
      name: "scienceProgram",
      file: ["4.02-studyLoad", "scienceProgram.model.js"],
    },
    {
      name: "personalWorkPlan",
      file: ["4.03-teacher", "personalWorkPlan.model.js"],
    },
    {
      name: "economicContract",
      file: ["4.10-scientificDept", "economicContract.model.js"],
    },
    {
      name: "departmentWorkPlan",
      file: ["4.10-scientificDept", "departmentWorkPlan.model.js"],
    },
    {
      name: "indicatorSubmission",
      file: ["4.12-qualityAssurance", "indicatorSubmission.model.js"],
    },
    {
      name: "practiceContract",
      file: ["4.13-practice", "practice.model.js"],
    },
    {
      name: "gradebook",
      file: ["_shared", "grade", "gradebook.model.js"],
    },
    {
      name: "exam",
      file: ["_shared", "grade", "exam.model.js"],
    },
    {
      name: "studentAttendance",
      file: ["_shared", "student", "attendance.model.js"],
    },
    {
      name: "schedule",
      file: ["_shared", "schedule", "schedule.model.js"],
    },
    {
      name: "report",
      file: ["_system", "report", "report.model.js"],
    },
  ];

  for (const c of OTHER_COLLECTIONS) {
    if (TARGET_COLLECTION && TARGET_COLLECTION !== c.name) continue;
    try {
      const Model = require(path.join(modelsDir, ...c.file));
      summary[c.name] = await migrateCollection(c.name, Model, AcademicYearModel);
    } catch (e) {
      warn(`${c.name} skip — yuklab bo'lmadi: ${e.message}`);
    }
  }

  log(`\n═══ Yakuniy hisobot ═══`);
  for (const [name, s] of Object.entries(summary)) {
    log(`  ${name}: ${s.updated}/${s.total} yangilandi`);
  }
  if (DRY_RUN) {
    log(`\n  [DRY-RUN] Hech narsa yozilmadi. To'g'ri natijaga ishonsangiz, --dry-run`);
    log(`  bayrog'ini olib tashlab qayta ishga tushiring.`);
  }

  await mongoose.disconnect();
  log(`\n✓ Tayyor.`);
}

main().catch((e) => {
  err("Migratsiya xatosi:", e.message);
  console.error(e);
  process.exit(1);
});
