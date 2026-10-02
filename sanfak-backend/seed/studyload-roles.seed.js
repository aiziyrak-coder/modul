"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLE_PERMISSIONS } = require("../src/modules/4.02-studyLoad/studyLoad.permissions");

function toPermissionsArray(sections) {
  return Object.entries(sections).map(([section, actionKeys]) => ({
    section,
    actionKeys: [...actionKeys],
  }));
}

const rolesDef = Object.entries(ROLE_PERMISSIONS).map(([title, def]) => ({
  title,
  desc: def.desc,
  scopeLevel: def.scopeLevel,
  isSystem: def.isSystem,
  active: def.active,
  permissions: toPermissionsArray(def.sections),
}));

function diffPermissions(existingPerms, newPerms) {
  const existingMap = new Map(
    (existingPerms || []).map((p) => [p.section, new Set(p.actionKeys || [])]),
  );
  const newMap = new Map(newPerms.map((p) => [p.section, new Set(p.actionKeys)]));

  const changes = [];

  for (const [section, newSet] of newMap) {
    const oldSet = existingMap.get(section) || new Set();
    const added = [...newSet].filter((a) => !oldSet.has(a));
    const removed = [...oldSet].filter((a) => !newSet.has(a));
    if (added.length > 0 || removed.length > 0) {
      changes.push({ section, added, removed });
    }
  }

  return changes;
}

function mergePermissions(existingPerms, newPerms) {
  const managed = new Set(newPerms.map((p) => p.section));
  const preserved = (existingPerms || []).filter((p) => !managed.has(p.section));
  return [...preserved, ...newPerms];
}

async function main() {
  const syncMode = process.argv.includes("--sync-permissions");
  const dryRun = process.argv.includes("--dry");

  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[StudyloadRoles Seed] MongoDB ga ulandi");
  if (dryRun) {
    console.log("[StudyloadRoles Seed] --dry: DBga HECH NARSA YOZILMAYDI\n");
  }
  console.log(
    "[StudyloadRoles Seed] MERGE (default): matritsadagi section'lar yangilanadi, begona section'lar saqlanadi" +
      (syncMode ? " (--sync-permissions berildi — backward-compat, xatti-harakat bir xil)" : "") +
      "\n",
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let synced = 0;
  let unchanged = 0;

  console.log("── Rollar ─────────────────────────────────────────────────────");

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });

    if (!existing) {
      if (!dryRun) {
        await RoleModel.create({
          title:       def.title,
          desc:        def.desc,
          scopeLevel:  def.scopeLevel,
          isSystem:    def.isSystem,
          active:      def.active,
          permissions: def.permissions,
        });
      }
      console.log(
        `  + YARATILDI${dryRun ? " (DRY)" : ""}: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section`,
      );
      created++;
      continue;
    }

    const changes = diffPermissions(existing.permissions, def.permissions);
    if (changes.length === 0) {
      console.log(`  = O'ZGARISHSIZ: "${def.title}" — permissions matritsaga allaqachon mos`);
      unchanged++;
      continue;
    }

    const preservedCount =
      (existing.permissions || []).length -
      (existing.permissions || []).filter((p) =>
        def.permissions.some((n) => n.section === p.section),
      ).length;

    if (!dryRun) {
      existing.permissions = mergePermissions(existing.permissions, def.permissions);
      existing.markModified("permissions");
      await existing.save();
    }

    console.log(
      `  ↻ SYNC${dryRun ? " (DRY)" : ""}: "${def.title}" — ` +
        `${changes.length} section yangilandi, ${preservedCount} ta begona section saqlandi:`,
    );
    for (const { section, added, removed } of changes) {
      if (added.length > 0) {
        console.log(`      + ${section}: [${added.join(", ")}] qo'shildi`);
      }
      if (removed.length > 0) {
        console.log(`      - ${section}: [${removed.join(", ")}] olib tashlandi`);
      }
    }
    synced++;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi     : ${created}`);
  console.log(`  Sync qilindi  : ${synced}`);
  console.log(`  O'zgarishsiz  : ${unchanged}`);
  console.log(`  Jami          : ${rolesDef.length} rol ko'rib chiqildi`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (created > 0) {
    console.log("\n  Keyingi qadam: npm run seed:permissions (permissions katalogini yangilash)");
  }
  console.log("\n  RUN: node seed/studyload-roles.seed.js\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[StudyloadRoles Seed] XATO:", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([field, e]) =>
      console.error(`  - ${field}: ${e.message}`),
    );
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
