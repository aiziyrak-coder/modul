"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { ROLES } = require("../src/config/constants");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const USERS = [
  { oneIdPin: "41000000000001", firstName: "Ibrohim", lastName: "Abduvahobov", roleTitle: ROLES.ILMIY_BOLIM },
  { oneIdPin: "41000000000002", firstName: "Akmal", lastName: "Karimov", roleTitle: ROLES.OQITUVCHI },
  { oneIdPin: "41000000000003", firstName: "Botir", lastName: "Toshmatov", roleTitle: ROLES.KAFEDRA_MUDIRI },
  { oneIdPin: "41000000000004", firstName: "Malika", lastName: "Yusupova", roleTitle: ROLES.DEKAN },
  { oneIdPin: "41000000000005", firstName: "O'ktam", lastName: "Hasanov", roleTitle: ROLES.PROREKTOR },
  { oneIdPin: "41000000000006", firstName: "Sardor", lastName: "Mirzayev", roleTitle: ROLES.REKTOR },
  { oneIdPin: "41000000000007", firstName: "Gulnora", lastName: "Nazarova", roleTitle: ROLES.ILMIY_KENGASH_KOTIBI },
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
  console.log("[ScientificUsers Seed] MongoDB ga ulandi\n");

  const UserModel = require("../src/modules/4.01-auth/user/user.model");
  const RoleModel = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let updated = 0;

  for (const u of USERS) {
    const role = await RoleModel.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(`  ⚠ Rol topilmadi: ${u.roleTitle} — avval scientific-roles.seed.js ni ishga tushiring`);
      continue;
    }

    const existing = await UserModel.findOne({ oneIdPin: u.oneIdPin });
    if (existing) {
      existing.role = role._id;
      existing.firstName = u.firstName;
      existing.lastName = u.lastName;
      existing.active = true;
      await existing.save();
      console.log(`  ~ UPDATE: "${u.oneIdPin}" (${u.roleTitle})`);
      updated++;
    } else {
      await UserModel.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        active: true,
      });
      console.log(`  + YARATILDI: "${u.oneIdPin}" → ${u.roleTitle} (${u.lastName} ${u.firstName[0]}.)`);
      created++;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Yaratildi: ${created}   Yangilandi: ${updated}   Jami: ${USERS.length}`);
  console.log("  Login PIN'lari: 41000000000001 (ilmiy) ... 41000000000007 (kotib)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[ScientificUsers Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
