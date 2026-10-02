"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const ROLE_TITLE = ROLES.MALAKA_TINGLOVCHI;

const ADD = [
  { section: MODULES.QUAL_COURSE_TYPE, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  { section: MODULES.PROVINCE, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
  { section: MODULES.REGION, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] },
];
const ADD_SECTIONS = new Set(ADD.map((p) => p.section));

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", process.env.MONGO_HOST);

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const role = await RoleModel.findOne({ title: ROLE_TITLE });
  if (!role) throw new Error("malaka_tinglovchi roli topilmadi");

  const others = (role.permissions || []).filter((p) => !ADD_SECTIONS.has(p.section));
  role.permissions = [...others, ...ADD];
  await role.save();

  console.log(
    `  ~ rol yangilandi: malaka_tinglovchi ` +
      `(boshqa ${others.length} ta bo'lim saqlandi, +${ADD.length} qo'shildi)`,
  );
  console.log("    · qualCourseType read,readAll\n    · province read,readAll\n    · region read,readAll");
  console.log("\n⚠️ Tinglovchi QAYTA LOGIN qilishi kerak (yangi ruxsatlar uchun).");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { ADD, ROLE_TITLE };

if (require.main === module) {
  main().catch((err) => {
    console.error("\n[LISTENER RBAC SEED ERROR]", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
