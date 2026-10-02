"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Role = require("../src/modules/4.01-auth/role/role.model");
const User = require("../src/modules/4.01-auth/user/user.model");
const Resident = require("../src/modules/4.05-residency/resident/resident.model");
const Department = require("../src/references/department/department.model");
const { MODULE_PIN_PREFIX, modulePin } = require("./_module-pins");

const PREFIX = MODULE_PIN_PREFIX["4.5"];
const P = (slot) => modulePin(PREFIX, slot);

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const USERS = [
  { pin: P(21), title: "magistratura_bolim", firstName: "Bo'lim", lastName: "Xodim" },
  { pin: P(22), title: "ilmiy_rahbar", firstName: "Ilmiy", lastName: "Rahbar" },
  { pin: P(23), title: "klinik_ustoz", firstName: "Klinik", lastName: "Ustoz" },
  { pin: P(24), title: "kafedra_mudiri", firstName: "Kafedra", lastName: "Mudiri" },
  { pin: P(25), title: "magistrant", firstName: "Test", lastName: "Magistrant" },
  { pin: P(26), title: "rezident", firstName: "Test", lastName: "Rezident2" },
  { pin: P(27), title: "rektor", firstName: "Test", lastName: "Rektor" },
];

async function ensureResident(userDoc, supUserDoc, patch) {
  if (!userDoc) return;
  const exists = await Resident.findOne({ user: userDoc._id });
  if (exists) {
    if (!exists.department && patch.department) {
      exists.department = patch.department;
      exists.departmentTitle = patch.departmentTitle || null;
      await exists.save();
      console.log(`  ~resident (${patch.program}) kafedra biriktirildi: ${patch.departmentTitle}`);
      return;
    }
    console.log(`  ~resident (${patch.program}) mavjud`);
    return;
  }
  await Resident.create({
    user: userDoc._id,
    fullName: `${userDoc.firstName} ${userDoc.lastName}`.trim(),
    supervisor: supUserDoc?._id || null,
    supervisorName: supUserDoc
      ? `${supUserDoc.firstName} ${supUserDoc.lastName}`.trim()
      : null,
    fundingType: "byudjet",
    courseNumber: 1,
    academicYear: "2025-2026",
    active: true,
    ...patch,
  });
  console.log(`  +resident (${patch.program}) yaratildi`);
}

async function run() {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);

  const byTitle = {};
  for (const u of USERS) {
    const role = await Role.findOne({ title: u.title });
    if (!role) {
      console.warn(`  [SKIP] rol topilmadi: "${u.title}" (avval residency-roles.seed.js)`);
      continue;
    }
    let doc = await User.findOne({ oneIdPin: u.pin });
    if (!doc) {
      doc = await User.create({
        oneIdPin: u.pin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        active: true,
      });
      console.log(`  +user ${u.title.padEnd(20)} PIN=${u.pin}`);
    } else {
      doc.role = role._id;
      doc.active = true;
      await doc.save();
      console.log(`  ~user ${u.title.padEnd(20)} PIN=${u.pin}`);
    }
    byTitle[u.title] = doc;
  }

  const [depA, depB] = await Department.find().sort({ title: 1 }).limit(2);
  if (!depA) {
    console.warn("  [SKIP] kafedra topilmadi — references seed ishga tushmagan");
  } else if (byTitle.kafedra_mudiri && !byTitle.kafedra_mudiri.department) {
    byTitle.kafedra_mudiri.department = depA._id;
    await byTitle.kafedra_mudiri.save();
    console.log(`  +kafedra_mudiri kafedrasi: ${depA.title}`);
  }

  await ensureResident(byTitle.magistrant, byTitle.ilmiy_rahbar, {
    program: "magistratura",
    department: depA?._id,
    departmentTitle: depA?.title,
  });
  await ensureResident(byTitle.rezident, byTitle.klinik_ustoz, {
    program: "ordinatura",
    department: depB?._id || depA?._id,
    departmentTitle: depB?.title || depA?.title,
  });

  const pins = USERS.map((u) => u.pin);
  console.log(
    `\n4.5 test userlar tayyor — ${pins.length} ta PIN, prefiks "${PREFIX}": ` +
      `${pins[0]}..${pins[pins.length - 1]}`,
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Test-users seed XATO:", err.message);
  process.exit(1);
});
