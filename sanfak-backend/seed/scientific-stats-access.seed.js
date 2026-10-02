"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { MODULES, ACTIONS, ROLES } = require("../src/config/constants");

const SECTION = MODULES.SCIENTIFIC_PORTAL;
const ACTION = ACTIONS.READ_ALL;
const DASHBOARD_ACTION = ACTIONS.DASHBOARD;

const PRIMARY = [ROLES.ILMIY_BOLIM];
const EXTRA = [
  ROLES.KAFEDRA_MUDIRI,
  ROLES.DEKAN,
  ROLES.PROREKTOR,
  ROLES.REKTOR,
  ROLES.ILMIY_KENGASH_KOTIBI,
];

const DASHBOARD_ROLES = [
  ROLES.OQITUVCHI,
  ROLES.KAFEDRA_MUDIRI,
  ROLES.DEKAN,
  ROLES.PROREKTOR,
  ROLES.REKTOR,
  ROLES.ILMIY_KENGASH_KOTIBI,
];

function grantAction(permissions = [], section = SECTION, action = ACTION) {
  const list = permissions.map((p) => ({
    section: p.section,
    actionKeys: [...(p.actionKeys || [])],
  }));
  const found = list.find((p) => p.section === section);
  if (!found) {
    list.push({ section, actionKeys: [action] });
    return { permissions: list, changed: true };
  }
  if (found.actionKeys.includes(action)) return { permissions: list, changed: false };
  found.actionKeys.push(action);
  return { permissions: list, changed: true };
}

function withPortalRead(permissions = []) {
  return grantAction(permissions, SECTION, ACTION);
}

async function main() {
  const dry = process.argv.includes("--dry");
  const statsTargets = process.argv.includes("--all") ? [...PRIMARY, ...EXTRA] : PRIMARY;

  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);
  console.log(`  ${SECTION}:${ACTION} (Statistika)       → ${statsTargets.join(", ")}`);
  console.log(`  ${SECTION}:${DASHBOARD_ACTION} (Boshqaruv paneli) → ${DASHBOARD_ROLES.join(", ")}`);
  if (dry) console.log("  [--dry] hech narsa yozilmaydi\n");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  let changed = 0;

  const grantTo = async (title, action, label) => {
    const role = await RoleModel.findOne({ title });
    if (!role) {
      console.log(`  ~ rol topilmadi (o'tkazildi): ${title}`);
      return;
    }
    const res = grantAction(role.permissions, SECTION, action);
    if (!res.changed) {
      console.log(`  = allaqachon bor: ${title} → ${label}`);
      return;
    }
    changed += 1;
    if (dry) {
      console.log(`  + BERILADI (dry): ${title} → ${SECTION}:${action} (${label})`);
      return;
    }
    role.permissions = res.permissions;
    await role.save();
    console.log(`  + berildi: ${title} → ${SECTION}:${action} (${label})`);
  };

  for (const title of statsTargets) await grantTo(title, ACTION, "Statistika");
  for (const title of DASHBOARD_ROLES) await grantTo(title, DASHBOARD_ACTION, "Boshqaruv paneli");

  console.log(`\n${dry ? "o'zgarardi" : "o'zgardi"}: ${changed} ta grant`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[STATS ACCESS SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = {
  grantAction,
  withPortalRead,
  SECTION,
  ACTION,
  DASHBOARD_ACTION,
  DASHBOARD_ROLES,
};
