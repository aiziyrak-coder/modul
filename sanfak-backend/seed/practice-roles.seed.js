"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");
const { NOTIFICATION_ACTIONS } = require("./_module-permission-lib");

const CRUD = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
  ACTIONS.SEARCH,
  ACTIONS.FILTER,
];
const READ = [ACTIONS.READ, ACTIONS.READ_ALL];

const rolesDef = [
  {
    title: ROLES.AMALIYOT_BOLIMI,
    desc: "Amaliyot bo'limi — amaliyot bazalari, talabalar va shartnoma loyihalarini boshqaradi",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.MEDICAL_ORGANIZATION, actionKeys: CRUD },
      {
        section: MODULES.PRACTICE,
        actionKeys: [
          ACTIONS.CREATE,
          ACTIONS.READ,
          ACTIONS.READ_ALL,
          ACTIONS.UPDATE,
          ACTIONS.DELETE,
          ACTIONS.CHANGE_STATUS,
          ACTIONS.EXPORT,
          ACTIONS.SEARCH,
          ACTIONS.FILTER,
        ],
      },
      {
        section: MODULES.PRACTICE_STUDENT,
        actionKeys: [...CRUD, ACTIONS.EXPORT],
      },
      { section: MODULES.ORG_TYPE, actionKeys: READ },
      { section: MODULES.PROVINCE, actionKeys: READ },
      { section: MODULES.REGION, actionKeys: READ },
      { section: MODULES.USER, actionKeys: [ACTIONS.SEARCH] },
      { section: MODULES.DIRECTION, actionKeys: READ },
      { section: MODULES.COURSE, actionKeys: READ },
      { section: MODULES.ACADEMIC_YEAR, actionKeys: READ },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.REKTOR,
    desc: "Rektor — amaliyot shartnomalarini ERI bilan tasdiqlaydi yoki rad etadi (1-tomon)",
    scopeLevel: "global",
    permissions: [
      {
        section: MODULES.PRACTICE,
        actionKeys: [
          ACTIONS.READ,
          ACTIONS.READ_ALL,
          ACTIONS.SIGN,
          ACTIONS.REJECT,
          ACTIONS.EXPORT,
          ACTIONS.SEARCH,
          ACTIONS.FILTER,
        ],
      },
      { section: MODULES.DIRECTION, actionKeys: READ },
      { section: MODULES.ACADEMIC_YEAR, actionKeys: READ },
      { section: MODULES.COURSE, actionKeys: READ },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI,
    desc: "Tibbiyot birlashmasi rahbari — rektor tasdiqlagan shartnomani 2-tomon sifatida ERI bilan imzolaydi yoki rad etadi",
    scopeLevel: "global",
    permissions: [
      {
        section: MODULES.PRACTICE,
        actionKeys: [
          ACTIONS.READ,
          ACTIONS.READ_ALL,
          ACTIONS.SIGN,
          ACTIONS.REJECT,
          ACTIONS.EXPORT,
          ACTIONS.SEARCH,
          ACTIONS.FILTER,
        ],
      },
      { section: MODULES.DIRECTION, actionKeys: READ },
      { section: MODULES.ACADEMIC_YEAR, actionKeys: READ },
      { section: MODULES.COURSE, actionKeys: READ },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.MODERATOR,
    desc: "Moderator — 4.13 ma'lumotnomalarini (tashkilot turlari, viloyatlar, tumanlar, o'quv yillari, kurslar) boshqaradi",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.ORG_TYPE, actionKeys: CRUD },
      { section: MODULES.PROVINCE, actionKeys: CRUD },
      { section: MODULES.REGION, actionKeys: CRUD },
      { section: MODULES.ACADEMIC_YEAR, actionKeys: CRUD },
      { section: MODULES.COURSE, actionKeys: CRUD },
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[PracticeRoles Seed] MongoDB ga ulandi");
  console.log("[PracticeRoles Seed] MERGE rejim: faqat 4.13 section'lari, boshqa modullar TEGILMAYDI\n");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let merged = 0;

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });
    const newSections = new Set(def.permissions.map((p) => p.section));

    if (!existing) {
      await RoleModel.create({
        title: def.title,
        desc: def.desc,
        scopeLevel: def.scopeLevel,
        isSystem: false,
        active: true,
        permissions: def.permissions,
      });
      console.log(
        `  + YARATILDI: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section`,
      );
      created++;
    } else {
      const kept = (existing.permissions || []).filter(
        (p) => !newSections.has(p.section),
      );
      existing.permissions = [...kept, ...def.permissions];
      await existing.save();
      console.log(
        `  ~ MERGE: "${def.title}" — ${def.permissions.length} ta 4.13 section yangilandi (boshqalari saqlandi)`,
      );
      merged++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi : ${created}`);
  console.log(`  Merge     : ${merged}`);
  console.log(`  Jami      : ${rolesDef.length} rol ko'rib chiqildi`);
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Keyingi qadam: npm run seed:permissions (orgType/region/district katalogga)\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { rolesDef };

if (require.main === module) {
  main().catch((err) => {
    console.error("[PracticeRoles Seed] XATO:", err.message);
    if (err.errors) {
      Object.entries(err.errors).forEach(([field, e]) =>
        console.error(`  - ${field}: ${e.message}`),
      );
    }
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
