"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const RoleModel = require("../src/modules/4.01-auth/role/role.model");
const UserModel = require("../src/modules/4.01-auth/user/user.model");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const TEACHERS = [
  { oneIdPin: "22222222222201", firstName: "Aziz",    lastName: "Karimov",  middleName: "Baxtiyorovich", email: "aziz.karimov@test.uz",   phone: "+998901112211" },
  { oneIdPin: "22222222222202", firstName: "Dilnoza", lastName: "Rahimova", middleName: "Anvarovna",     email: "dilnoza.rahimova@test.uz", phone: "+998901112212" },
  { oneIdPin: "22222222222203", firstName: "Sardor",  lastName: "Yusupov",  middleName: "Ilhomovich",    email: "sardor.yusupov@test.uz",  phone: "+998901112213" },
  { oneIdPin: "22222222222204", firstName: "Malika",  lastName: "Tosheva",  middleName: "Farhodovna",    email: "malika.tosheva@test.uz",  phone: "+998901112214" },
];

const LISTENERS = [
  { oneIdPin: "33333333333301", firstName: "Jasur",  lastName: "Abdullayev", middleName: "Shavkatovich", email: "jasur.abdullayev@test.uz",  phone: "+998901112221" },
  { oneIdPin: "33333333333302", firstName: "Nodira", lastName: "Ismoilova",  middleName: "Botirovna",    email: "nodira.ismoilova@test.uz",  phone: "+998901112222" },
  { oneIdPin: "33333333333303", firstName: "Bekzod", lastName: "Nazarov",    middleName: "Olimovich",    email: "bekzod.nazarov@test.uz",    phone: "+998901112223" },
  { oneIdPin: "33333333333304", firstName: "Sevara", lastName: "Qodirova",   middleName: "Rustamovna",   email: "sevara.qodirova@test.uz",   phone: "+998901112224" },
];

async function upsertUser(u, roleId) {
  const existing = await UserModel.findOne({ oneIdPin: u.oneIdPin });
  if (existing) {
    if (String(existing.role) !== String(roleId)) {
      existing.role = roleId;
      await existing.save();
      return "rol-yangilandi";
    }
    return "skip";
  }
  await UserModel.create({ ...u, role: roleId, active: true });
  return "yaratildi";
}

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
  console.log("[MalakaUsers Seed] MongoDB ga ulandi\n");

  const teacherRole = await RoleModel.findOne({ title: "malaka_oqituvchi" });
  const listenerRole = await RoleModel.findOne({ title: "malaka_tinglovchi" });

  if (!teacherRole || !listenerRole) {
    console.error(
      "  XATO: malaka_oqituvchi / malaka_tinglovchi roli topilmadi.\n" +
        "  Avval: node seed/malaka-teacher.seed.js && node seed/malaka-tinglovchi.seed.js",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("── O'qituvchilar (malaka_oqituvchi) ───────────────────────────");
  for (const u of TEACHERS) {
    const r = await upsertUser(u, teacherRole._id);
    console.log(`  ${u.oneIdPin}  ${u.lastName} ${u.firstName}  → ${r}`);
  }

  console.log("\n── Tinglovchilar (malaka_tinglovchi) ──────────────────────────");
  for (const u of LISTENERS) {
    const r = await upsertUser(u, listenerRole._id);
    console.log(`  ${u.oneIdPin}  ${u.lastName} ${u.firstName}  → ${r}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  O'qituvchi login PIN'lari : ${TEACHERS.map((t) => t.oneIdPin).join(", ")}`);
  console.log(`  Tinglovchi login PIN'lari : ${LISTENERS.map((l) => l.oneIdPin).join(", ")}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[MalakaUsers Seed] XATO:", err.message);
  if (err.errors) {
    Object.entries(err.errors).forEach(([f, e]) => console.error(`  - ${f}: ${e.message}`));
  }
  mongoose.disconnect().finally(() => process.exit(1));
});
