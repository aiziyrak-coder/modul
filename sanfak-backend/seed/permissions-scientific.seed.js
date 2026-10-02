"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Permission = require("../src/modules/4.01-auth/permission/permission.model");
const PermissionGroup = require("../src/modules/4.01-auth/permissionGroup/permissionGroup.model");
const { MODULES, ACTIONS } = require("../src/config/constants");

const SCIENTIFIC_GROUP_CODE = "4.10";

const SCIENTIFIC_SECTIONS = [
  MODULES.ARTICLE,
  MODULES.MONOGRAPH,
  MODULES.THESIS,
  MODULES.PATENT,
  MODULES.COPYRIGHT,
  MODULES.CONFERENCE,
  MODULES.METHODICAL_RECOMMENDATION,
  MODULES.ANNUAL_REPORT,
  MODULES.DEPARTMENT_WORK_PLAN,
  MODULES.QUALIFYING_APPLICANT,
  MODULES.ECONOMIC_CONTRACT,
  MODULES.OAK_JOURNAL,
  MODULES.THESIS_CATEGORY,
  MODULES.SCIENTIFIC_TEMPLATE,
  MODULES.H_INDEX,
  MODULES.SCIENTIFIC_DEGREE,
  MODULES.SCIENTIFIC_TITLE,
  MODULES.DEFENSE,
  MODULES.EXAM_SPECIALTY,
  MODULES.SCIENTIFIC_POST,
  MODULES.METHODICAL_SPECIALTY,
  MODULES.STARTUP,
  MODULES.STARTUP_TYPE,
  MODULES.SCIENTIFIC_PORTAL,
];

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

const SCIENTIFIC_ACTIONS_OVERRIDE = {
  [MODULES.ARTICLE]: APPROVAL_ACTIONS,
  [MODULES.MONOGRAPH]: APPROVAL_ACTIONS,
  [MODULES.THESIS]: APPROVAL_ACTIONS,
  [MODULES.PATENT]: APPROVAL_ACTIONS,
  [MODULES.COPYRIGHT]: APPROVAL_ACTIONS,
  [MODULES.CONFERENCE]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.STARTUP]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.METHODICAL_RECOMMENDATION]: APPROVAL_ACTIONS,
  [MODULES.ANNUAL_REPORT]: APPROVAL_ACTIONS,
  [MODULES.DEPARTMENT_WORK_PLAN]: APPROVAL_ACTIONS,
  [MODULES.QUALIFYING_APPLICANT]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.CHANGE_STATUS,
    ACTIONS.EXPORT,
  ],
  [MODULES.ECONOMIC_CONTRACT]: APPROVAL_ACTIONS,
  [MODULES.SCIENTIFIC_DEGREE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.SCIENTIFIC_TITLE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.DEFENSE]: [...CRUD_ACTIONS, ACTIONS.APPROVE, ACTIONS.REJECT, ACTIONS.EXPORT],
  [MODULES.METHODICAL_SPECIALTY]: [
    ACTIONS.CREATE,
    ACTIONS.READ,
    ACTIONS.READ_ALL,
    ACTIONS.UPDATE,
    ACTIONS.DELETE,
  ],
  [MODULES.SCIENTIFIC_PORTAL]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.DASHBOARD],
};

const SCIENTIFIC_TITLES = {
  [MODULES.ARTICLE]: "Ilmiy maqolalar",
  [MODULES.MONOGRAPH]: "Monografiyalar",
  [MODULES.THESIS]: "Tezislar",
  [MODULES.PATENT]: "Patentlar",
  [MODULES.COPYRIGHT]: "Mualliflik huquqi",
  [MODULES.CONFERENCE]: "Konferensiyalar",
  [MODULES.METHODICAL_RECOMMENDATION]: "Uslubiy tavsiyalar",
  [MODULES.ANNUAL_REPORT]: "Yillik hisobotlar",
  [MODULES.DEPARTMENT_WORK_PLAN]: "Kafedra ish rejasi",
  [MODULES.QUALIFYING_APPLICANT]: "Malakaviy talabgorlar",
  [MODULES.ECONOMIC_CONTRACT]: "X/Sh shartnomalar (4.10.9)",
  [MODULES.OAK_JOURNAL]: "OAK jurnallari",
  [MODULES.THESIS_CATEGORY]: "Tezis toifalari",
  [MODULES.SCIENTIFIC_TEMPLATE]: "Ilmiy namunalar",
  [MODULES.H_INDEX]: "H-indeks",
  [MODULES.SCIENTIFIC_DEGREE]: "Ilmiy darajalar",
  [MODULES.SCIENTIFIC_TITLE]: "Ilmiy unvonlar",
  [MODULES.DEFENSE]: "Himoya",
  [MODULES.EXAM_SPECIALTY]: "Imtihon mutaxassisliklari",
  [MODULES.SCIENTIFIC_POST]: "Ilmiy bo'lim e'lonlari",
  [MODULES.METHODICAL_SPECIALTY]: "Uslubiy tavsiyanoma ixtisosliklari",
  [MODULES.STARTUP]: "Startaplar",
  [MODULES.STARTUP_TYPE]: "Startap loyiha turlari",
  [MODULES.SCIENTIFIC_PORTAL]: "Ilmiy bo'lim portali (menyu belgisi)",
};

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

async function seed() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Scientific Permissions Seed] Connected to MongoDB");

  const group = await PermissionGroup.findOne({
    code: SCIENTIFIC_GROUP_CODE,
    active: true,
  })
    .select("_id")
    .lean();
  if (!group) {
    console.warn(
      `[Scientific Permissions Seed] ⚠ "${SCIENTIFIC_GROUP_CODE}" PermissionGroup topilmadi — ` +
        `avval permissionGroups.seed.js ni ishga tushiring (hozircha guruhsiz seed qilinadi)`,
    );
  }
  const groupIds = group ? [group._id] : [];

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const section of SCIENTIFIC_SECTIONS) {
    const actionKeys = SCIENTIFIC_ACTIONS_OVERRIDE[section] || CRUD_ACTIONS;
    const title = SCIENTIFIC_TITLES[section] || section;

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
  console.log("  ILMIY BO'LIM (4.10) — FAQAT shu modullar");
  console.log(`  Sections:    ${SCIENTIFIC_SECTIONS.length}`);
  console.log(`  Created:     ${created}`);
  console.log(`  Updated:     ${updated}`);
  console.log(`  Unchanged:   ${unchanged}`);
  console.log(
    `  Group:       ${group ? SCIENTIFIC_GROUP_CODE : "YO'Q (linkage o'tkazib yuborildi)"}`,
  );
  console.log("  (Deactivate + global drift check — bu skriptda YO'Q)");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Scientific Permissions Seed] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
