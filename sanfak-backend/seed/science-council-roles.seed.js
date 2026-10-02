"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const {
  CREATE,
  READ,
  READ_ALL,
  UPDATE,
  DELETE,
  APPROVE,
  SIGN,
  CHANGE_STATUS,
  REVIEW,
  DASHBOARD,
  MANAGE_MEMBERS,
  SUBMIT_WORK,
  NOTIFICATIONS,
} = ACTIONS;

const rolesDef = [
  {
    title: ROLES.ILMIY_KENGASH_KOTIBI,
    desc: "Ilmiy kengash kotibi — ilmiy ishlar, kengash a'zolari va dalolatnoma boshqaruvi (4.06)",
    scopeLevel: "global",
    permissions: [
      {
        section: MODULES.SCIENCE_COUNCIL,
        actionKeys: [
          DASHBOARD,
          READ,
          READ_ALL,
          CREATE,
          UPDATE,
          DELETE,
          CHANGE_STATUS,
          MANAGE_MEMBERS,
          SIGN,
          NOTIFICATIONS,
        ],
      },
      {
        section: MODULES.SCIENTIFIC_WORK,
        actionKeys: [READ, READ_ALL, UPDATE, DELETE, APPROVE, SIGN],
      },
      { section: MODULES.WORK_REVIEW, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE] },
      { section: MODULES.WORK_DECISION, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, SIGN] },
    ],
  },

  {
    title: ROLES.ILMIY_KENGASH_AZOSI,
    desc: "Ilmiy kengash a'zosi — biriktirilgan ishlarga xulosa qoldiradi, rad etish/qaytarish (4.06)",
    scopeLevel: "self",
    permissions: [
      {
        section: MODULES.SCIENCE_COUNCIL,
        actionKeys: [DASHBOARD, READ, REVIEW, NOTIFICATIONS],
      },
      { section: MODULES.SCIENTIFIC_WORK, actionKeys: [READ, READ_ALL, APPROVE] },
      { section: MODULES.WORK_REVIEW, actionKeys: [CREATE, READ, READ_ALL, UPDATE] },
      { section: MODULES.WORK_DECISION, actionKeys: [READ, READ_ALL] },
    ],
  },

  {
    title: ROLES.OQITUVCHI,
    desc: "Professor-o'qituvchi — o'z ilmiy ishini ilmiy kengashga topshiradi (4.06)",
    scopeLevel: "self",
    permissions: [
      {
        section: MODULES.SCIENCE_COUNCIL,
        actionKeys: [READ, SUBMIT_WORK, NOTIFICATIONS],
      },
      { section: MODULES.SCIENTIFIC_WORK, actionKeys: [CREATE, READ, READ_ALL, UPDATE] },
      { section: MODULES.WORK_REVIEW, actionKeys: [READ] },
      { section: MODULES.WORK_DECISION, actionKeys: [READ, READ_ALL] },
    ],
  },

  {
    title: ROLES.TASHQI_TADQIQOTCHI,
    desc: "Tashqi tadqiqotchi — ilmiy ish arizasi qabul qilinganda avtomatik akkaunt (4.06, placeholder)",
    scopeLevel: "self",
    permissions: [],
  },
];

const MANAGED_SECTIONS = new Set([
  MODULES.SCIENCE_COUNCIL,
  MODULES.SCIENTIFIC_WORK,
  MODULES.WORK_REVIEW,
  MODULES.WORK_DECISION,
]);

function mergePermissions(existing = [], councilPerms) {
  const preserved = existing.filter((p) => !MANAGED_SECTIONS.has(p.section));
  return [...preserved, ...councilPerms];
}

async function main() {
  const dry = process.argv.includes("--dry");
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[ScienceCouncilRoles Seed] MongoDB ga ulandi (non-destructive merge)${dry ? "  — DRY-RUN, DBga yozilmaydi" : ""}\n`,
  );

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let merged = 0;

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });
    if (existing) {
      const before = (existing.permissions || []).map((p) => p.section);
      const after = mergePermissions(existing.permissions, def.permissions);
      const preserved = before.filter((s) => !MANAGED_SECTIONS.has(s));
      if (!dry) {
        existing.permissions = after;
        await existing.save();
      }
      console.log(
        `  ~ MERGE: "${def.title}" — 4.6: ${def.permissions.length} section, ` +
          `saqlandi: ${preserved.length} section (scopeLevel=${existing.scopeLevel}, tegilmadi)`,
      );
      merged++;
    } else {
      if (!dry) {
        await RoleModel.create({
          title: def.title,
          desc: def.desc,
          scopeLevel: def.scopeLevel,
          isSystem: false,
          active: true,
          permissions: def.permissions,
        });
      }
      console.log(
        `  + YARATILDI: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section`,
      );
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Yaratildi: ${created}   Merge: ${merged}   Jami: ${rolesDef.length} rol` +
      `${dry ? "   | DRY-RUN (DB o'zgarmadi)" : ""}`,
  );
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { rolesDef, MANAGED_SECTIONS, mergePermissions };

if (require.main === module) {
  main().catch((err) => {
    console.error("[ScienceCouncilRoles Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
