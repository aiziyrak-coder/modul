"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const { ACTIONS } = require("../src/config/constants");

const CRUD_ACTIONS = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];
const APPROVAL_ACTIONS = [
  ...CRUD_ACTIONS,
  ACTIONS.APPROVE,
  ACTIONS.REJECT,
  ACTIONS.SIGN,
  ACTIONS.EXPORT,
];
const APPROVAL_WITH_STATUS = [...APPROVAL_ACTIONS, ACTIONS.CHANGE_STATUS];
const READ_ONLY = [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.SEARCH, ACTIONS.FILTER];

const NOTIFICATION_ACTIONS = [
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
];

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function runModuleSeed({
  label,
  groupCode,
  sections,
  actionsOverride = {},
  titles = {},
  groupCodesOverride = {},
}) {
  const dry = process.argv.includes("--dry");
  try {
    await mongoose.connect(process.env.MONGO_HOST);
    console.log(
      `[${label}] Connected${dry ? "  (DRY-RUN — DBga yozilmaydi)" : ""}`,
    );

    const neededCodes = new Set([groupCode]);
    for (const codes of Object.values(groupCodesOverride)) {
      codes.forEach((c) => neededCodes.add(c));
    }
    const groupDocs = await PermissionGroup.find({
      code: { $in: [...neededCodes] },
      active: true,
    })
      .select("code _id")
      .lean();
    const codeToId = new Map(groupDocs.map((g) => [g.code, g._id]));
    if (!codeToId.has(groupCode)) {
      console.warn(
        `  ⚠ "${groupCode}" PermissionGroup topilmadi — avval permissionGroups.seed.js ` +
          `ni ishga tushiring (hozircha guruhsiz seed qilinadi)`,
      );
    }
    const groupIdsFor = (section) =>
      (groupCodesOverride[section] || [groupCode])
        .map((c) => codeToId.get(c))
        .filter(Boolean);

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const section of sections) {
      const actionKeys = actionsOverride[section] || CRUD_ACTIONS;
      const title = titles[section] || section;
      const groupIds = groupIdsFor(section);
      const existing = await Permission.findOne({ section });

      if (!existing) {
        if (!dry) {
          await Permission.create({
            section,
            title,
            actionKeys,
            groups: groupIds,
            active: true,
          });
        }
        created++;
        console.log(`  + ${section.padEnd(32)} [CREATE] ${actionKeys.length} action`);
        continue;
      }

      const existingGroupIds = (existing.groups || []).map((g) => String(g));
      const newGroupIds = groupIds.map((g) => String(g));
      const sameGroups =
        existingGroupIds.length === newGroupIds.length &&
        existingGroupIds.every((id) => newGroupIds.includes(id));

      const needsUpdate =
        existing.title !== title ||
        existing.active !== true ||
        !sameGroups ||
        !arraysEqual(existing.actionKeys || [], actionKeys);

      if (needsUpdate) {
        if (!dry) {
          existing.title = title;
          existing.actionKeys = actionKeys;
          existing.groups = groupIds;
          existing.active = true;
          if (existing.group !== undefined) existing.group = undefined;
          await existing.save();
        }
        updated++;
        console.log(`  ~ ${section.padEnd(32)} [UPDATE] ${actionKeys.length} action`);
      } else {
        unchanged++;
      }
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log(`  ${label} — FAQAT shu modul (izolyatsiya)`);
    console.log(
      `  Sections: ${sections.length} | Created: ${created} | Updated: ${updated} | Unchanged: ${unchanged}`,
    );
    console.log(`  Group: ${codeToId.has(groupCode) ? [...neededCodes].join(",") : "YO'Q (linkage skip)"}${dry ? "  | DRY-RUN (DB o'zgarmadi)" : ""}`);
    console.log("  (Deactivate + global drift — bu skriptda YO'Q — to'liq: seed:permissions)");
    console.log("═══════════════════════════════════════════════════\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`[${label}] ERROR:`, err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

module.exports = {
  CRUD_ACTIONS,
  APPROVAL_ACTIONS,
  APPROVAL_WITH_STATUS,
  READ_ONLY,
  NOTIFICATION_ACTIONS,
  runModuleSeed,
};
