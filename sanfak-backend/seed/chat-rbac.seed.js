"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { MODULES, ACTIONS } = require("../src/config/constants");

const CHAT_SECTION = {
  section: MODULES.CHAT,
  actionKeys: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.DELETE],
};

const TARGET_ROLES = ["malaka_tinglovchi", "malaka_oqituvchi", "oqituvchi"];

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  for (const title of TARGET_ROLES) {
    const role = await RoleModel.findOne({ title });
    if (!role) {
      console.log(`  ~ rol topilmadi (o'tkazildi): ${title}`);
      continue;
    }
    const others = (role.permissions || []).filter(
      (p) => p.section !== MODULES.CHAT,
    );
    role.permissions = [...others, CHAT_SECTION];
    role.active = true;
    await role.save();
    console.log(
      `  + chat huquqi berildi: ${title} (${CHAT_SECTION.actionKeys.join(", ")})`,
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[CHAT RBAC SEED ERROR]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
