"use strict";

const mongoose = require("mongoose");
const { connectDb, writeBackup, DEFAULT_BACKUP_DIR, log, line } = require("./_lib");
const { normalizeTitle } = require("#references/_services/academicYearResolver");

const SCRIPT_NAME = "fix-workload-academicyear-ref";
const HEX_ID = /^[a-f0-9]{24}$/i;

function classifyValue(rawValue, byTitle) {
  if (rawValue === null || rawValue === undefined) {
    return { status: "missing" };
  }
  if (rawValue instanceof mongoose.Types.ObjectId) {
    return { status: "already" };
  }
  const raw = String(rawValue);
  if (HEX_ID.test(raw)) {
    return { status: "hexString", toId: raw };
  }
  const normalized = normalizeTitle(raw);
  if (!normalized) {
    return { status: "unresolved", raw, normalized: null };
  }
  const targetId = byTitle.get(normalized);
  if (!targetId) {
    return { status: "unresolved", raw, normalized };
  }
  return { status: "resolved", raw, normalized, toId: String(targetId) };
}

async function fixWorkloadAcademicYear({
  db,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
}) {
  const years = await db
    .collection("academicyears")
    .find({})
    .project({ title: 1 })
    .toArray();
  const byTitle = new Map(years.map((y) => [y.title, y._id]));

  const docs = await db
    .collection("workloads")
    .find({})
    .project({ academicYear: 1 })
    .toArray();

  const stat = {
    total: docs.length,
    already: 0,
    hexString: 0,
    resolved: 0,
    unresolved: 0,
    missing: 0,
  };
  const toUpdate = [];
  const unresolvedList = [];

  for (const doc of docs) {
    const cls = classifyValue(doc.academicYear, byTitle);
    stat[cls.status] += 1;
    if (cls.status === "hexString") {
      toUpdate.push({ _id: doc._id, toId: cls.toId, note: `hex-string cast: "${cls.toId}"` });
    } else if (cls.status === "resolved") {
      toUpdate.push({
        _id: doc._id,
        toId: cls.toId,
        note: `"${cls.raw}" → "${cls.normalized}" (${cls.toId})`,
      });
    } else if (cls.status === "unresolved") {
      unresolvedList.push({ _id: doc._id, raw: cls.raw, normalized: cls.normalized });
    }
  }

  const result = { stat, unresolvedList, toUpdate, written: null, backupFile: null };

  if (!write || !toUpdate.length) return result;

  if (backup) {
    const ids = toUpdate.map((u) => u._id);
    const snapshot = {
      createdAt: new Date().toISOString(),
      db: dbName,
      script: SCRIPT_NAME,
      workloads: await db
        .collection("workloads")
        .find({ _id: { $in: ids } })
        .toArray(),
    };
    result.backupFile = writeBackup(backupDir, SCRIPT_NAME, snapshot);
  }

  let updated = 0;
  for (const u of toUpdate) {
    const r = await db
      .collection("workloads")
      .updateOne({ _id: u._id }, { $set: { academicYear: new mongoose.Types.ObjectId(u.toId) } });
    updated += r.modifiedCount;
  }
  result.written = { workloads: updated };
  return result;
}

function printReport(result, { dry, dbName }) {
  const { stat, unresolvedList, toUpdate, written, backupFile } = result;

  log();
  line("═");
  log(`  B1 — workloads.academicYear: STRING → ObjectId   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "WRITE"}`);
  log(`  Baza: ${dbName}`);
  line("═");

  log(`\nJami workloads hujjati: ${stat.total}`);
  log(`  ✅ allaqachon ObjectId               : ${stat.already}`);
  log(`  🔁 hex-string (faqat tip tuzatiladi)  : ${stat.hexString}`);
  log(`  🔁 sarlavha bo'yicha topildi          : ${stat.resolved}`);
  log(`  ❓ topilmadi (TEGILMAYDI)             : ${stat.unresolved}`);
  log(`  ⚠️  academicYear maydoni yo'q/null     : ${stat.missing}`);

  if (unresolvedList.length) {
    log();
    line();
    log(`  ❓ TOPILMAGAN — quyidagi hujjatlarga umuman tegilmadi (${unresolvedList.length}):`);
    for (const u of unresolvedList) {
      log(
        `     workload ${u._id}   raw=${JSON.stringify(u.raw)}   normalized=${u.normalized ? `"${u.normalized}"` : "—"}`,
      );
    }
    log(`     Sabab: mos "academicyears" hujjati yo'q. Yangi yil qo'lda/admin panel`);
    log(`     orqali yaratiladi — bu skript hech qachon avtomatik yaratmaydi.`);
  }

  log();
  line();
  if (dry) {
    log(`  DRY-RUN — hech narsa yozilmadi. ${toUpdate.length} ta hujjat yoziladigan edi.`);
    log(`  Yozish: node scripts/prod-fixes/fix-workload-academicyear-ref.js --write`);
  } else if (!toUpdate.length) {
    log(`  O'zgarish yo'q — yozilmadi (idempotent).`);
  } else {
    if (backupFile) log(`  Zaxira: ${backupFile}`);
    log(`  YOZILDI: ${written.workloads} ta hujjat.`);
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
    const result = await fixWorkloadAcademicYear({ db, write, backupDir, dbName });
    printReport(result, { dry: !write, dbName });
    process.exitCode = result.unresolvedList.length > 0 ? 1 : 0;
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

module.exports = { fixWorkloadAcademicYear, classifyValue, printReport };
