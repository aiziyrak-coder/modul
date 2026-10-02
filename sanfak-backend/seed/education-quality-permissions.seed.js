"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const Role = require("../src/modules/4.01-auth/role/role.model");

const { EQ_CATALOG: EQ_PERMISSIONS } = require("./quality-role-access.seed");

const GROUP_CODE = "4.12";

const QA_EQ_GRANTS = [
  { section: "eqIndicator", actionKeys: ["read", "create", "update", "delete"] },
  { section: "eqSubmission", actionKeys: ["read", "review"] },
  { section: "eqAnnouncement", actionKeys: ["read", "create", "delete"] },
  { section: "eqReport", actionKeys: ["read"] },
];

const ROLE_GRANTS = {
  talim_sifati_nazorati: QA_EQ_GRANTS,
  oqituvchi: [
    { section: "eqSubmission", actionKeys: ["create", "readOwn"] },
    { section: "eqAnnouncement", actionKeys: ["readOwn"] },
  ],
  rahbar: [
    { section: "eqAnnouncement", actionKeys: ["read"] },
    { section: "eqReport", actionKeys: ["read"] },
  ],
};

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[EQ Permissions Seed] MongoDBga ulandi");

  const group = await PermissionGroup.findOne({ code: GROUP_CODE }).lean();
  if (!group) {
    console.error(
      `[EQ Permissions Seed] XATO: "${GROUP_CODE}" permissionGroup topilmadi — avval permissionGroups.seed.js ni ishga tushiring`,
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  for (const p of EQ_PERMISSIONS) {
    await Permission.findOneAndUpdate(
      { section: p.section },
      {
        $set: { title: p.title, actionKeys: p.actionKeys, active: true },
        $addToSet: { groups: group._id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    console.log(`[EQ Permissions Seed] katalog: ${p.section} → [${p.actionKeys.join(",")}] (guruh: ${GROUP_CODE})`);
  }

  for (const [roleTitle, grants] of Object.entries(ROLE_GRANTS)) {
    const role = await Role.findOne({ title: roleTitle });
    if (!role) {
      console.warn(`[EQ Permissions Seed] rol topilmadi (o'tkazildi): ${roleTitle}`);
      continue;
    }
    if (!Array.isArray(role.permissions)) role.permissions = [];
    for (const grant of grants) {
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
    const summary = grants.map((g) => `${g.section}:[${g.actionKeys.join(",")}]`).join("  ");
    console.log(`[EQ Permissions Seed] rol '${roleTitle}' ← ${summary}`);
  }

  const grouped = await Permission.countDocuments({
    section: { $in: EQ_PERMISSIONS.map((p) => p.section) },
    groups: group._id,
  });
  console.log(`[EQ Permissions Seed] "${GROUP_CODE}" guruhida eq* sectionlar: ${grouped}/4`);
  console.log("[EQ Permissions Seed] TAYYOR — rol bilan kirilganда ta'lim sifati menyulari chiqadi");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[EQ Permissions Seed] XATO:", err);
  process.exit(1);
});
