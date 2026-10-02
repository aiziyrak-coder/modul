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
  SEARCH,
  FILTER,
  EXPORT,
  APPROVE,
  REJECT,
} = ACTIONS;

const CRUD = [CREATE, READ, READ_ALL, UPDATE, DELETE, SEARCH, FILTER];
const CRUD_EXPORT = [...CRUD, EXPORT];
const VIEW = [READ, READ_ALL, SEARCH, FILTER];
const VIEW_EXPORT = [...VIEW, EXPORT];

const MALAKA_MENEJER = ROLES.MALAKA_MENEJER;
const MALAKA_OQITUVCHI = ROLES.MALAKA_OQITUVCHI;
const MALAKA_TINGLOVCHI = ROLES.MALAKA_TINGLOVCHI;

const MANAGER_PERMISSIONS = [
  { section: MODULES.QUAL_COURSE_TYPE, actionKeys: CRUD },
  { section: MODULES.QUAL_COURSE, actionKeys: CRUD_EXPORT },
  { section: MODULES.QUAL_TOPIC, actionKeys: CRUD },
  { section: MODULES.QUAL_CALENDAR_PLAN, actionKeys: CRUD },
  { section: MODULES.QUAL_SOURCE, actionKeys: CRUD },
  { section: MODULES.QUAL_TEACHER, actionKeys: [...VIEW, UPDATE] },

  {
    section: MODULES.QUAL_PETITION,
    actionKeys: [...VIEW_EXPORT, CREATE, APPROVE, REJECT],
  },
  { section: MODULES.QUAL_CONTRACT, actionKeys: [...VIEW_EXPORT, DELETE] },
  { section: MODULES.QUAL_PAYMENT, actionKeys: [...VIEW_EXPORT, CREATE, UPDATE] },
  {
    section: MODULES.QUAL_COURSE_SUBSCRIPTION,
    actionKeys: [...VIEW_EXPORT, UPDATE],
  },

  { section: MODULES.QUAL_ACCESS_TEST, actionKeys: CRUD },
  { section: MODULES.QUAL_EXIT_TEST, actionKeys: CRUD },
  { section: MODULES.QUAL_TEST_CONFIG, actionKeys: [...VIEW, UPDATE] },
  { section: MODULES.QUAL_SURVEY, actionKeys: CRUD },
  { section: MODULES.QUAL_SURVEY_ANSWER, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_ACCESS_TEST_RESULT, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_EXIT_TEST_RESULT, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_FINAL_TEST_RESULT, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_TOPIC_COMPLETION, actionKeys: VIEW_EXPORT },

  { section: MODULES.QUAL_TOPIC_LECTURE, actionKeys: VIEW },
  { section: MODULES.QUAL_TOPIC_PRACTICAL, actionKeys: VIEW },
  { section: MODULES.QUAL_TOPIC_VIDEO, actionKeys: VIEW },
  { section: MODULES.QUAL_TOPIC_SCENARIO, actionKeys: VIEW },
  { section: MODULES.QUAL_TOPIC_FINAL_TEST, actionKeys: VIEW },

  { section: MODULES.QUAL_NOTIFICATION, actionKeys: CRUD },
  { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
  { section: MODULES.CHAT, actionKeys: [CREATE, READ, READ_ALL, DELETE] },
];

const TEACHER_PERMISSIONS = [
  { section: MODULES.QUAL_COURSE, actionKeys: VIEW },
  { section: MODULES.QUAL_COURSE_TYPE, actionKeys: VIEW },
  { section: MODULES.QUAL_TOPIC, actionKeys: VIEW },
  { section: MODULES.QUAL_TEACHER, actionKeys: [...VIEW, UPDATE] },
  { section: MODULES.QUAL_COURSE_SUBSCRIPTION, actionKeys: VIEW },

  { section: MODULES.QUAL_TOPIC_LECTURE, actionKeys: CRUD },
  { section: MODULES.QUAL_TOPIC_PRACTICAL, actionKeys: CRUD },
  { section: MODULES.QUAL_TOPIC_VIDEO, actionKeys: CRUD },
  { section: MODULES.QUAL_TOPIC_SCENARIO, actionKeys: CRUD },
  { section: MODULES.QUAL_TOPIC_FINAL_TEST, actionKeys: CRUD },

  { section: MODULES.QUAL_ACCESS_TEST, actionKeys: CRUD },
  { section: MODULES.QUAL_EXIT_TEST, actionKeys: CRUD },
  { section: MODULES.QUAL_TEST_CONFIG, actionKeys: [...VIEW, UPDATE] },

  { section: MODULES.QUAL_ACCESS_TEST_RESULT, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_EXIT_TEST_RESULT, actionKeys: VIEW_EXPORT },
  { section: MODULES.QUAL_FINAL_TEST_RESULT, actionKeys: VIEW_EXPORT },
  {
    section: MODULES.QUAL_TOPIC_COMPLETION,
    actionKeys: [...VIEW_EXPORT, UPDATE],
  },

  { section: MODULES.QUAL_SOURCE, actionKeys: CRUD },
  { section: MODULES.QUAL_NOTIFICATION, actionKeys: VIEW },
  { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
  { section: MODULES.CHAT, actionKeys: [CREATE, READ, READ_ALL, DELETE] },
];

const LISTENER_PERMISSIONS = [
  { section: MODULES.QUAL_LISTENER_PORTAL, actionKeys: [READ] },
  { section: MODULES.QUAL_COURSE_TYPE, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_COURSE, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_TOPIC, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_SOURCE, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_CALENDAR_PLAN, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_COURSE_SUBSCRIPTION, actionKeys: [READ] },

  { section: MODULES.QUAL_PETITION, actionKeys: [CREATE, READ, READ_ALL] },
  { section: MODULES.QUAL_CONTRACT, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_PAYMENT, actionKeys: [CREATE, READ] },

  { section: MODULES.QUAL_TOPIC_LECTURE, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_TOPIC_PRACTICAL, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_TOPIC_VIDEO, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_TOPIC_SCENARIO, actionKeys: [READ, READ_ALL] },
  { section: MODULES.QUAL_TOPIC_FINAL_TEST, actionKeys: [READ, READ_ALL] },
  {
    section: MODULES.QUAL_TOPIC_COMPLETION,
    actionKeys: [CREATE, READ, READ_ALL, UPDATE],
  },

  { section: MODULES.QUAL_SURVEY, actionKeys: [READ] },
  { section: MODULES.QUAL_SURVEY_ANSWER, actionKeys: [CREATE] },

  {
    section: MODULES.QUAL_ACCESS_TEST_RESULT,
    actionKeys: [CREATE, READ, READ_ALL, UPDATE],
  },
  {
    section: MODULES.QUAL_EXIT_TEST_RESULT,
    actionKeys: [CREATE, READ, READ_ALL, UPDATE],
  },
  {
    section: MODULES.QUAL_FINAL_TEST_RESULT,
    actionKeys: [CREATE, READ, READ_ALL, UPDATE],
  },

  { section: MODULES.QUAL_NOTIFICATION, actionKeys: [READ, READ_ALL] },
  { section: MODULES.PROVINCE, actionKeys: [READ, READ_ALL] },
  { section: MODULES.REGION, actionKeys: [READ, READ_ALL] },
  { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
  { section: MODULES.CHAT, actionKeys: [CREATE, READ, READ_ALL, DELETE] },
];

const rolesDef = [
  {
    title: MALAKA_MENEJER,
    desc: "Malaka oshirish menejeri — kurslar, qabul, shartnoma/to'lov, monitoring va hisobotlar",
    scopeLevel: "global",
    permissions: MANAGER_PERMISSIONS,
  },
  {
    title: MALAKA_OQITUVCHI,
    desc: "Malaka oshirish o'qituvchisi — o'z kurslari materiali, testlari va o'zlashtirish",
    scopeLevel: "global",
    permissions: TEACHER_PERMISSIONS,
  },
  {
    title: MALAKA_TINGLOVCHI,
    desc: "Malaka oshirish tinglovchisi — ariza, to'lov, o'quv jarayoni va testlar",
    scopeLevel: "self",
    permissions: LISTENER_PERMISSIONS,
  },
];

const QUAL_SECTIONS = new Set(
  Object.entries(MODULES)
    .filter(([k]) => k.startsWith("QUAL_"))
    .map(([, v]) => v),
);
const MANAGED_SECTIONS = QUAL_SECTIONS;
const ADDITIVE_SECTIONS = new Set([MODULES.CHAT, MODULES.NOTIFICATION]);

function mergePermissions(existing = [], qualPerms) {
  const keptSections = new Set();
  const kept = existing.filter((p) => {
    if (MANAGED_SECTIONS.has(p.section) || keptSections.has(p.section)) return false;
    keptSections.add(p.section);
    return true;
  });
  const next = qualPerms.filter(
    (p) => MANAGED_SECTIONS.has(p.section) || !keptSections.has(p.section),
  );
  return [...kept, ...next];
}

function countDuplicateSections(permissions = []) {
  const sections = permissions.map((p) => p.section);
  return sections.length - new Set(sections).size;
}

function diffPermissions(before = [], after = []) {
  const flat = (list) =>
    new Set(
      list.flatMap((p) => (p.actionKeys || []).map((a) => `${p.section}:${a}`)),
    );
  const b = flat(before);
  const a = flat(after);
  return {
    added: [...a].filter((x) => !b.has(x)).sort(),
    removed: [...b].filter((x) => !a.has(x)).sort(),
  };
}

async function main() {
  const dry = process.argv.includes("--dry");

  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[QualRoles Seed] MongoDB ga ulandi — 4.4 rol grantlari${dry ? " (DRY-RUN, yozilmaydi)" : ""}\n`,
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let merged = 0;

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });

    if (!existing) {
      const doc = {
        title: def.title,
        desc: def.desc,
        scopeLevel: def.scopeLevel,
        isSystem: false,
        active: true,
        permissions: def.permissions,
      };
      if (!dry) await RoleModel.create(doc);
      created += 1;
      console.log(
        `  + YARATILADI: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section`,
      );
      continue;
    }

    const next = mergePermissions(existing.permissions, def.permissions);
    const { added, removed } = diffPermissions(existing.permissions, next);
    const duplicates = countDuplicateSections(existing.permissions) - countDuplicateSections(next);

    if (!dry) {
      existing.permissions = next;
      existing.active = true;
      if (!existing.desc) existing.desc = def.desc;
      await existing.save();
    }
    merged += 1;
    console.log(
      `  ~ MERGE: "${def.title}" — ${next.length} section ` +
        `(+${added.length} / -${removed.length})`,
    );
    if (added.length) console.log(`      + ${added.join(", ")}`);
    if (removed.length) console.log(`      - ${removed.join(", ")}`);
    if (duplicates > 0) console.log(`      ~ takroriy bo'lim yozuvlari yig'ildi: ${duplicates}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Yaratildi: ${created}   Merge: ${merged}   Jami: ${rolesDef.length} rol` +
      `${dry ? "   (DRY — DB o'zgarmadi)" : ""}`,
  );
  console.log("  Sinov hisoblari (ixtiyoriy): seed/malaka-users.seed.js");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = {
  rolesDef,
  MANAGER_PERMISSIONS,
  TEACHER_PERMISSIONS,
  LISTENER_PERMISSIONS,
  QUAL_SECTIONS,
  MANAGED_SECTIONS,
  ADDITIVE_SECTIONS,
  mergePermissions,
  diffPermissions,
  countDuplicateSections,
};

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualRoles Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
