"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const {
  connectDb,
  writeBackup,
  parseObjectIdString,
  DEFAULT_BACKUP_DIR,
  log,
  line,
} = require("./_lib");

const SCRIPT_NAME = "backfill-group-year-language";
const DEFAULT_OUT_PATH = path.join(__dirname, "group-year-language-template.json");

function buildTemplateRows(groups) {
  const rows = [];
  for (const g of groups) {
    const missing = [];
    if (!g.academicYear) missing.push("academicYear");
    if (!g.lang) missing.push("language");
    if (!missing.length) continue;
    rows.push({
      groupId: String(g._id),
      title: g.title || null,
      direction: g.direction ? g.direction.title : null,
      course: g.course ? g.course.title : null,
      academicYear: null,
      language: null,
      _missing: missing,
    });
  }
  return rows;
}

function validateApplyRow(row, ctx) {
  const reasons = [];
  let hasError = false;

  const groupId = parseObjectIdString(row.groupId);
  if (!groupId) return { status: "invalid", groupId: row?.groupId ?? null, reasons: ["groupId noto'g'ri yoki yo'q"] };

  const group = ctx.groupsById.get(String(groupId));
  if (!group) return { status: "invalid", groupId: String(groupId), reasons: ["bunday group hujjati DB'da topilmadi"] };

  const setFields = {};

  if (row.academicYear !== null && row.academicYear !== undefined) {
    const yearId = parseObjectIdString(row.academicYear);
    if (!yearId) {
      reasons.push("academicYear — noto'g'ri ObjectId");
      hasError = true;
    } else if (!ctx.validYearIds.has(String(yearId))) {
      reasons.push("academicYear — bunday academicyears hujjati yo'q");
      hasError = true;
    } else if (group.academicYear) {
      reasons.push("academicYear — DB'da allaqachon to'ldirilgan, o'tkazildi");
    } else {
      setFields.academicYear = yearId;
    }
  }

  if (row.language !== null && row.language !== undefined) {
    const langId = parseObjectIdString(row.language);
    if (!langId) {
      reasons.push("language — noto'g'ri ObjectId");
      hasError = true;
    } else if (!ctx.validLanguageIds.has(String(langId))) {
      reasons.push("language — bunday languageOfInstruction hujjati yo'q");
      hasError = true;
    } else if (group.lang) {
      reasons.push("language — DB'da allaqachon to'ldirilgan, o'tkazildi");
    } else {
      setFields.lang = langId;
    }
  }

  if (!Object.keys(setFields).length) {
    return { status: hasError ? "invalid" : "skip", groupId: String(groupId), reasons };
  }
  return { status: "apply", groupId: String(groupId), setFields, reasons };
}

async function reportMissing({ db, outPath = DEFAULT_OUT_PATH }) {
  const groups = await db
    .collection("groups")
    .find({ $or: [{ academicYear: null }, { academicYear: { $exists: false } }, { lang: null }, { lang: { $exists: false } }] })
    .toArray();

  const directionIds = [...new Set(groups.filter((g) => g.direction).map((g) => String(g.direction)))];
  const courseIds = [...new Set(groups.filter((g) => g.course).map((g) => String(g.course)))];
  const directions = await db
    .collection("directions")
    .find({ _id: { $in: directionIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ title: 1 })
    .toArray();
  const courses = await db
    .collection("courses")
    .find({ _id: { $in: courseIds.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ title: 1 })
    .toArray();
  const directionById = new Map(directions.map((d) => [String(d._id), d]));
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  const enriched = groups.map((g) => ({
    ...g,
    direction: g.direction ? directionById.get(String(g.direction)) || null : null,
    course: g.course ? courseById.get(String(g.course)) || null : null,
  }));

  const rows = buildTemplateRows(enriched);
  fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");

  const totalGroups = await db.collection("groups").countDocuments({});
  return {
    totalGroups,
    missingCount: rows.length,
    missingAcademicYearOnly: rows.filter((r) => r._missing.length === 1 && r._missing[0] === "academicYear").length,
    missingLanguageOnly: rows.filter((r) => r._missing.length === 1 && r._missing[0] === "language").length,
    missingBoth: rows.filter((r) => r._missing.length === 2).length,
    outPath,
    rows,
  };
}

async function applyTemplate({
  db,
  applyPath,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
}) {
  const raw = fs.readFileSync(applyPath, "utf8");
  const templateRows = JSON.parse(raw);
  if (!Array.isArray(templateRows)) {
    throw new Error("Shablon fayl massiv (JSON array) bo'lishi kerak.");
  }

  const groupDocs = await db
    .collection("groups")
    .find({})
    .project({ academicYear: 1, lang: 1 })
    .toArray();
  const groupsById = new Map(groupDocs.map((g) => [String(g._id), g]));

  const years = await db.collection("academicyears").find({}).project({ _id: 1 }).toArray();
  const validYearIds = new Set(years.map((y) => String(y._id)));

  const languages = await db.collection("languageofinstructions").find({}).project({ _id: 1 }).toArray();
  const validLanguageIds = new Set(languages.map((l) => String(l._id)));

  const ctx = { groupsById, validYearIds, validLanguageIds };
  const validated = templateRows.map((row) => validateApplyRow(row, ctx));

  const toApply = validated.filter((v) => v.status === "apply");
  const result = {
    total: templateRows.length,
    apply: toApply.length,
    skip: validated.filter((v) => v.status === "skip").length,
    invalid: validated.filter((v) => v.status === "invalid").length,
    validated,
    written: null,
    backupFile: null,
  };

  if (!write || !toApply.length) return result;

  if (backup) {
    const ids = toApply.map((v) => new mongoose.Types.ObjectId(v.groupId));
    const snapshot = {
      createdAt: new Date().toISOString(),
      db: dbName,
      script: SCRIPT_NAME,
      groups: await db.collection("groups").find({ _id: { $in: ids } }).toArray(),
    };
    result.backupFile = writeBackup(backupDir, SCRIPT_NAME, snapshot);
  }

  let updated = 0;
  for (const v of toApply) {
    const r = await db
      .collection("groups")
      .updateOne({ _id: new mongoose.Types.ObjectId(v.groupId) }, { $set: v.setFields });
    updated += r.modifiedCount;
  }
  result.written = { groups: updated };
  return result;
}

function printReportMode(result, { dbName }) {
  log();
  line("═");
  log(`  B3 — groups: academicYear/til — REPORT rejimi (DB'ga yozilmaydi)`);
  log(`  Baza: ${dbName}`);
  line("═");
  log(`\nJami groups hujjati: ${result.totalGroups}`);
  log(`  kamida bittasi bo'sh          : ${result.missingCount}`);
  log(`    faqat academicYear yo'q     : ${result.missingAcademicYearOnly}`);
  log(`    faqat til (lang) yo'q       : ${result.missingLanguageOnly}`);
  log(`    ikkalasi ham yo'q           : ${result.missingBoth}`);
  log();
  if (result.missingCount) {
    log(`  Shablon yozildi: ${result.outPath}`);
    log(`  To'ldirib, keyin: node scripts/prod-fixes/backfill-group-year-language.js --apply=${result.outPath}`);
  } else {
    log(`  To'ldiriladigan guruh yo'q — shablon bo'sh massiv bilan yozildi.`);
  }
  line("═");
  log();
}

function printApplyReport(result, { dry, dbName }) {
  log();
  line("═");
  log(`  B3 — groups: academicYear/til — APPLY rejimi   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE"}`);
  log(`  Baza: ${dbName}`);
  line("═");
  log(`\nShablondagi qator: ${result.total}`);
  log(`  ✅ qo'llanadi           : ${result.apply}`);
  log(`  ⏭  o'tkaziladi (bo'sh/allaqachon to'la): ${result.skip}`);
  log(`  ❌ noto'g'ri (invalid)  : ${result.invalid}`);

  const invalids = result.validated.filter((v) => v.status === "invalid");
  if (invalids.length) {
    log();
    line();
    log(`  ❌ NOTO'G'RI QATORLAR:`);
    for (const v of invalids) log(`     groupId=${v.groupId}   ${v.reasons.join("; ")}`);
  }
  const skips = result.validated.filter((v) => v.status === "skip" && v.reasons.length);
  if (skips.length) {
    log();
    line();
    log(`  ⏭  O'TKAZILGAN QATORLAR (sabab bilan):`);
    for (const v of skips) log(`     groupId=${v.groupId}   ${v.reasons.join("; ")}`);
  }

  log();
  line();
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi. ${result.apply} ta guruh yangilanadigan edi.`);
    log(`  Yozish uchun --write ham qo'shing.`);
  } else if (!result.apply) {
    log(`  Yoziladigan qator yo'q — yozilmadi.`);
  } else {
    if (result.backupFile) log(`  Zaxira: ${result.backupFile}`);
    log(`  YOZILDI: ${result.written.groups} ta guruh.`);
  }
  line("═");
  log();
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const applyArg = args.find((a) => a.startsWith("--apply="));
  const outArg = args.find((a) => a.startsWith("--out="));
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg ? backupDirArg.split("=")[1] : DEFAULT_BACKUP_DIR;

  const { db, dbName } = await connectDb();
  try {
    if (applyArg) {
      const applyPath = applyArg.split("=")[1];
      const result = await applyTemplate({ db, applyPath, write, backupDir, dbName });
      printApplyReport(result, { dry: !write, dbName });
      process.exitCode = result.invalid > 0 ? 1 : 0;
    } else {
      const outPath = outArg ? outArg.split("=")[1] : DEFAULT_OUT_PATH;
      const result = await reportMissing({ db, outPath });
      printReportMode(result, { dbName });
      process.exitCode = 0;
    }
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

module.exports = {
  buildTemplateRows,
  validateApplyRow,
  reportMissing,
  applyTemplate,
  printReportMode,
  printApplyReport,
};
