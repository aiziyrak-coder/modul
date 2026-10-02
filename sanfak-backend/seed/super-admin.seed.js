"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");
const RoleModel = require("../src/modules/4.01-auth/role/role.model");

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[SuperAdmin Seed] MongoDB ga ulandi\n");

  const allActions = Object.values(ACTIONS);

  const permissions = Object.values(MODULES).map((section) => ({
    section,
    actionKeys: allActions,
  }));

  console.log(`  Modullar soni : ${permissions.length}`);
  console.log(`  Action'lar   : ${allActions.join(", ")}\n`);

  const existing = await RoleModel.findOne({ title: ROLES.SUPER_ADMIN });

  if (existing) {
    existing.permissions = permissions;
    existing.scopeLevel = "global";
    existing.isSystem = true;
    existing.active = true;
    existing.desc = "Super admin — barcha modullarga to'liq kirish";
    await existing.save();
    console.log(`  ~ YANGILANDI: "super_admin" — ${permissions.length} modul x ${allActions.length} action`);
  } else {
    await RoleModel.create({
      title: ROLES.SUPER_ADMIN,
      desc: "Super admin — barcha modullarga to'liq kirish",
      scopeLevel: "global",
      isSystem: true,
      active: true,
      permissions,
    });
    console.log(`  + YARATILDI: "super_admin" — ${permissions.length} modul x ${allActions.length} action`);
  }

  console.log("\n  Login: POST /api/auth  →  { \"oneIdPin\": \"test_super_admin\" }");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[SuperAdmin Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
