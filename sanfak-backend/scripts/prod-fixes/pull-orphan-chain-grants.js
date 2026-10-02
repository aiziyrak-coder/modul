"use strict";

const mongoose = require("mongoose");
const { ROLES, MODULES } = require("#config/constants");
const { ROLE_PERMISSIONS } = require("#modules/4.02-studyLoad/studyLoad.permissions");
const { connectDb, writeBackup, DEFAULT_BACKUP_DIR, log, line } = require("./_lib");

const SCRIPT_NAME = "pull-orphan-chain-grants";

const CHAIN_SECTIONS = [
  MODULES.WORKLOAD,
  MODULES.WORKING_SCHEDULE,
  MODULES.WORKLOAD_DISTRIBUTION,
  MODULES.SCIENCE_PROGRAM,
  MODULES.SYLLABUS,
];

const BYPASS_ROLES = [ROLES.SUPER_ADMIN, ROLES.MODERATOR];

function findOrphanChainGrants(
  roleDoc,
  matrix,
  chainSections = CHAIN_SECTIONS,
  bypassRoles = BYPASS_ROLES,
) {
  const title = roleDoc.title;
  const roleId = roleDoc._id ?? null;

  if (bypassRoles.includes(title)) {
    return { title, roleId, skipped: true, skipReason: "bypass-rol (role:grantAny)", orphans: [] };
  }

  const roleDef = matrix[title];
  if (!roleDef) {
    return { title, roleId, skipped: true, skipReason: "rol matritsada yo'q — 4.02 bu rolni boshqarmaydi", orphans: [] };
  }

  const matrixSections = new Set(Object.keys(roleDef.sections || {}));
  const orphans = (roleDoc.permissions || [])
    .filter((p) => chainSections.includes(p.section) && !matrixSections.has(p.section))
    .map((p) => ({ section: p.section, actionKeys: [...(p.actionKeys || [])] }));

  return { title, roleId, skipped: false, skipReason: null, orphans };
}

async function scanRoles({ db, matrix = ROLE_PERMISSIONS, chainSections = CHAIN_SECTIONS, bypassRoles = BYPASS_ROLES }) {
  const roleDocs = await db.collection("roles").find({}).toArray();
  const results = roleDocs.map((r) => findOrphanChainGrants(r, matrix, chainSections, bypassRoles));
  const withOrphans = results.filter((r) => !r.skipped && r.orphans.length > 0);
  const totalOrphanSections = withOrphans.reduce((sum, r) => sum + r.orphans.length, 0);
  return { totalRoles: roleDocs.length, results, withOrphans, totalOrphanSections };
}

async function applyPulls({
  db,
  withOrphans,
  write = false,
  backup = true,
  backupDir = DEFAULT_BACKUP_DIR,
  dbName = "",
}) {
  const result = { attempted: withOrphans.length, updated: 0, written: false, backupFile: null };
  if (!write || !withOrphans.length) return result;

  if (backup) {
    const roleIds = withOrphans.map((r) => r.roleId);
    const snapshot = {
      createdAt: new Date().toISOString(),
      db: dbName,
      script: SCRIPT_NAME,
      roles: await db.collection("roles").find({ _id: { $in: roleIds } }).toArray(),
    };
    result.backupFile = writeBackup(backupDir, SCRIPT_NAME, snapshot);
  }

  for (const r of withOrphans) {
    const orphanSections = r.orphans.map((o) => o.section);
    const res = await db
      .collection("roles")
      .updateOne({ _id: r.roleId }, { $pull: { permissions: { section: { $in: orphanSections } } } });
    if (res.modifiedCount) result.updated += 1;
  }
  result.written = true;
  return result;
}

function printReport({ totalRoles, results, withOrphans, totalOrphanSections, applyResult }, { dry, dbName }) {
  log();
  line("═");
  log(`  4.02/4.03 — rol matritsasida yo'q zanjir grantlarini $pull   rejim: ${dry ? "DRY-RUN (yozilmaydi)" : "APPLY"}`);
  log(`  Baza: ${dbName}`);
  line("═");
  log(`\nJami rol: ${totalRoles}`);

  const skipped = results.filter((r) => r.skipped);
  log(`  o'tkazib yuborilgan (bypass/matritsada yo'q): ${skipped.length}`);
  log(`  yetim topilgan rol: ${withOrphans.length}`);
  log(`  jami yetim section: ${totalOrphanSections}`);

  if (withOrphans.length) {
    log();
    line();
    log(`  YETIM GRANTLAR (matritsada yo'q, DB'da bor):`);
    for (const r of withOrphans) {
      for (const o of r.orphans) {
        log(`     ${r.title} → ${o.section}[${o.actionKeys.join(",")}]`);
      }
    }
  }

  log();
  line();
  if (dry) {
    if (withOrphans.length) {
      log(`  DRY-RUN — hech narsa yozilmadi. ${totalOrphanSections} ta yetim section, ${withOrphans.length} ta rolda.`);
      log(`  RUN: node scripts/prod-fixes/${SCRIPT_NAME}.js --apply`);
    } else {
      log(`  DRY-RUN — yetim grant topilmadi. Yozadigan narsa yo'q.`);
    }
  } else if (!withOrphans.length) {
    log(`  Yetim grant yo'q — yozilmadi.`);
  } else {
    if (applyResult.backupFile) log(`  Zaxira: ${applyResult.backupFile}`);
    log(`  YOZILDI: ${applyResult.updated} ta rol yangilandi (${totalOrphanSections} ta section $pull qilindi).`);
  }
  line("═");
  log();
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const confirmed = argv.includes("--yes");
  const mongoArg = argv.find((a) => a.startsWith("--mongo="));
  const mongoOverride = mongoArg ? mongoArg.slice("--mongo=".length) : null;
  const backupDirArg = argv.find((a) => a.startsWith("--backup-dir="));
  const backupDir = backupDirArg
    ? backupDirArg.slice("--backup-dir=".length)
    : DEFAULT_BACKUP_DIR;
  return { apply, confirmed, mongoOverride, backupDir };
}

function needsConfirmation({ apply, mongoOverride, confirmed }) {
  return Boolean(apply && mongoOverride && !confirmed);
}

async function main() {
  const { apply, confirmed, mongoOverride, backupDir } = parseArgs(
    process.argv.slice(2),
  );

  const { db, dbName } = await connectDb(mongoOverride);
  log(`Baza: ${dbName}${mongoOverride ? " (--mongo bilan)" : " (.env)"}`);

  if (needsConfirmation({ apply, mongoOverride, confirmed })) {
    log(
      `XATO: --apply + --mongo birga berilganda --yes bayrog'i ham SHART ` +
        `(tasodifiy prod/demo/chain yozuvining oldini olish uchun).`,
    );
    log(`  RUN: node scripts/prod-fixes/${SCRIPT_NAME}.js --apply --mongo=${mongoOverride} --yes`);
    process.exitCode = 1;
    await mongoose.disconnect();
    return;
  }

  try {
    const { totalRoles, results, withOrphans, totalOrphanSections } = await scanRoles({ db });
    const applyResult = await applyPulls({ db, withOrphans, write: apply, backupDir, dbName });
    printReport({ totalRoles, results, withOrphans, totalOrphanSections, applyResult }, { dry: !apply, dbName });
    process.exitCode = 0;
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
  CHAIN_SECTIONS,
  BYPASS_ROLES,
  findOrphanChainGrants,
  scanRoles,
  applyPulls,
  printReport,
  parseArgs,
  needsConfirmation,
};
