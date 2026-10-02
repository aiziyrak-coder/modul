"use strict";

const mongoose = require("mongoose");
const { connectDb, writeBackup, DEFAULT_BACKUP_DIR, log, line } = require("./_lib");
const { normalizeTitle } = require("#references/_services/academicYearResolver");

const SCRIPT_NAME = "merge-academicyear-duplicates";

const REF_SOURCES = [
  { collection: "reports", field: "academicYear", model: "report" },
  { collection: "studentattendances", field: "academicYear", model: "studentAttendance" },
  { collection: "practicestudents", field: "academicYear", model: "practiceStudent" },
  { collection: "schedules", field: "academicYear", model: "schedule" },
  { collection: "gradebooks", field: "academicYear", model: "gradebook" },
  { collection: "exams", field: "academicYear", model: "exam" },
  { collection: "practicecontracts", field: "academicYear", model: "practiceContract" },
  { collection: "personalworkplans", field: "academicYear", model: "personalWorkPlan" },
  { collection: "workloaddistributions", field: "academicYear", model: "workloadDistribution" },
  { collection: "personalreports", field: "academicYear", model: "personalReport" },
  { collection: "indicatorsubmissions", field: "academicYear", model: "indicatorSubmission" },
  { collection: "scienceprograms", field: "academicYear", model: "scienceProgram" },
  { collection: "workloads", field: "academicYear", model: "workload" },
  { collection: "residencyactivityplans", field: "academicYearRef", model: "residencyActivityPlan" },
  { collection: "residencyannouncements", field: "academicYearRef", model: "residencyAnnouncement" },
  { collection: "workingschedules", field: "academicYear", model: "workingSchedule" },
  { collection: "scholarshipapplications", field: "academicYearId", model: "scholarshipApplication" },
  { collection: "groups", field: "academicYear", model: "group" },
  { collection: "residencyopenlessons", field: "academicYearRef", model: "residencyOpenLesson" },
  { collection: "scholarships", field: "academicYearId", model: "scholarship" },
  { collection: "residencydissertationplans", field: "academicYearRef", model: "residencyDissertationPlan" },
  { collection: "residents", field: "academicYearRef", model: "resident" },
  { collection: "residentapplications", field: "academicYearRef", model: "residentApplication" },
  { collection: "residencytests", field: "academicYearRef", model: "residencyTest" },
  { collection: "departmentworkplans", field: "academicYear", model: "departmentWorkPlan" },
  { collection: "residencyproblemstudents", field: "academicYearRef", model: "residencyProblemStudent" },
  { collection: "residencylessons", field: "academicYearRef", model: "residencyLesson" },
  { collection: "residencynotices", field: "academicYearRef", model: "residencyNotice" },
  { collection: "residencycurriculums", field: "academicYearRef", model: "residencyCurriculum" },
  { collection: "annualreports", field: "academicYear", model: "annualReport" },
  { collection: "residencyattestations", field: "academicYearRef", model: "residencyAttestation" },
  { collection: "economiccontracts", field: "academicYear", model: "economicContract" },
  { collection: "giftedstudents", field: "academicYearId", model: "giftedStudent" },
];

function groupDuplicates(yearDocs) {
  const byCanonical = new Map();
  for (const doc of yearDocs) {
    const canonicalTitle = normalizeTitle(doc.title);
    if (!canonicalTitle) continue;
    if (!byCanonical.has(canonicalTitle)) byCanonical.set(canonicalTitle, []);
    byCanonical.get(canonicalTitle).push(doc);
  }
  const groups = [];
  for (const [canonicalTitle, docs] of byCanonical) {
    if (docs.length < 2) continue;
    const canonical = docs.find((d) => d.title === canonicalTitle) || null;
    const duplicates = docs.filter((d) => d !== canonical);
    groups.push({ canonicalTitle, canonical, duplicates });
  }
  return groups;
}

async function mergeDuplicates({
  db,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
}) {
  const yearDocs = await db.collection("academicyears").find({}).toArray();
  const groups = groupDuplicates(yearDocs);
  const mergeable = groups.filter((g) => g.canonical);
  const noCanonical = groups.filter((g) => !g.canonical);

  const perPair = [];
  for (const g of mergeable) {
    for (const dup of g.duplicates) {
      const refCounts = [];
      let totalRefs = 0;
      for (const src of REF_SOURCES) {
        const n = await db.collection(src.collection).countDocuments({ [src.field]: dup._id });
        if (n > 0) refCounts.push({ ...src, count: n });
        totalRefs += n;
      }
      perPair.push({ canonical: g.canonical, dup, refCounts, totalRefs, deleted: null, remainingAfterRepoint: null });
    }
  }

  const result = { groups, mergeable, noCanonical, perPair, written: null, backupFiles: [] };

  if (!write || !perPair.length) return result;

  for (const p of perPair) {
    if (backup) {
      const refSnapshots = {};
      for (const rc of p.refCounts) {
        const rows = await db
          .collection(rc.collection)
          .find({ [rc.field]: p.dup._id })
          .project({ _id: 1 })
          .toArray();
        refSnapshots[rc.collection] = { field: rc.field, ids: rows.map((r) => r._id) };
      }
      const snapshot = {
        createdAt: new Date().toISOString(),
        db: dbName,
        script: SCRIPT_NAME,
        canonical: { _id: p.canonical._id, title: p.canonical.title },
        duplicate: p.dup,
        refSnapshots,
      };
      result.backupFiles.push(writeBackup(backupDir, SCRIPT_NAME, snapshot));
    }

    for (const rc of p.refCounts) {
      await db
        .collection(rc.collection)
        .updateMany({ [rc.field]: p.dup._id }, { $set: { [rc.field]: p.canonical._id } });
    }

    let remaining = 0;
    for (const src of REF_SOURCES) {
      remaining += await db.collection(src.collection).countDocuments({ [src.field]: p.dup._id });
    }
    p.remainingAfterRepoint = remaining;
    if (remaining > 0) {
      p.deleted = false;
      continue;
    }
    await db.collection("academicyears").deleteOne({ _id: p.dup._id });
    p.deleted = true;
  }

  result.written = {
    merged: perPair.filter((p) => p.deleted === true).length,
    refused: perPair.filter((p) => p.deleted === false).length,
  };
  return result;
}

function printReport(result, { dry, dbName }) {
  const { groups, mergeable, noCanonical, perPair, written, backupFiles } = result;

  log();
  line("═");
  log(`  B2 — academicyears dublikatlarini birlashtirish   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE"}`);
  log(`  Baza: ${dbName}`);
  log(`  🔴 KANONIK QARORI: SLASH format ("YYYY/YYYY"). NOTO'G'RI bo'lsa — TO'XTATING.`);
  log(`     Sabab: sxema (academicYear.model.js) faqat shu formatni validatsiya qiladi`);
  log(`     + prod o'lchovi 8 slash vs 4 dash (ko'pchilik).`);
  line("═");

  log(`\nTekshirilgan academicyears hujjati: (dublikat guruh: ${groups.length})`);
  log(`  kanonik topildi (merge qilinadi)      : ${mergeable.length}`);
  log(`  kanonik topilmadi (o'tkazib yuborildi) : ${noCanonical.length}`);

  if (noCanonical.length) {
    log();
    line();
    log(`  ⚠️  KANONIK (slash) topilmagan guruhlar — MERGE QILINMADI:`);
    for (const g of noCanonical) {
      log(`     "${g.canonicalTitle}"  ←  ${g.duplicates.map((d) => `"${d.title}" (${d._id})`).join(", ")}`);
    }
    log(`     Tavsiya: avval  node scripts/normalize-academic-years.js --write`);
    log(`     (mavjud skript — bitta qatorni JOYIDA kanonik shaklga keltiradi, merge kerak emas).`);
  }

  if (mergeable.length) {
    log();
    line();
    log(`  ✅ MERGE QILINADIGAN JUFTLIKLAR:`);
    for (const g of mergeable) {
      log(`     KANONIK: "${g.canonical.title}" (${g.canonical._id})`);
      for (const d of g.duplicates) log(`       ← dublikat: "${d.title}" (${d._id})`);
    }
  }

  log();
  line();
  log(`  Tekshirilgan manba — ${REF_SOURCES.length} ta collection (grep: ref: "academicYear", src):`);
  for (const s of REF_SOURCES) {
    log(`     ${s.collection.padEnd(28)} .${s.field.padEnd(16)} (model: ${s.model})`);
  }

  if (perPair.length) {
    log();
    line();
    log(`  HAR JUFTLIK BO'YICHA REFERENSLAR:`);
    for (const p of perPair) {
      log(`     "${p.dup.title}" (${p.dup._id}) → "${p.canonical.title}"   jami referens: ${p.totalRefs}`);
      for (const rc of p.refCounts) log(`        ${rc.collection}.${rc.field}: ${rc.count}`);
      if (!p.refCounts.length) log(`        (hech qanday collection'da referens topilmadi)`);
      if (p.deleted === true) log(`        ✅ o'chirildi (barcha referens qayta yo'naltirildi)`);
      if (p.deleted === false) {
        log(`        ⛔ O'CHIRILMADI — qayta tekshiruvda ${p.remainingAfterRepoint} ta referens QOLDI`);
      }
    }
  }

  log();
  line();
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi/o'chirilmadi.`);
    log(`  Yozish: node scripts/prod-fixes/merge-academicyear-duplicates.js --write`);
  } else if (!perPair.length) {
    log(`  Birlashtiriladigan dublikat topilmadi — yozilmadi (idempotent).`);
  } else {
    if (backupFiles.length) {
      log(`  Zaxira fayllar:`);
      backupFiles.forEach((f) => log(`     ${f}`));
    }
    log(`  BIRLASHTIRILDI: ${written.merged}    RAD ETILDI (referens qoldi): ${written.refused}`);
  }
  line("═");
  log();
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg ? backupDirArg.split("=")[1] : DEFAULT_BACKUP_DIR;

  const { db, dbName } = await connectDb();
  try {
    const result = await mergeDuplicates({ db, write, backupDir, dbName });
    printReport(result, { dry: !write, dbName });
    process.exitCode = result.noCanonical.length > 0 || result.written?.refused > 0 ? 1 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  });
}

module.exports = { mergeDuplicates, groupDuplicates, printReport, REF_SOURCES };
