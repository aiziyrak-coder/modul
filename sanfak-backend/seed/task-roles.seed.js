"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const LEADER_TASK = ["create", "read", "readAll", "update", "delete", "changeStatus", "export"];

const EXECUTOR_TASK = ["create", "read", "readAll", "update", "changeStatus"];

const CATEGORY_READ = ["read", "readAll"];
const CATEGORY_MANAGE = ["create", "read", "readAll", "update", "delete"];

const GRANTS = {
  rektor: { task: LEADER_TASK, taskCategory: CATEGORY_READ },
  prorektor: { task: LEADER_TASK, taskCategory: CATEGORY_READ },
  oquv_uslubiy_boshqarma: { task: LEADER_TASK, taskCategory: CATEGORY_READ },
  dekan: { task: LEADER_TASK, taskCategory: CATEGORY_READ },
  kafedra_mudiri: { task: LEADER_TASK, taskCategory: CATEGORY_READ },

  oqituvchi: { task: EXECUTOR_TASK, taskCategory: CATEGORY_READ },

  moderator: { task: ["manageMembers"], taskCategory: CATEGORY_MANAGE },
};

const REVOKES = {
  rektor: { taskCategory: ["create", "update", "delete"] },
  prorektor: { taskCategory: ["create", "update", "delete"] },
  dekan: { taskCategory: ["create", "update", "delete"] },
  kafedra_mudiri: { taskCategory: ["create", "update", "delete"] },
};

const dry = process.argv.includes("--dry");

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const roles = mongoose.connection.db.collection("roles");

  if (dry) console.log("  (DRY-RUN — DBga yozilmaydi)\n");

  const titles = [...new Set([...Object.keys(GRANTS), ...Object.keys(REVOKES)])];
  let totalChanges = 0;

  for (const title of titles) {
    const role = await roles.findOne({ title });
    if (!role) {
      console.warn(`  [SKIP] rol topilmadi: "${title}"`);
      continue;
    }
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    const bySection = new Map(perms.map((p) => [String(p.section), p]));
    const changes = [];

    for (const [section, wantActions] of Object.entries(GRANTS[title] || {})) {
      const existing = bySection.get(section);
      if (!existing) {
        const added = { section, actionKeys: [...wantActions] };
        perms.push(added);
        bySection.set(section, added);
        changes.push(`+${section}[${wantActions.join(",")}]`);
      } else {
        const have = new Set(existing.actionKeys || []);
        const missing = wantActions.filter((a) => !have.has(a));
        if (missing.length) {
          existing.actionKeys = [...(existing.actionKeys || []), ...missing];
          changes.push(`${section}+[${missing.join(",")}]`);
        }
      }
    }

    for (const [section, dropActions] of Object.entries(REVOKES[title] || {})) {
      const existing = bySection.get(section);
      if (!existing) continue;
      const have = new Set(existing.actionKeys || []);
      const present = dropActions.filter((a) => have.has(a));
      if (present.length) {
        existing.actionKeys = (existing.actionKeys || []).filter((a) => !present.includes(a));
        changes.push(`${section}-[${present.join(",")}]`);
      }
    }

    if (changes.length) {
      if (!dry) await roles.updateOne({ _id: role._id }, { $set: { permissions: perms } });
      totalChanges += changes.length;
      console.log(`  [${title}] ${changes.join("  ")}`);
    } else {
      console.log(`  [${title}] o'zgarishsiz`);
    }
  }

  console.log(
    `\n4.7 Task RBAC seed tugadi — ${totalChanges} ta o'zgarish${dry ? " (DRY — yozilmadi)" : ""}.`,
  );
  await mongoose.disconnect();
}

module.exports = { GRANTS, REVOKES, LEADER_TASK, EXECUTOR_TASK };

if (require.main === module) {
  run().catch((err) => {
    console.error("4.7 Task RBAC seed XATO:", err.message);
    process.exit(1);
  });
}
