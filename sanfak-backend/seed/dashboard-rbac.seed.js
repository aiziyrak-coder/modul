"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");

const DASHBOARD_ACTIONS = [ACTIONS.READ];
const DASHBOARD_TITLE = "Boshqaruv paneli (rektor)";
const DASHBOARD_GROUP_CODE = "system";

const DASHBOARD_SECTION = {
  section: MODULES.DASHBOARD,
  actionKeys: DASHBOARD_ACTIONS,
};

const TARGET_ROLES = [ROLES.REKTOR];

const sameSet = (a, b) => {
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
};

async function main() {
  const dry = process.argv.includes("--dry");

  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[Dashboard RBAC] MongoDB ga ulandi${dry ? "  (DRY-RUN — DBga yozilmaydi)" : ""}\n`,
  );

  const PermissionModel = require("../src/modules/4.01-auth/permission/permission.model");
  const PermissionGroupModel = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  console.log("── 1. Ruxsat katalogi ────────────────────────────────────────");
  const group = await PermissionGroupModel.findOne({
    code: DASHBOARD_GROUP_CODE,
    active: true,
  })
    .select("_id")
    .lean();
  if (!group) {
    console.warn(
      `  ⚠ "${DASHBOARD_GROUP_CODE}" PermissionGroup topilmadi — avval ` +
        `node seed/permissionGroups.seed.js (hozircha guruhsiz yoziladi)`,
    );
  }
  const groupIds = group ? [group._id] : [];

  const existingPerm = await PermissionModel.findOne({
    section: MODULES.DASHBOARD,
  });

  if (!existingPerm) {
    if (!dry) {
      await PermissionModel.create({
        section: MODULES.DASHBOARD,
        title: DASHBOARD_TITLE,
        actionKeys: DASHBOARD_ACTIONS,
        groups: groupIds,
        active: true,
      });
    }
    console.log(
      `  + ${MODULES.DASHBOARD} [CREATE] ${DASHBOARD_ACTIONS.join(", ")}`,
    );
  } else {
    const currentGroupIds = (existingPerm.groups || []).map(String);
    const wantGroupIds = groupIds.map(String);
    const needsUpdate =
      existingPerm.title !== DASHBOARD_TITLE ||
      existingPerm.active !== true ||
      !sameSet(existingPerm.actionKeys || [], DASHBOARD_ACTIONS) ||
      !sameSet(currentGroupIds, wantGroupIds);

    if (needsUpdate) {
      if (!dry) {
        existingPerm.title = DASHBOARD_TITLE;
        existingPerm.actionKeys = DASHBOARD_ACTIONS;
        existingPerm.groups = groupIds;
        existingPerm.active = true;
        await existingPerm.save();
      }
      console.log(
        `  ~ ${MODULES.DASHBOARD} [UPDATE] ${DASHBOARD_ACTIONS.join(", ")}`,
      );
    } else {
      console.log(`  = ${MODULES.DASHBOARD} [O'ZGARISHSIZ]`);
    }
  }

  console.log("\n── 2. Rol grantlari ──────────────────────────────────────────");
  let granted = 0;
  let unchanged = 0;
  let missing = 0;

  for (const title of TARGET_ROLES) {
    const role = await RoleModel.findOne({ title });
    if (!role) {
      console.log(`  ~ rol topilmadi (o'tkazildi): ${title}`);
      missing++;
      continue;
    }

    const current = (role.permissions || []).find(
      (p) => p.section === MODULES.DASHBOARD,
    );
    if (current && sameSet(current.actionKeys || [], DASHBOARD_ACTIONS)) {
      console.log(
        `  = ${title} — allaqachon "${MODULES.DASHBOARD}:${ACTIONS.READ}" bor`,
      );
      unchanged++;
      continue;
    }

    if (!dry) {
      const others = (role.permissions || []).filter(
        (p) => p.section !== MODULES.DASHBOARD,
      );
      role.permissions = [...others, DASHBOARD_SECTION];
      await role.save();
    }
    console.log(
      `  + ${title} — "${MODULES.DASHBOARD}:${DASHBOARD_ACTIONS.join(",")}" berildi` +
        (current ? " (eski qiymat yangilandi)" : ""),
    );
    granted++;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(
    `  Berildi: ${granted} | O'zgarishsiz: ${unchanged} | Rol yo'q: ${missing}`,
  );
  console.log(`  Kalit  : ${MODULES.DASHBOARD}:${ACTIONS.READ}`);
  if (dry) console.log("  DRY-RUN — DB o'zgarmadi");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = {
  DASHBOARD_SECTION,
  DASHBOARD_ACTIONS,
  DASHBOARD_TITLE,
  DASHBOARD_GROUP_CODE,
  TARGET_ROLES,
};

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[Dashboard RBAC Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
