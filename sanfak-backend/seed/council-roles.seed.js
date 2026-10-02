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
  CHANGE_STATUS,
  EXPORT,
} = ACTIONS;

const rolesDef = [
  {
    title: ROLES.ILMIY_KENGASH_KOTIBI,
    desc: "Ilmiy kengash kotibi — kengash tarkibi, topshiriq, unvon, ovoz berish, e'lon boshqaruvi",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.COUNCIL_MEMBER, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE] },
      { section: MODULES.COUNCIL_TASK, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, APPROVE, REJECT, CHANGE_STATUS, EXPORT] },
      { section: MODULES.RANK_APPLICATION, actionKeys: [READ, READ_ALL, UPDATE, APPROVE, REJECT] },
      { section: MODULES.VOTING_SESSION, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE, CHANGE_STATUS, EXPORT] },
      { section: MODULES.ANONYMOUS_VOTE, actionKeys: [READ_ALL] },
      { section: MODULES.ANNOUNCEMENT, actionKeys: [CREATE, READ, READ_ALL, DELETE] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.ILMIY_KENGASH_AZOSI,
    desc: "Kengash a'zosi — o'z topshiriqlarini bajaradi va so'rovnomalarda ovoz beradi",
    scopeLevel: "self",
    permissions: [
      { section: MODULES.COUNCIL_TASK, actionKeys: [READ, READ_ALL, CHANGE_STATUS] },
      { section: MODULES.VOTING_SESSION, actionKeys: [READ, READ_ALL] },
      { section: MODULES.ANONYMOUS_VOTE, actionKeys: [CREATE] },
      { section: MODULES.ANNOUNCEMENT, actionKeys: [READ, READ_ALL] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.OQITUVCHI,
    desc: "Professor-o'qituvchi — ilmiy unvon arizasi topshiradi (4.09)",
    scopeLevel: "self",
    permissions: [
      { section: MODULES.RANK_APPLICATION, actionKeys: [CREATE, READ, READ_ALL, UPDATE, DELETE] },
      { section: MODULES.ANNOUNCEMENT, actionKeys: [READ, READ_ALL] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
    ],
  },

  {
    title: ROLES.REKTOR,
    desc: "Rektor — kengash topshiriqlari va ovoz berish hisobotlarini kuzatadi (4.09)",
    scopeLevel: "global",
    permissions: [
      { section: MODULES.COUNCIL_TASK, actionKeys: [READ, READ_ALL, EXPORT] },
      { section: MODULES.VOTING_SESSION, actionKeys: [READ, EXPORT] },
      { section: MODULES.NOTIFICATION, actionKeys: NOTIFICATION_ACTIONS },
      { section: MODULES.ANNOUNCEMENT, actionKeys: [READ] },
    ],
  },
];

const COUNCIL_SECTIONS = new Set([
  MODULES.COUNCIL_MEMBER,
  MODULES.COUNCIL_TASK,
  MODULES.RANK_APPLICATION,
  MODULES.VOTING_SESSION,
  MODULES.ANONYMOUS_VOTE,
  MODULES.ANNOUNCEMENT,
]);

const MANAGED_SECTIONS = new Set([...COUNCIL_SECTIONS, MODULES.NOTIFICATION]);

function mergePermissions(existing = [], councilPerms) {
  const preserved = existing.filter((p) => !MANAGED_SECTIONS.has(p.section));
  return [...preserved, ...councilPerms];
}

module.exports = { rolesDef, COUNCIL_SECTIONS, MANAGED_SECTIONS, mergePermissions };

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[CouncilRoles Seed] MongoDB ga ulandi (non-destructive merge)\n");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let merged = 0;

  for (const def of rolesDef) {
    const existing = await RoleModel.findOne({ title: def.title });
    if (existing) {
      existing.permissions = mergePermissions(existing.permissions, def.permissions);
      await existing.save();
      console.log(`  ~ MERGE: "${def.title}" — ${def.permissions.length} council section qo'shildi/yangilandi`);
      merged++;
    } else {
      await RoleModel.create({
        title: def.title,
        desc: def.desc,
        scopeLevel: def.scopeLevel,
        isSystem: false,
        active: true,
        permissions: def.permissions,
      });
      console.log(`  + YARATILDI: "${def.title}" (${def.scopeLevel}) — ${def.permissions.length} section`);
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi: ${created}   Merge: ${merged}   Jami: ${rolesDef.length} rol`);
  console.log("  Keyingi qadam: node seed/permissions.seed.js");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[CouncilRoles Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
