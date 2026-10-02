"use strict";

const mongoose = require("mongoose");
const { connectDb, writeBackup, DEFAULT_BACKUP_DIR, log, line } = require("./_lib");

const SCRIPT_NAME = "clean-lessontype-artifacts";
const COLLECTION_NAME = "lessontypes";

const REF_SOURCES = [];

const JUNK_EXACT = new Set(
  ["%", "Jami", "jami", "soat", "Soat", "Umumiy yuklamaning hajmi soat"].map((s) => s.toLowerCase()),
);

function isSuspiciousTitle(title) {
  const t = String(title ?? "").trim();
  if (!t) return true;
  if (JUNK_EXACT.has(t.toLowerCase())) return true;
  if (/^%+$/.test(t)) return true;
  if (/^\d+([.,]\d+)?\s*%?$/.test(t)) return true;
  return false;
}

async function countTopLevelReferences(db, id, { excludeCollections = [], deepScan = true } = {}) {
  if (!deepScan) return { total: 0, perCollection: {} };
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  const perCollection = {};
  let total = 0;
  for (const cname of collections) {
    if (excludeCollections.includes(cname)) continue;
    const n = await db.collection(cname).countDocuments({
      $expr: {
        $in: [id, { $map: { input: { $objectToArray: "$$ROOT" }, as: "kv", in: "$$kv.v" } }],
      },
    });
    if (n > 0) perCollection[cname] = n;
    total += n;
  }
  return { total, perCollection };
}

async function cleanArtifacts({
  db,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
  deepScan = true,
  excludeCollections = [],
}) {
  const collectionList = await db.listCollections({ name: COLLECTION_NAME }).toArray();
  const collectionExists = collectionList.length > 0;

  const docs = await db.collection(COLLECTION_NAME).find({}).toArray();
  const suspicious = docs.filter((d) => isSuspiciousTitle(d.title));

  const withRefs = [];
  for (const doc of suspicious) {
    const staticRefs = {};
    let staticTotal = 0;
    for (const src of REF_SOURCES) {
      const n = await db.collection(src.collection).countDocuments({ [src.field]: doc._id });
      if (n > 0) staticRefs[`${src.collection}.${src.field}`] = n;
      staticTotal += n;
    }
    const deep = await countTopLevelReferences(db, doc._id, {
      excludeCollections: [COLLECTION_NAME, ...excludeCollections],
      deepScan,
    });
    withRefs.push({
      doc,
      staticRefs,
      staticTotal,
      deepRefs: deep.perCollection,
      deepTotal: deep.total,
      totalRefs: staticTotal + deep.total,
    });
  }

  const deletable = withRefs.filter((r) => r.totalRefs === 0);
  const kept = withRefs.filter((r) => r.totalRefs > 0);

  const result = {
    collectionExists,
    totalDocs: docs.length,
    suspiciousCount: suspicious.length,
    withRefs,
    deletable,
    kept,
    deepScan,
    written: null,
    backupFile: null,
  };

  if (!write || !deletable.length) return result;

  if (backup) {
    const snapshot = {
      createdAt: new Date().toISOString(),
      db: dbName,
      script: SCRIPT_NAME,
      collection: COLLECTION_NAME,
      deleted: deletable.map((r) => r.doc),
    };
    result.backupFile = writeBackup(backupDir, SCRIPT_NAME, snapshot);
  }

  const ids = deletable.map((r) => r.doc._id);
  const delResult = await db.collection(COLLECTION_NAME).deleteMany({ _id: { $in: ids } });
  result.written = { deleted: delResult.deletedCount };
  return result;
}

function printReport(result, { dry, dbName }) {
  const { collectionExists, totalDocs, suspiciousCount, withRefs, deletable, kept, deepScan, written, backupFile } = result;

  log();
  line("═");
  log(`  B4 — lessontypes: xlsx artefaktlarini tozalash   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE"}`);
  log(`  Baza: ${dbName}`);
  log(`  ⚠️  "${COLLECTION_NAME}" nomiga QATʼIY yopishadi — --collection bayrog'i YO'Q.`);
  line("═");

  if (!collectionExists) {
    log(`\n  ℹ️  "${COLLECTION_NAME}" collection BU BAZADA MAVJUD EMAS.`);
    log(`     (institute-demo'da kutilgan holat — bu skriptning muvaffaqiyatsizligi EMAS.`);
    log(`     Prod'da mavjudligini tekshiring: mongosh → db.getCollectionNames())`);
    line("═");
    log();
    return;
  }

  log(`\nJami hujjat: ${totalDocs}`);
  log(`  shubhali (evristika bo'yicha): ${suspiciousCount}`);
  log(`  chuqur skan: ${deepScan ? "YOQILGAN (barcha collection)" : "O'CHIRILGAN (--skip-deep-scan)"}`);

  if (withRefs.length) {
    log();
    line();
    log(`  SHUBHALI YOZUVLAR VA REFERENSLARI:`);
    for (const r of withRefs) {
      log(`     "${r.doc.title}" (${r.doc._id})   jami referens: ${r.totalRefs}`);
      for (const [k, v] of Object.entries(r.staticRefs)) log(`        [sxema-ref] ${k}: ${v}`);
      for (const [k, v] of Object.entries(r.deepRefs)) log(`        [chuqur-skan] ${k}: ${v}`);
      log(`        ${r.totalRefs === 0 ? "✅ referenssiz — o'chirishga nomzod" : "⛔ referens BOR — QO'LDA hal qilinadi"}`);
    }
  }

  log();
  line();
  if (dry) {
    log(`  DRY-RUN — hech narsa o'chirilmadi. ${deletable.length} ta o'chiriladigan, ${kept.length} ta referensli qoladi.`);
    log(`  O'chirish: node scripts/prod-fixes/clean-lessontype-artifacts.js --write`);
  } else if (!deletable.length) {
    log(`  O'chiriladigan (referenssiz) yozuv yo'q.`);
  } else {
    if (backupFile) log(`  Zaxira: ${backupFile}`);
    log(`  O'CHIRILDI: ${written.deleted} ta hujjat.  QOLDI (referensli, qo'lda hal qilinadi): ${kept.length}`);
  }
  line("═");
  log();
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const deepScan = !args.includes("--skip-deep-scan");
  const excludeArg = args.find((a) => a.startsWith("--exclude="));
  const excludeCollections = excludeArg ? excludeArg.split("=")[1].split(",").filter(Boolean) : [];
  const backupDirArg = args.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg ? backupDirArg.split("=")[1] : DEFAULT_BACKUP_DIR;

  const { db, dbName } = await connectDb();
  try {
    const result = await cleanArtifacts({ db, write, backupDir, dbName, deepScan, excludeCollections });
    printReport(result, { dry: !write, dbName });
    process.exitCode = result.kept && result.kept.length > 0 ? 1 : 0;
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
  cleanArtifacts,
  isSuspiciousTitle,
  countTopLevelReferences,
  printReport,
  REF_SOURCES,
  COLLECTION_NAME,
};
