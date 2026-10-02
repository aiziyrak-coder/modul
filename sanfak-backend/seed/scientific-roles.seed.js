"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");
const { NOTIFICATION_ACTIONS } = require("./_module-permission-lib");

const {
  CREATE,
  READ,
  READ_ALL,
  UPDATE,
  DELETE,
  APPROVE,
  REJECT,
  SIGN,
  CHANGE_STATUS,
  EXPORT,
  SEARCH,
  FILTER,
  DASHBOARD,
} = ACTIONS;

const CRUD = [CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH, FILTER];
const MODERATE = [READ, READ_ALL, APPROVE, REJECT, EXPORT, SEARCH, FILTER];
const VIEW_EXPORT = [READ, READ_ALL, EXPORT, SEARCH, FILTER];
const NOTIF = NOTIFICATION_ACTIONS;

const rolesDef = [
  {
    title: ROLES.ILMIY_BOLIM,
    desc: "Ilmiy bo'lim — barcha ilmiy ishlarni boshqarish, tasdiqlash, jurnal/toifa/namuna/mutaxassislik boshqaruvi (4.10)",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.ARTICLE, actionKeys: MODERATE },
      { section: MODULES.THESIS, actionKeys: MODERATE },
      { section: MODULES.METHODICAL_RECOMMENDATION, actionKeys: MODERATE },
      { section: MODULES.MONOGRAPH, actionKeys: MODERATE },
      { section: MODULES.CONFERENCE, actionKeys: [...CRUD, EXPORT] },
      { section: MODULES.ANNUAL_REPORT, actionKeys: VIEW_EXPORT },
      { section: MODULES.DEPARTMENT_WORK_PLAN, actionKeys: VIEW_EXPORT },
      { section: MODULES.ECONOMIC_CONTRACT, actionKeys: MODERATE },
      { section: MODULES.PATENT, actionKeys: MODERATE },
      { section: MODULES.COPYRIGHT, actionKeys: MODERATE },
      { section: MODULES.QUALIFYING_APPLICANT, actionKeys: [...CRUD, APPROVE, REJECT, CHANGE_STATUS, EXPORT] },
      { section: MODULES.OAK_JOURNAL, actionKeys: CRUD },
      { section: MODULES.THESIS_CATEGORY, actionKeys: CRUD },
      { section: MODULES.SCIENTIFIC_TEMPLATE, actionKeys: CRUD },
      { section: MODULES.METHODICAL_SPECIALTY, actionKeys: CRUD },
      { section: MODULES.H_INDEX, actionKeys: CRUD },
      { section: MODULES.SCIENTIFIC_DEGREE, actionKeys: MODERATE },
      { section: MODULES.SCIENTIFIC_TITLE, actionKeys: MODERATE },
      { section: MODULES.DEFENSE, actionKeys: MODERATE },
      { section: MODULES.EXAM_SPECIALTY, actionKeys: CRUD },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: CRUD },
      { section: MODULES.STARTUP, actionKeys: [READ, READ_ALL, SEARCH, FILTER, EXPORT] },
      { section: MODULES.STARTUP_TYPE, actionKeys: CRUD },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, READ_ALL] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.OQITUVCHI,
    desc: "Professor-o'qituvchi — maqola/tezis/uslubiy/monografiya yuboradi, H-index URL, yutuqlar, malakaviy imtihon (4.10)",
    scopeLevel: "self",
    permissions: [
      { section: MODULES.ARTICLE, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.THESIS, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.METHODICAL_RECOMMENDATION, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.MONOGRAPH, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.OAK_JOURNAL, actionKeys: [READ, READ_ALL] },
      { section: MODULES.THESIS_CATEGORY, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_TEMPLATE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.METHODICAL_SPECIALTY, actionKeys: [READ, READ_ALL] },
      { section: MODULES.H_INDEX, actionKeys: [CREATE, READ, READ_ALL, UPDATE] },
      { section: MODULES.SCIENTIFIC_DEGREE, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.SCIENTIFIC_TITLE, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.DEFENSE, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.PATENT, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.COPYRIGHT, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.QUALIFYING_APPLICANT, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH, FILTER] },
      { section: MODULES.EXAM_SPECIALTY, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      {
        section: MODULES.STARTUP,
        actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH, FILTER],
      },
      { section: MODULES.STARTUP_TYPE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.KAFEDRA_MUDIRI,
    desc: "Kafedra mudiri — konferensiya qabul qilish, ish reja/yillik hisobot/X-Sh shartnoma yaratish (4.10)",
    scopeLevel: "department",
    permissions: [
      { section: MODULES.CONFERENCE, actionKeys: [READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.DEPARTMENT_WORK_PLAN, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.ANNUAL_REPORT, actionKeys: [CREATE, READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.ECONOMIC_CONTRACT, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH, FILTER] },
      { section: MODULES.EXAM_SPECIALTY, actionKeys: [READ, READ_ALL] },
      { section: MODULES.ARTICLE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.DEKAN,
    desc: "Dekan — fakultet ish reja va yillik hisobotlarini tasdiqlaydi (4.10, 2-bosqich)",
    scopeLevel: "faculty",
    permissions: [
      { section: MODULES.DEPARTMENT_WORK_PLAN, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SEARCH, FILTER] },
      { section: MODULES.ANNUAL_REPORT, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SEARCH, FILTER] },
      { section: MODULES.ARTICLE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.PROREKTOR,
    desc: "Prorektor — ish reja/yillik yakuniy tasdiq, monografiya E-imzo, boshqaruv hisobotlari (4.10)",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.MONOGRAPH, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SIGN, SEARCH, FILTER] },
      { section: MODULES.DEPARTMENT_WORK_PLAN, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SEARCH, FILTER] },
      { section: MODULES.ANNUAL_REPORT, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SEARCH, FILTER] },
      { section: MODULES.SCIENTIFIC_DEGREE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.SCIENTIFIC_TITLE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.DEFENSE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.PATENT, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.COPYRIGHT, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.ARTICLE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.REKTOR,
    desc: "Rektor — uslubiy tavsiyanoma E-imzo (yakuniy, u-t-YY-N raqam), boshqaruv hisobotlari (4.10)",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.METHODICAL_RECOMMENDATION, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SIGN, SEARCH, FILTER] },
      { section: MODULES.SCIENTIFIC_DEGREE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.SCIENTIFIC_TITLE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.DEFENSE, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.PATENT, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.COPYRIGHT, actionKeys: [READ, READ_ALL, EXPORT, SEARCH, FILTER] },
      { section: MODULES.ARTICLE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },

  {
    title: ROLES.ILMIY_KENGASH_KOTIBI,
    desc: "Ilmiy kengash kotibi — uslubiy va monografiyaga E-imzo, malakaviy imtihon natijasini kiritadi (4.10)",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.METHODICAL_RECOMMENDATION, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SIGN, SEARCH, FILTER] },
      { section: MODULES.MONOGRAPH, actionKeys: [READ, READ_ALL, APPROVE, REJECT, SIGN, SEARCH, FILTER] },
      { section: MODULES.QUALIFYING_APPLICANT, actionKeys: [READ, READ_ALL, UPDATE, SEARCH, FILTER] },
      { section: MODULES.ARTICLE, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_POST, actionKeys: [READ, READ_ALL] },
      { section: MODULES.SCIENTIFIC_PORTAL, actionKeys: [READ, DASHBOARD] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIF },
    ],
  },
];

const SCIENTIFIC_SECTIONS = new Set([
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
  MODULES.METHODICAL_SPECIALTY,
  MODULES.H_INDEX,
  MODULES.SCIENTIFIC_DEGREE,
  MODULES.SCIENTIFIC_TITLE,
  MODULES.DEFENSE,
  MODULES.EXAM_SPECIALTY,
  MODULES.SCIENTIFIC_POST,
  MODULES.STARTUP,
  MODULES.STARTUP_TYPE,
  MODULES.SCIENTIFIC_PORTAL,
]);

const MANAGED_SECTIONS = new Set([...SCIENTIFIC_SECTIONS, MODULES.NOTIFICATION]);

function mergePermissions(existing = [], scientificPerms) {
  const preserved = existing.filter((p) => !MANAGED_SECTIONS.has(p.section));
  return [...preserved, ...scientificPerms];
}

const ACADEMIC_YEAR_ROLES = new Set([
  ROLES.ILMIY_BOLIM,
  ROLES.KAFEDRA_MUDIRI,
  ROLES.DEKAN,
  ROLES.PROREKTOR,
]);

function ensureAcademicYearRead(role) {
  if (!ACADEMIC_YEAR_ROLES.has(role.title)) return false;
  const has = (role.permissions || []).some(
    (p) => p.section === MODULES.ACADEMIC_YEAR,
  );
  if (has) return false;
  role.permissions.push({
    section: MODULES.ACADEMIC_YEAR,
    actionKeys: [READ, READ_ALL],
  });
  return true;
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[ScientificRoles Seed] MongoDB ga ulandi (non-destructive merge)\n");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let merged = 0;

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });
    if (existing) {
      existing.permissions = mergePermissions(existing.permissions, def.permissions);
      const ayAdded = ensureAcademicYearRead(existing);
      await existing.save();
      console.log(
        `  ~ MERGE: "${def.title}" — ${def.permissions.length} scientific section${ayAdded ? " (+academicYear read)" : ""}`,
      );
      merged++;
    } else {
      const role = new RoleModel({
        title: def.title,
        desc: def.desc,
        scopeLevel: def.scopeLevel,
        isSystem: false,
        active: true,
        permissions: def.permissions,
      });
      const ayAdded = ensureAcademicYearRead(role);
      await role.save();
      console.log(
        `  + YARATILDI: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section${ayAdded ? " (+academicYear read)" : ""}`,
      );
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi: ${created}   Merge: ${merged}   Jami: ${rolesDef.length} rol`);
  console.log("  Keyingi qadam: node seed/scientific-users.seed.js");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { rolesDef, SCIENTIFIC_SECTIONS, MANAGED_SECTIONS, mergePermissions };

if (require.main === module) {
  main().catch((err) => {
    console.error("[ScientificRoles Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
