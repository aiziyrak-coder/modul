"use strict";
// Minimal "hodim" roli: xizmat xodimlari va mos tayyor roli bo'lmagan lavozimlar uchun.
// Faqat e'lonlarni o'qiydi va o'z bildirishnomalarini boshqaradi. Foydalanuvchi YARATMAYDI. Idempotent.
//   node seed/hodim-role.js --dry   # ko'rish
//   node seed/hodim-role.js         # yozish
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const { ROLES, MODULES, ACTIONS } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const SECTIONS = {
  [MODULES.ANNOUNCEMENT]: [ACTIONS.READ, ACTIONS.READ_ALL],
  [MODULES.NOTIFICATION]: [ACTIONS.READ, ACTIONS.READ_ALL, ACTIONS.UPDATE, ACTIONS.DELETE],
};
const DESC =
  "Hodim (minimal) — xizmat xodimlari va boshqa roli bo'lmagan lavozimlar: faqat e'lonlar va o'z bildirishnomalari.";

(async () => {
  await mongoose.connect(process.env.MONGO_HOST);
  const permissions = Object.entries(SECTIONS).map(([section, actionKeys]) => ({ section, actionKeys }));
  const existing = await RoleModel.findOne({ title: ROLES.HODIM });
  console.log(`${DRY ? "[DRY] " : ""}${existing ? "yangilanadi" : "yaratiladi"}: ${ROLES.HODIM}`);
  permissions.forEach((p) => console.log(`   ${p.section}: ${p.actionKeys.join(",")}`));
  if (!DRY) {
    await RoleModel.updateOne(
      { title: ROLES.HODIM },
      { $set: { desc: DESC, scopeLevel: "self", permissions, active: true } },
      { upsert: true },
    );
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
