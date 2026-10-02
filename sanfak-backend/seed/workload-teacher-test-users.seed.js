"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const DEPT_GIGIYENA = "Gigiyena va ekologiya kafedrasi";
const DEPT_OVQATLANISH = "Ovqatlanish gigiyenasi va nutritsiologiya kafedrasi";

const USERS = [
  {
    oneIdPin: "40300000000002",
    lastName: "To'lanova",
    firstName: "Mavluda",
    middleName: null,
    roleTitle: ROLES.KAFEDRA_MUDIRI,
    departmentTitle: DEPT_OVQATLANISH,
    positionTitle: null,
    stake: 1,
  },

  {
    oneIdPin: "40400000000001",
    lastName: "Qodirjonov",
    firstName: "Ibrohim",
    middleName: "Jabborovich",
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Professor",
    stake: 1,
  },
  {
    oneIdPin: "40400000000002",
    lastName: "G'ofurov",
    firstName: "Aziz",
    middleName: null,
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Katta o'qituvchi",
    stake: 1,
  },
  {
    oneIdPin: "40400000000003",
    lastName: "Yusupova",
    firstName: "Dilnoza",
    middleName: null,
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_OVQATLANISH,
    positionTitle: "Assistent",
    stake: 1,
  },
  {
    oneIdPin: "40400000000004",
    lastName: "Tursunov",
    firstName: "Jamshid",
    middleName: null,
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_OVQATLANISH,
    positionTitle: "Dotsent",
    stake: 1,
  },
  {
    oneIdPin: "40400000000005",
    lastName: "Aliyev",
    firstName: "Sardor",
    middleName: "Baxtiyorovich",
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Dotsent",
    stake: 1,
  },
  {
    oneIdPin: "40400000000006",
    lastName: "Yusupov",
    firstName: "Bekzod",
    middleName: "Alisherovich",
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Katta o'qituvchi",
    stake: 1,
  },
  {
    oneIdPin: "40400000000007",
    lastName: "Nazarova",
    firstName: "Malika",
    middleName: "Shukurovna",
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Assistent",
    stake: 0.5,
  },
  {
    oneIdPin: "40400000000008",
    lastName: "Rashidov",
    firstName: "Farrux",
    middleName: "Odilovich",
    roleTitle: ROLES.OQITUVCHI,
    departmentTitle: DEPT_GIGIYENA,
    positionTitle: "Katta o'qituvchi",
    stake: 0.5,
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
    `[WorkloadTeacherUsers Seed] MongoDB ga ulandi${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}\n`,
  );

  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");
  const Department = require("../src/references/department/department.model");
  const Position = require("../src/references/position/position.model");

  const departments = await Department.find({
    faculty: { $ne: null, $exists: true },
  })
    .select("_id title faculty")
    .lean();

  if (!departments.length) {
    console.error(
      "  ✖ TO'XTATILDI: parent (`faculty`) biriktirilgan kafedra topilmadi.\n" +
        "    Scope resolverlar fakultetni kafedra orqali aniqlaydi — bunday\n" +
        "    ma'lumotsiz kafedra mudiri/dekan uchun har so'rov 403 bo'ladi.\n" +
        "    Avval `node seed/references.seed.js` ni ishga tushiring.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const wantedTitles = [
    ...new Set(USERS.map((u) => u.departmentTitle).filter(Boolean)),
  ];
  const resolveDept = (title) => {
    if (!title) return null;
    const exact = departments.find((d) => d.title === title);
    if (exact) return exact;
    const fallback = departments[wantedTitles.indexOf(title) % departments.length];
    console.warn(
      `  ⚠ Kafedra "${title}" topilmadi — o'rniga "${fallback.title}" ishlatiladi`,
    );
    return fallback;
  };

  const positions = await Position.find({}).select("_id title").lean();
  const resolvePosition = (title) => {
    if (!title) return null;
    const found = positions.find((p) => p.title === title);
    if (!found) {
      console.warn(
        `  ⚠ Lavozim "${title}" topilmadi (positions) — lavozimsiz yoziladi.` +
          " Avval `node seed/references.seed.js`.",
      );
    }
    return found || null;
  };

  console.log("  Mavjud kafedralar (parent `faculty` bilan):");
  departments.forEach((d) => console.log(`    · ${d.title}`));
  console.log("");

  let created = 0;
  let filled = 0;
  let skipped = 0;

  for (const u of USERS) {
    const role = await Role.findOne({ title: u.roleTitle }).select("_id").lean();
    if (!role) {
      console.warn(
        `  ⚠ SKIP: rol topilmadi — "${u.roleTitle}"` +
          " (avval: node seed/studyload-roles.seed.js)",
      );
      continue;
    }

    const dept = resolveDept(u.departmentTitle);
    const pos = resolvePosition(u.positionTitle);
    const want = {
      department: dept ? dept._id : null,
      faculty: dept ? dept.faculty : null,
      position: pos ? pos._id : null,
      stake: u.stake,
    };
    const nom = `${u.lastName} ${u.firstName}`;

    const existing = await User.collection.findOne({ oneIdPin: u.oneIdPin });

    if (existing) {
      const toFill = Object.entries(want).filter(
        ([key, value]) =>
          value !== null &&
          value !== undefined &&
          (existing[key] === null || existing[key] === undefined),
      );

      if (!toFill.length) {
        console.log(
          `  ~ SKIP      ${u.oneIdPin}  ${nom.padEnd(24)} (bor, bo'sh maydon yo'q)`,
        );
        skipped += 1;
        continue;
      }

      console.log(
        `  ↻ TO'LDIRIL ${u.oneIdPin}  ${nom.padEnd(24)} — ` +
          toFill.map(([key]) => key).join(", "),
      );
      if (!DRY) {
        await User.collection.updateOne(
          { _id: existing._id },
          { $set: Object.fromEntries(toFill) },
        );
      }
      filled += 1;
      continue;
    }

    console.log(
      `  + YARATILAD ${u.oneIdPin}  ${nom.padEnd(24)} ${u.roleTitle.padEnd(16)}` +
        ` ${dept ? dept.title : "institut darajasi"}` +
        `  · ${pos ? pos.title : "lavozimsiz"}  · ${u.stake} stavka`,
    );
    if (!DRY) {
      await User.create({
        oneIdPin: u.oneIdPin,
        firstName: u.firstName,
        lastName: u.lastName,
        middleName: u.middleName,
        role: role._id,
        ...want,
        active: true,
      });
    }
    created += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi" : "Yaratildi  "}: ${created}`);
  console.log(`  ${DRY ? "To'ldirilardi" : "To'ldirildi  "}: ${filled}`);
  console.log(`  O'tkazildi  : ${skipped}`);
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi. Yozish uchun `--dry` siz ishga tushiring.");
  } else {
    console.log("\n  Keyingi qadam: node seed/teacher-profiles.seed.js");
    console.log("  (4.2 taqsimotdagi \"O'qituvchi\" select `teacherprofiles` dan o'qiydi)");
    console.log("\n  Login (POST /api/auth { oneIdPin }):");
    for (const u of USERS) {
      console.log(`    ${u.oneIdPin}  →  ${u.roleTitle.padEnd(16)} ${u.lastName} ${u.firstName}`);
    }
  }
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[WorkloadTeacherUsers Seed] XATO:", err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
