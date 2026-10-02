"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const SEED_DEV_ADMIN = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const USERS = [
  ...(SEED_DEV_ADMIN
    ? [{ oneIdPin: "00000000000000", firstName: "Super", lastName: "Admin", roleTitle: ROLES.SUPER_ADMIN }]
    : []),
  { oneIdPin: "10000000000001", firstName: "Ikrom", lastName: "Abduvahobov", roleTitle: ROLES.AMALIYOT_BOLIMI },
  { oneIdPin: "10000000000002", firstName: "Akmal", lastName: "Karimov", roleTitle: ROLES.REKTOR },
  { oneIdPin: "10000000000003", firstName: "Bobur", lastName: "Yo'ldoshev", roleTitle: ROLES.TIBBIYOT_BIRLASHMASI_RAHBARI },
  { oneIdPin: "10000000000004", firstName: "Tizim", lastName: "Admini", roleTitle: ROLES.MODERATOR },
];

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[PracticeUsers Seed] MongoDB ga ulandi\n");

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");

  let created = 0;
  let skipped = 0;

  for (const u of USERS) {
    const role = await Role.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(`  ⚠ Rol topilmadi: ${u.roleTitle} — avval practice-roles.seed.js ni ishga tushiring`);
      continue;
    }
    const existing = await User.findOne({ oneIdPin: u.oneIdPin });
    if (existing) {
      if (String(existing.role) !== String(role._id)) {
        existing.role = role._id;
        await existing.save();
      }
      console.log(`  ~ SKIP: "${u.oneIdPin}" (${u.roleTitle}) allaqachon bor`);
      skipped += 1;
    } else {
      await User.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        active: true,
      });
      console.log(`  + YARATILDI: "${u.oneIdPin}" -> ${u.roleTitle}`);
      created += 1;
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Yaratildi : ${created}`);
  console.log(`  O'tkazildi: ${skipped}`);
  console.log("───────────────────────────────────────────────────");
  console.log("  ONE ID tugmasi: 00000000000000 (super_admin)");
  console.log("  Login tab (14 xonali): 10000000000001=amaliyot, ...002=rektor, ...003=rahbar, ...004=admin");
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[PracticeUsers Seed] XATO:", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([f, e]) => console.error(`  - ${f}: ${e.message}`));
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
