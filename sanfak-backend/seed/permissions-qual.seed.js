"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const { MODULES, ACTIONS } = require("../src/config/constants");

const QUAL_GROUP_CODE = "4.4";

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

const QUAL_ACTIONS_OVERRIDE = {
  [MODULES.QUAL_COURSE]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.QUAL_CONTRACT]: APPROVAL_ACTIONS,
  [MODULES.QUAL_PETITION]: APPROVAL_ACTIONS,
  [MODULES.QUAL_LISTENER_PORTAL]: [ACTIONS.READ],
  [MODULES.QUAL_TEST_CONFIG]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE],
  [MODULES.QUAL_CERTIFICATE]: [
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.SEARCH,
    ACTIONS.FILTER,
  ],
};

const QUAL_TITLES = {
  [MODULES.QUAL_COURSE]: "Malaka kurslari",
  [MODULES.QUAL_COURSE_TYPE]: "Kurs turlari",
  [MODULES.QUAL_COURSE_SUBSCRIPTION]: "Kurs obunalari",
  [MODULES.QUAL_CALENDAR_PLAN]: "Kalendar reja",
  [MODULES.QUAL_CONTRACT]: "Malaka shartnomalari",
  [MODULES.QUAL_PETITION]: "Malaka arizalari",
  [MODULES.QUAL_SOURCE]: "Malaka manbalari",
  [MODULES.QUAL_TEACHER]: "Malaka o'qituvchilari",
  [MODULES.QUAL_TOPIC]: "Mavzular",
  [MODULES.QUAL_NOTIFICATION]: "Malaka bildirishnomalari",
  [MODULES.QUAL_ACCESS_TEST_RESULT]: "Kirish test natijalari",
  [MODULES.QUAL_FINAL_TEST_RESULT]: "Yakuniy test natijalari",
  [MODULES.QUAL_EXIT_TEST_RESULT]: "Chiqish test natijalari",
  [MODULES.QUAL_TOPIC_COMPLETION]: "Mavzu o'zlashtirishi",
  [MODULES.QUAL_TOPIC_LECTURE]: "Mavzu ma'ruzalari",
  [MODULES.QUAL_TOPIC_PRACTICAL]: "Mavzu amaliy materiallari",
  [MODULES.QUAL_TOPIC_VIDEO]: "Mavzu video darslari",
  [MODULES.QUAL_TOPIC_SCENARIO]: "Mavzu vaziyatli masalalari",
  [MODULES.QUAL_TOPIC_FINAL_TEST]: "Mavzu yakuniy testi",
  [MODULES.QUAL_LISTENER_PORTAL]: "Tinglovchi portali (menyu belgisi)",
  [MODULES.QUAL_ACCESS_TEST]: "Kirish testi savollari",
  [MODULES.QUAL_EXIT_TEST]: "Chiqish testi savollari",
  [MODULES.QUAL_TEST_CONFIG]: "Test sozlamalari",
  [MODULES.QUAL_SURVEY]: "So'rovnoma savollari",
  [MODULES.QUAL_SURVEY_ANSWER]: "So'rovnoma javoblari",
  [MODULES.QUAL_CERTIFICATE]: "Hujjatni tasdiqlash (rektor)",
};

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function qualSections() {
  return Object.entries(MODULES)
    .filter(([key]) => key.startsWith("QUAL_"))
    .map(([, section]) => section);
}

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Qual Permissions Seed] Connected to MongoDB");

  const group = await PermissionGroup.findOne({
    code: QUAL_GROUP_CODE,
    active: true,
  })
    .select("_id")
    .lean();
  if (!group) {
    console.warn(
      `[Qual Permissions Seed] ⚠ "${QUAL_GROUP_CODE}" PermissionGroup topilmadi — ` +
        `avval permissionGroups.seed.js ni ishga tushiring (hozircha guruhsiz seed qilinadi)`,
    );
  }
  const groupIds = group ? [group._id] : [];

  const sections = qualSections();
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const section of sections) {
    const actionKeys = QUAL_ACTIONS_OVERRIDE[section] || CRUD_ACTIONS;
    const title = QUAL_TITLES[section] || section;

    const existing = await Permission.findOne({ section });

    if (!existing) {
      await Permission.create({
        section,
        title,
        actionKeys,
        groups: groupIds,
        active: true,
      });
      created++;
      console.log(
        `  + ${section.padEnd(30)} [CREATED] ${actionKeys.length} action`,
      );
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
      existing.title = title;
      existing.actionKeys = actionKeys;
      existing.groups = groupIds;
      existing.active = true;
      if (existing.group !== undefined) existing.group = undefined;
      await existing.save();
      updated++;
      console.log(
        `  ~ ${section.padEnd(30)} [UPDATED] ${actionKeys.length} action`,
      );
    } else {
      unchanged++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  MALAKA OSHIRISH (4.4) — FAQAT shu modullar");
  console.log(`  Sections:    ${sections.length}`);
  console.log(`  Created:     ${created}`);
  console.log(`  Updated:     ${updated}`);
  console.log(`  Unchanged:   ${unchanged}`);
  console.log(
    `  Group:       ${group ? QUAL_GROUP_CODE : "YO'Q (linkage o'tkazib yuborildi)"}`,
  );
  console.log("  (Deactivate + global drift check — bu skriptda YO'Q)");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Qual Permissions Seed] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
