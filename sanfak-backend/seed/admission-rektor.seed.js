"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const REKTOR_SECTION = {
  section: MODULES.INTERNATIONAL_ADMISSION,
  actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL],
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  const role = await RoleModel.findOne({ title: ROLES.REKTOR });
  if (!role) {
    throw new Error(
      `"${ROLES.REKTOR}" roli topilmadi — avval platforma rollarini yarating.`,
    );
  }

  const others = (role.permissions || []).filter(
    (p) => p.section !== MODULES.INTERNATIONAL_ADMISSION,
  );
  role.permissions = [...others, REKTOR_SECTION];
  await role.save();

  console.log(
    `  ~ rol yangilandi: ${ROLES.REKTOR} ` +
      `(boshqa ${others.length} ta bo'lim saqlandi)`,
  );
  console.log(`
══════════════════════════════════════════════════════
  REKTOR MONITORINGI TAYYOR

  Rol:    ${ROLES.REKTOR}
  Qo'shildi:
    · ${REKTOR_SECTION.section.padEnd(30)} ${REKTOR_SECTION.actionKeys.join(", ")}

  Sidebar'da ko'rinadi:  Xorijiy qabul → Statistika, Ro'yxat, Ariza kartochkasi

  ⚠️ Rektor QAYTA LOGIN qilishi kerak — token ichidagi
     ruxsatlar yangilanishi uchun.
══════════════════════════════════════════════════════
`);

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { REKTOR_SECTION };

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[4.8 REKTOR SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
