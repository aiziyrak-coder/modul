"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const DEPT_GIGIYENA = "Gigiyena va ekologiya kafedrasi";

const USERS = [
  {
    oneIdPin: "40300000000001",
    firstName: "Sanjar",
    lastName: "Abdusalimov",
    roleTitle: ROLES.KAFEDRA_MUDIRI,
    departmentTitle: DEPT_GIGIYENA,
    note: "TZ 4.3 — kafedra bosqichi (yuklama taqsimoti + reja tasdiqlash)",
  },
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
  console.log(
    `[TeacherUsers Seed] MongoDB${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const Department = require("../src/references/department/department.model");

  const departments = await Department.find({
    faculty: { $ne: null, $exists: true },
  })
    .select("_id title faculty")
    .lean();

  let created = 0;
  let skipped = 0;

  for (const u of USERS) {
    const role = await Role.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(
        `  ⚠ SKIP: rol topilmadi — "${u.roleTitle}". Avval: node seed/teacher-roles.seed.js`,
      );
      continue;
    }

    let dept = null;
    if (u.departmentTitle) {
      dept = departments.find((d) => d.title === u.departmentTitle) || null;
      if (!dept) {
        console.warn(
          `  ⚠ SKIP: kafedra topilmadi — "${u.departmentTitle}". ` +
            "Avval: node seed/references.seed.js",
        );
        continue;
      }
    }

    const existing = await User.findOne({ oneIdPin: u.oneIdPin });
    if (existing) {
      console.log(`  ~ SKIP     ${u.oneIdPin}  ${u.roleTitle} (allaqachon bor)`);
      skipped += 1;
      continue;
    }

    console.log(
      `  + ${DRY ? "YARATILARDI" : "YARATILDI  "} ${u.oneIdPin}  ` +
        `${u.roleTitle.padEnd(16)} ${u.firstName} ${u.lastName}` +
        (dept ? `  (kafedra: ${dept.title})` : "  (global scope)"),
    );
    console.log(`      ${u.note}`);
    if (!DRY) {
      await User.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        department: dept ? dept._id : null,
        faculty: dept ? dept.faculty : null,
        active: true,
      });
    }
    created += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi" : "Yaratildi  "}: ${created}`);
  console.log(`  O'tkazildi  : ${skipped}`);
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi.");
  } else {
    console.log("\n  4.3 oqimi uchun to'liq to'plam:");
    console.log("    40200000000003  →  o'qituvchi      (4.2 seedidan)");
    console.log("    40200000000009  →  kadrlar         (4.2 seedidan)");
    console.log("    40300000000001  →  kafedra mudiri  (shu seed)");
    console.log("    40200000000004  →  dekan           (4.2 seedidan)");
  }
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[TeacherUsers Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
