"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { MODULES, ACTIONS } = require("../src/config/constants");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const Role = require("../src/modules/4.01-auth/role/role.model");

const GROUP_CODE = "4.6";

const SCIENCE_COUNCIL_ACTIONS = [
  ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE,
  ACTIONS.CHANGE_STATUS, ACTIONS.REVIEW, ACTIONS.SIGN, ACTIONS.DASHBOARD,
  ACTIONS.MANAGE_MEMBERS, ACTIONS.SUBMIT_WORK, ACTIONS.NOTIFICATIONS,
];

const COUNCIL_MEMBER_ACTIONS = [
  ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE,
];

const CATALOG = [
  { section: MODULES.SCIENCE_COUNCIL, title: "Ilmiy kengash (ilmiy ishlar)", actionKeys: SCIENCE_COUNCIL_ACTIONS },
  { section: MODULES.COUNCIL_MEMBER, title: "Ilmiy kengash — a'zolar", actionKeys: COUNCIL_MEMBER_ACTIONS },
];

const KOTIB_GRANTS = [
  { section: MODULES.SCIENCE_COUNCIL, actionKeys: [ACTIONS.MANAGE_MEMBERS] },
  { section: MODULES.COUNCIL_MEMBER, actionKeys: COUNCIL_MEMBER_ACTIONS },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[SC Member Perms Seed] MongoDBga ulandi");

  const group = await PermissionGroup.findOne({ code: GROUP_CODE }).lean();
  if (!group) {
    console.error(`[SC Member Perms Seed] XATO: "${GROUP_CODE}" permissionGroup topilmadi — avval permissionGroups.seed.js ni ishga tushiring`);
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const p of CATALOG) {
    await Permission.findOneAndUpdate(
      { section: p.section },
      {
        $set: { title: p.title, actionKeys: p.actionKeys, active: true },
        $addToSet: { groups: group._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`[SC Member Perms Seed] katalog: ${p.section} → [${p.actionKeys.join(",")}] (guruh: ${GROUP_CODE})`);
  }

  const role = await Role.findOne({ title: "ilmiy_kengash_kotibi" });
  if (!role) {
    console.warn("[SC Member Perms Seed] rol topilmadi: ilmiy_kengash_kotibi");
  } else {
    if (!Array.isArray(role.permissions)) role.permissions = [];
    for (const grant of KOTIB_GRANTS) {
      const existing = role.permissions.find((x) => x.section === grant.section);
      if (existing) {
        const merged = new Set([...(existing.actionKeys || []), ...grant.actionKeys]);
        existing.actionKeys = [...merged];
      } else {
        role.permissions.push({ section: grant.section, actionKeys: [...grant.actionKeys] });
      }
    }
    role.markModified("permissions");
    await role.save();
    console.log("[SC Member Perms Seed] rol 'ilmiy_kengash_kotibi' ← scienceCouncil:manageMembers + councilMember:CRUD");
  }

  const grouped = await Permission.countDocuments({
    section: { $in: CATALOG.map((p) => p.section) },
    groups: group._id,
  });
  console.log(`[SC Member Perms Seed] "${GROUP_CODE}" guruhida: ${grouped}/${CATALOG.length} section`);
  console.log("[SC Member Perms Seed] TAYYOR — kotib a'zo yarata oladi, ruxsatlar rollar UI'sida ko'rinadi");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[SC Member Perms Seed] XATO:", err);
  process.exit(1);
});
