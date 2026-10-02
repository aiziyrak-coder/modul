"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const UserModel = require("../src/modules/4.01-auth/user/user.model");
const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const FacultyModel = require("../src/references/faculty/faculty.model");
const DepartmentModel = require("../src/references/department/department.model");
const PositionModel = require("../src/references/position/position.model");
const AcademicTitleModel = require("../src/references/academicTitle/academicTitle.model");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const TEST_USERS = [
  {
    oneIdPin: "test_super_admin",
    firstName: "Super",
    lastName: "Admin",
    middleName: "Test",
    email: "super@test.uz",
    phone: "+998901111111",
    roleTitle: "super_admin",
  },
  {
    oneIdPin: "test_rektor",
    firstName: "Rektor",
    lastName: "Testovich",
    middleName: "Yodgorovich",
    email: "rektor@test.uz",
    phone: "+998901111112",
    roleTitle: "rektor",
    positionTitle: "Rektor",
  },
  {
    oneIdPin: "test_prorektor",
    firstName: "Prorektor",
    lastName: "Testov",
    middleName: "Sharipovich",
    email: "prorektor@test.uz",
    phone: "+998901111113",
    roleTitle: "prorektor",
    positionTitle: "Prorektor",
  },
  {
    oneIdPin: "test_dekan",
    firstName: "Dekan",
    lastName: "Testov",
    email: "dekan@test.uz",
    phone: "+998901111114",
    roleTitle: "dekan",
    positionTitle: "Dekan",
    needsFaculty: true,
  },
  {
    oneIdPin: "test_kafedra_mudiri",
    firstName: "Kafedra",
    lastName: "Mudirov",
    email: "kafmudir@test.uz",
    phone: "+998901111115",
    roleTitle: "kafedra_mudiri",
    positionTitle: "Kafedra mudiri",
    titleName: "Professor",
    stake: 1.0,
    needsDepartment: true,
  },
  {
    oneIdPin: "test_oqituvchi_1",
    firstName: "Oqituvchi",
    lastName: "Birinchi",
    middleName: "Dotsent",
    email: "oqituvchi1@test.uz",
    phone: "+998901111116",
    roleTitle: "oqituvchi",
    positionTitle: "Dotsent",
    titleName: "Dotsent",
    stake: 1.0,
    needsDepartment: true,
  },
  {
    oneIdPin: "test_oqituvchi_2",
    firstName: "Oqituvchi",
    lastName: "Ikkinchi",
    middleName: "Assistent",
    email: "oqituvchi2@test.uz",
    phone: "+998901111117",
    roleTitle: "oqituvchi",
    positionTitle: "Assistent",
    titleName: "Assistent",
    stake: 0.5,
    needsDepartment: true,
  },
  {
    oneIdPin: "test_oub",
    firstName: "OUB",
    lastName: "Boshlig'i",
    email: "oub@test.uz",
    phone: "+998901111118",
    roleTitle: "oquv_uslubiy_boshqarma",
  },
];

async function seed() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[Test Users Seed] Connected");

  const roles = await RoleModel.find({}).select("title").lean();
  const roleMap = new Map(roles.map((r) => [r.title, r._id]));

  const positions = await PositionModel.find({}).select("title").lean();
  const positionMap = new Map(positions.map((p) => [p.title, p._id]));

  const titles = await AcademicTitleModel.find({}).select("title").lean();
  const titleMap = new Map(titles.map((t) => [t.title, t._id]));

  const faculty = await FacultyModel.findOne({ active: true }).select("_id").lean();
  const department = await DepartmentModel.findOne({ active: true }).select("_id").lean();

  if (!faculty) console.warn("⚠ Faculty topilmadi — dekan'ga faculty biriktirilmadi");
  if (!department) console.warn("⚠ Department topilmadi — kafedra/o'qituvchi'ga biriktirilmadi");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const u of TEST_USERS) {
    const roleId = roleMap.get(u.roleTitle);
    if (!roleId) {
      console.log(`  ✗ ${u.oneIdPin.padEnd(25)} | role "${u.roleTitle}" topilmadi (skip)`);
      skipped++;
      continue;
    }

    const userData = {
      oneIdPin: u.oneIdPin,
      firstName: u.firstName,
      lastName: u.lastName,
      middleName: u.middleName || null,
      email: u.email,
      phone: u.phone,
      role: roleId,
      active: true,
    };

    if (u.positionTitle && positionMap.has(u.positionTitle)) {
      userData.position = positionMap.get(u.positionTitle);
    }
    if (u.titleName && titleMap.has(u.titleName)) {
      userData.academicTitle = titleMap.get(u.titleName);
    }
    if (u.stake !== undefined) {
      userData.stake = u.stake;
    }
    if (u.needsDepartment && department) {
      userData.department = department._id;
    }

    const existing = await UserModel.findOne({ oneIdPin: u.oneIdPin });
    if (!existing) {
      await UserModel.create(userData);
      created++;
      console.log(`  + ${u.oneIdPin.padEnd(25)} | ${u.roleTitle}`);
    } else {
      Object.assign(existing, userData);
      await existing.save();
      updated++;
      console.log(`  ~ ${u.oneIdPin.padEnd(25)} | ${u.roleTitle} (updated)`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Created:  ${created}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Jami test users: ${created + updated}`);
  console.log("═══════════════════════════════════════════════════");

  console.log("\n🔑 LOGIN qilish uchun:");
  console.log("   POST /api/auth");
  console.log("   Body: { oneIdPin: \"test_super_admin\" }  (yoki boshqa PIN)");
  console.log("");
  for (const u of TEST_USERS) {
    console.log("   " + u.oneIdPin.padEnd(25) + " → " + u.roleTitle);
  }
  console.log("");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("[Test Users Seed] ERROR:", err);
  mongoose.disconnect().finally(() => process.exit(1));
});
