"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const DEPT_DAVOLASH = "Ichki kasalliklar kafedrasi";
const DEPT_STOMATOLOGIYA = "Stomatologiya kafedrasi";
const DEPT_JAMOAT_SALOMATLIGI =
  "Jamoat salomatligi va sog'liqni saqlashni tashkil etish kafedrasi";

const USERS = [
  {
    oneIdPin: "40200000000001",
    firstName: "Nodira",
    lastName: "Rahimova",
    roleTitle: ROLES.OQUV_USLUBIY_BOSHQARMA,
    needsDepartment: false,
  },
  {
    oneIdPin: "40200000000002",
    firstName: "Jamshid",
    lastName: "Tursunov",
    roleTitle: ROLES.KAFEDRA_MUDIRI,
    needsDepartment: true,
    departmentTitle: DEPT_DAVOLASH,
  },
  {
    oneIdPin: "40200000000003",
    firstName: "Dilnoza",
    lastName: "Yusupova",
    roleTitle: ROLES.OQITUVCHI,
    needsDepartment: true,
    departmentTitle: DEPT_DAVOLASH,
  },
  {
    oneIdPin: "40200000000004",
    firstName: "Sanjar",
    lastName: "Aliyev",
    roleTitle: ROLES.DEKAN,
    needsDepartment: true,
    departmentTitle: DEPT_DAVOLASH,
  },
  {
    oneIdPin: "40200000000005",
    firstName: "Gulnora",
    lastName: "Ismoilova",
    roleTitle: ROLES.REJA_MOLIYA,
    needsDepartment: false,
  },
  {
    oneIdPin: "40200000000006",
    firstName: "Bekzod",
    lastName: "Nazarov",
    roleTitle: ROLES.PROREKTOR,
    needsDepartment: false,
  },
  {
    oneIdPin: "40200000000007",
    firstName: "Shahnoza",
    lastName: "Qodirova",
    roleTitle: ROLES.REKTOR,
    needsDepartment: false,
  },
  {
    oneIdPin: "40200000000008",
    firstName: "Otabek",
    lastName: "Sobirov",
    roleTitle: ROLES.ARM,
    needsDepartment: false,
  },
  {
    oneIdPin: "40200000000009",
    firstName: "Zulfiya",
    lastName: "Karimova",
    roleTitle: ROLES.KADRLAR,
    needsDepartment: true,
    departmentTitle: DEPT_JAMOAT_SALOMATLIGI,
  },
  {
    oneIdPin: "40200000000010",
    firstName: "Malika",
    lastName: "Ergasheva",
    roleTitle: ROLES.KAFEDRA_MUDIRI,
    needsDepartment: true,
    departmentTitle: DEPT_STOMATOLOGIYA,
  },
  {
    oneIdPin: "40200000000011",
    firstName: "Ravshan",
    lastName: "Xolmatov",
    roleTitle: ROLES.DEKAN,
    needsDepartment: true,
    departmentTitle: DEPT_STOMATOLOGIYA,
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
    `[StudyLoadUsers Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const Department = require("../src/references/department/department.model");

  const departments = await Department.find({
    faculty: { $ne: null, $exists: true },
  })
    .select("_id title faculty")
    .lean();

  if (!departments.length) {
    console.error(
      "  ✖ TO'XTATILDI: `faculty` biriktirilgan department topilmadi.\n" +
        "    Scope resolverlar fakultetni department orqali aniqlaydi — bunday\n" +
        "    ma'lumotsiz kafedra mudiri/dekan uchun har so'rov 403 bo'ladi.\n" +
        "    Avval `node seed/index.js` (reference ma'lumot) ni ishga tushiring.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const findDept = (title) =>
    (title && departments.find((d) => d.title === title)) || departments[0];

  console.log("  Mavjud kafedralar (faculty bilan):");
  departments.forEach((d) => console.log(`    · ${d.title}`));
  console.log("");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const u of USERS) {
    const role = await Role.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(
        `  ⚠ SKIP: rol topilmadi — "${u.roleTitle}" (avval studyload-roles.seed.js)`,
      );
      continue;
    }

    const dept = u.needsDepartment ? findDept(u.departmentTitle) : null;
    const wantDept = dept ? dept._id : null;
    const existing = await User.findOne({ oneIdPin: u.oneIdPin });

    if (existing) {
      const roleDrift = String(existing.role) !== String(role._id);
      const deptDrift =
        String(existing.department || "") !== String(wantDept || "");

      if (!roleDrift && !deptDrift) {
        console.log(`  ~ SKIP     ${u.oneIdPin}  ${u.roleTitle} (o'zgarishsiz)`);
        skipped += 1;
        continue;
      }

      console.log(
        `  ↻ YANGILAN ${u.oneIdPin}  ${u.roleTitle}` +
          (roleDrift ? "  [rol tuzatiladi]" : "") +
          (deptDrift ? "  [department tuzatiladi]" : ""),
      );
      if (!DRY) {
        existing.role = role._id;
        existing.department = wantDept;
        await existing.save();
      }
      updated += 1;
      continue;
    }

    console.log(
      `  + YARATILAD ${u.oneIdPin}  ${u.roleTitle.padEnd(24)} ` +
        `${u.firstName} ${u.lastName}` +
        (dept ? `  (department: ${dept.title})` : "  (global scope)"),
    );
    if (!DRY) {
      await User.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        role: role._id,
        department: wantDept,
        active: true,
      });
    }
    created += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi" : "Yaratildi  "}: ${created}`);
  console.log(`  ${DRY ? "Yangilanardi" : "Yangilandi "}: ${updated}`);
  console.log(`  O'tkazildi  : ${skipped}`);
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi. Yozish uchun `--dry` siz ishga tushiring.");
  } else {
    console.log("\n  Login (POST /api/auth { oneIdPin }):");
    for (const u of USERS) console.log(`    ${u.oneIdPin}  →  ${u.roleTitle}`);
  }
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[StudyLoadUsers Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
