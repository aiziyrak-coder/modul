"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const USERS = [
  { oneIdPin: "20000000000001", firstName: "Zulfiya", lastName: "Abdullayeva", roleTitle: ROLES.ILMIY_KENGASH_KOTIBI },
  { oneIdPin: "20000000000002", firstName: "Dilnoza", lastName: "Nazarova", roleTitle: ROLES.ILMIY_KENGASH_AZOSI },
  { oneIdPin: "20000000000003", firstName: "Bahodir", lastName: "Tursunov", roleTitle: ROLES.OQITUVCHI },
  { oneIdPin: "20000000000004", firstName: "Bobur", lastName: "Karimov", roleTitle: ROLES.REKTOR },
];

async function main() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[CouncilUsers Seed] MongoDB ga ulandi\n");

  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let updated = 0;

  for (const u of USERS) {
    const role = await RoleModel.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(`  ⚠ Rol topilmadi: ${u.roleTitle} — avval council-roles.seed.js ni ishga tushiring`);
      continue;
    }

    const existing = await UserModel.findOne({ oneIdPin: u.oneIdPin });
    if (existing) {
      existing.role = role._id;
      existing.firstName = u.firstName;
      existing.lastName = u.lastName;
      existing.active = true;
      await existing.save();
      console.log(`  ~ SKIP/UPDATE: "${u.oneIdPin}" (${u.roleTitle})`);
      updated++;
    } else {
      await UserModel.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        active: true,
      });
      console.log(`  + YARATILDI: "${u.oneIdPin}" → ${u.roleTitle}`);
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi: ${created}   Yangilandi: ${updated}   Jami: ${USERS.length}`);
  console.log("  Login (14 xonali): 20000000000001=kotib, ...002=a'zo, ...003=o'qituvchi, ...004=rektor");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[CouncilUsers Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
