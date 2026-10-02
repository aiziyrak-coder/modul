"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  ROLE_PERMISSIONS,
} = require("../src/modules/4.03-teacher/teacher.permissions");

const SYNC = process.argv.includes("--sync-permissions");
const DRY = process.argv.includes("--dry");

function toPermissionsArray(sections) {
  return Object.entries(sections || {}).map(([section, actionKeys]) => ({
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
  const changes = [];

  for (const p of newPerms) {
    const oldSet = existingMap.get(p.section) || new Set();
    const newSet = new Set(p.actionKeys);
    const added = [...newSet].filter((a) => !oldSet.has(a));
    const removed = [...oldSet].filter((a) => !newSet.has(a));
    if (added.length || removed.length) {
      changes.push({ section: p.section, added, removed });
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
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[TeacherRoles Seed] MongoDB${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}`,
  );
  console.log(
    "[TeacherRoles Seed] MERGE (default): matritsadagi section'lar yangilanadi, begonalari saqlanadi" +
      (SYNC ? " (--sync-permissions berildi — backward-compat, xatti-harakat bir xil)" : "") +
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
      console.log(`  + YARATILADI: "${def.title}" (${def.scopeLevel})`);
      for (const p of def.permissions) {
        console.log(`      ${p.section}: [${p.actionKeys.join(", ")}]`);
      }
      if (!DRY) await RoleModel.create(def);
      created += 1;
      continue;
    }

    const changes = diffPermissions(existing.permissions, def.permissions);
    if (changes.length === 0) {
      console.log(`  = O'ZGARISHSIZ: "${def.title}"`);
      unchanged += 1;
      continue;
    }

    const merged = mergePermissions(existing.permissions, def.permissions);
    const preservedCount = merged.length - def.permissions.length;

    console.log(
      `  ↻ SYNC${DRY ? " (DRY)" : ""}: "${def.title}" — ${changes.length} section, ` +
        `${preservedCount} ta begona section saqlanadi:`,
    );
    for (const c of changes) {
      if (c.added.length) console.log(`      + ${c.section}: [${c.added.join(", ")}] qo'shiladi`);
      if (c.removed.length) {
        console.log(`      - ${c.section}: [${c.removed.join(", ")}] OLIB TASHLANADI`);
      }
    }

    if (!DRY) {
      existing.permissions = merged;
      existing.scopeLevel = def.scopeLevel;
      await existing.save();
    }
    synced += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi " : "Yaratildi   "}: ${created}`);
  console.log(`  ${DRY ? "Sync bo'lardi" : "Sync qilindi"}: ${synced}`);
  console.log(`  O'zgarishsiz : ${unchanged}`);
  console.log("═══════════════════════════════════════════════════");
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi.");
    console.log("  Yozish: node seed/teacher-roles.seed.js");
  }
  console.log("");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[TeacherRoles Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
