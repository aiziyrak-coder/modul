"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("#config/constants");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");

function pickOwner(entries, docId, superAdminIds) {
  const suffix = `/syllabi/${String(docId).toLowerCase()}`;
  const ids = new Set();
  for (const e of entries || []) {
    const p = String(e?.path || "").split("?")[0].toLowerCase();
    if (!p.endsWith(suffix)) continue;
    const uid = e?.user ? String(e.user) : null;
    if (!uid || superAdminIds.has(uid)) continue;
    ids.add(uid);
  }
  const candidates = [...ids];
  if (candidates.length === 0) return { status: "none", userId: null, candidates };
  if (candidates.length > 1) return { status: "ambiguous", userId: null, candidates };
  return { status: "ok", userId: candidates[0], candidates };
}

function writeBackup(items, dbName) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `syllabus-orphan-author-${dbName || "default"}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), db: dbName || null, items }, null, 2));
  return file;
}

async function recover({ apply = false, dbName = "", backup = true } = {}) {
  const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
  const AuditLog = require("#modules/4.01-auth/auditLog/auditLog.model");
  const User = require("#modules/4.01-auth/user/user.model");
  require("#modules/4.01-auth/role/role.model");

  const orphans = await Syllabus.find({ "author.teacher": null }).select("_id status").lean();
  const ids = orphans.map((d) => String(d._id));

  const entries = ids.length
    ? await AuditLog.find({ targetId: { $in: ids }, method: "PUT", statusCode: 200 })
        .select("user path targetId")
        .lean()
    : [];
  const byDoc = new Map();
  for (const e of entries) {
    const key = String(e.targetId);
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key).push(e);
  }

  const userIds = [...new Set(entries.map((e) => (e.user ? String(e.user) : null)).filter(Boolean))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("_id firstName lastName role")
        .populate("role", "title")
        .lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const superAdminIds = new Set(
    users.filter((u) => u.role?.title === ROLES.SUPER_ADMIN).map((u) => String(u._id)),
  );

  const result = {
    orphans: orphans.length,
    toFix: [],
    ambiguous: [],
    noSource: [],
    userMissing: [],
    changed: 0,
    backupFile: null,
  };

  for (const d of orphans) {
    const id = String(d._id);
    const pick = pickOwner(byDoc.get(id), id, superAdminIds);
    if (pick.status === "ambiguous") {
      result.ambiguous.push({ id, status: d.status, candidates: pick.candidates });
    } else if (pick.status === "none") {
      result.noSource.push({ id, status: d.status });
    } else if (!userById.has(pick.userId)) {
      result.userMissing.push({ id, status: d.status, userId: pick.userId });
    } else {
      const u = userById.get(pick.userId);
      result.toFix.push({
        id,
        status: d.status,
        userId: pick.userId,
        name: `${u.lastName || ""} ${u.firstName || ""}`.trim(),
      });
    }
  }

  if (apply && result.toFix.length > 0) {
    const items = result.toFix.map(({ id, userId }) => ({ id, userId }));
    if (backup) result.backupFile = writeBackup(items, dbName);
    const res = await Syllabus.bulkWrite(
      items.map(({ id, userId }) => ({
        updateOne: {
          filter: { _id: id, "author.teacher": null },
          update: { $set: { "author.teacher": userId } },
        },
      })),
    );
    result.changed = res?.modifiedCount ?? res?.nModified ?? 0;
  }
  return result;
}

async function revert({ file }) {
  const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const items = (Array.isArray(data?.items) ? data.items : []).filter(
    (i) => mongoose.isValidObjectId(i?.id) && mongoose.isValidObjectId(i?.userId),
  );
  if (items.length === 0) return { items: 0, changed: 0 };
  const res = await Syllabus.bulkWrite(
    items.map(({ id, userId }) => ({
      updateOne: {
        filter: { _id: id, "author.teacher": userId },
        update: { $set: { "author.teacher": null } },
      },
    })),
  );
  return { items: items.length, changed: res?.modifiedCount ?? res?.nModified ?? 0 };
}

function printReport(result, apply) {
  line("═");
  log(`  SILLABUS EGASINI TIKLASH — ${apply ? "YOZISH (--apply)" : "DRY-RUN (yozilmadi)"}`);
  line("═");
  for (const d of result.toFix) log(`  ✓ ${d.id} [${d.status}] → ${d.name || "(ismsiz)"} (${d.userId})`);
  for (const d of result.ambiguous) log(`  ? ${d.id} [${d.status}] NOANIQ — nomzodlar: ${d.candidates.join(", ")}`);
  for (const d of result.noSource) log(`  – ${d.id} [${d.status}] audit jurnalida manba yo'q`);
  for (const d of result.userMissing) log(`  ! ${d.id} [${d.status}] foydalanuvchi topilmadi (${d.userId})`);
  line();
  log(`  Egasiz sillabus          : ${result.orphans}`);
  log(`  Tiklanadigan             : ${result.toFix.length}`);
  log(`  Noaniq (qo'lda)          : ${result.ambiguous.length}`);
  log(`  Manbasiz                 : ${result.noSource.length}`);
  log(`  Foydalanuvchi yo'q       : ${result.userMissing.length}`);
  if (apply) log(`  Yozildi                  : ${result.changed}`);
  if (result.backupFile) log(`  Zaxira                   : ${result.backupFile}`);
  line("═");
  if (!apply && result.toFix.length > 0) log("  Yozish uchun: --apply bayrog'i bilan qayta yurgizing.");
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
      log(`  ORQAGA QAYTARISH: zaxirada ${r.items} ta hujjat, o'zgardi ${r.changed} ta.`);
      return;
    }
    const result = await recover({ apply, dbName });
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

module.exports = { pickOwner, recover, revert };
