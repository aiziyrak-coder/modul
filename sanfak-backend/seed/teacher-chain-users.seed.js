"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const { ROLES } = require("../src/config/constants");

const DRY = process.argv.includes("--dry");

const DEV_ENVS = ["dev", "development", "test", "qa", "local"];
const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());

const DEPT_GIGIYENA = "Gigiyena va ekologiya kafedrasi";

const FIXTURES = [
  {
    pin: "40500000000001",
    role: ROLES.KAFEDRA_USLUBIY_MASUL,
    firstName: "Nodira",
    lastName: "Qodirova",
    note: "zanjir 2-bosqich",
    departmentTitle: DEPT_GIGIYENA,
  },
  {
    pin: "40500000000002",
    role: ROLES.KAFEDRA_ILMIY_MASUL,
    firstName: "Bekzod",
    lastName: "Rahimov",
    note: "zanjir 3-bosqich",
    departmentTitle: DEPT_GIGIYENA,
  },
  {
    pin: "40500000000003",
    role: ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL,
    firstName: "Gulnora",
    lastName: "Saidova",
    note: "zanjir 4-bosqich",
    departmentTitle: DEPT_GIGIYENA,
  },
  {
    pin: "40500000000004",
    role: ROLES.ICHKI_NAZORAT,
    firstName: "Rustam",
    lastName: "Ergashev",
    note: "zanjir 8-bosqich",
    departmentTitle: null,
  },
  {
    pin: "40500000000005",
    role: ROLES.ILMIY_BOLIM,
    firstName: "Kamola",
    lastName: "Yusupova",
    note: "TZ 4.3.9 monitoring",
    departmentTitle: null,
  },
  {
    pin: "40500000000006",
    role: ROLES.FAKULTET_KENGASH_KOTIBI,
    firstName: "Dilshod",
    lastName: "Ismatov",
    note: "hisobot zanjiri 2-bosqich",
    departmentTitle: DEPT_GIGIYENA,
  },

  {
    pin: "40500000000007",
    role: ROLES.KADRLAR,
    firstName: "Kamola",
    lastName: "Tosheva",
    note: "TZ 4.3.2 kadrlar bo'limi",
    departmentTitle: null,
  },
  {
    pin: "40500000000008",
    role: ROLES.OQITUVCHI,
    firstName: "Sardor",
    lastName: "Umarov",
    note: "TZ 4.3.1/4.3.4 — zanjir 1-bosqich",
    departmentTitle: DEPT_GIGIYENA,
    withProfile: true,
  },
  {
    pin: "40500000000009",
    role: ROLES.KAFEDRA_MUDIRI,
    firstName: "Rustam",
    lastName: "Jo'rayev",
    note: "zanjir 5-bosqich + TZ 4.3.5 monitoring",
    departmentTitle: DEPT_GIGIYENA,
  },
  {
    pin: "40500000000010",
    role: ROLES.DEKAN,
    firstName: "Feruza",
    lastName: "Abdullayeva",
    note: "zanjir 7-bosqich + hisobot 1-bosqich",
    departmentTitle: DEPT_GIGIYENA,
  },
  {
    pin: "40500000000011",
    role: ROLES.OQUV_USLUBIY_BOSHQARMA,
    firstName: "Jasur",
    lastName: "Sobirov",
    note: "zanjir 6-bosqich",
    departmentTitle: null,
  },
];

(async () => {
  if (!IS_DEV_ENV) {
    throw new Error(
      `bu seed FAQAT dev/test muhitida ishlaydi (NODE_ENV="${process.env.NODE_ENV || "(o'rnatilmagan)"}").\n` +
        `        Ruxsat etilgan: ${DEV_ENVS.join(", ")}.\n` +
        `        Sabab: PIN'lar ketma-ket va taxmin qilish oson, login esa faqat PIN bilan —\n` +
        `        production'da bu admin backdoor bo'lardi.`,
    );
  }
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  console.log(
    `\n${DRY ? "🔍 DRY-RUN — hech narsa yozilmaydi" : "✍️  YOZISH REJIMI"}  ·  baza: ${mongoose.connection.name}\n`,
  );

  const departments = await db
    .collection("departments")
    .find({ faculty: { $ne: null, $exists: true } })
    .project({ _id: 1, title: 1, faculty: 1 })
    .toArray();

  if (!departments.length) {
    console.error(
      "❌ To'xtatildi: parent (`faculty`) biriktirilgan kafedra topilmadi.\n" +
        "   Scope'siz yaratilgan tasdiqlovchi hech qanday rejani ko'rmaydi,\n" +
        "   ya'ni seed foyda bermaydi. Avval: node seed/references.seed.js",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const wantedTitles = [
    ...new Set(FIXTURES.map((f) => f.departmentTitle).filter(Boolean)),
  ];
  const resolveDept = (title) => {
    if (!title) return null;
    const exact = departments.find((d) => d.title === title);
    if (exact) return exact;
    const fallback = departments[wantedTitles.indexOf(title) % departments.length];
    console.log(
      `  ⚠️  Kafedra "${title}" topilmadi — o'rniga "${fallback.title}" ishlatiladi`,
    );
    return fallback;
  };

  let created = 0;
  let skipped = 0;
  let missingRole = 0;

  for (const f of FIXTURES) {
    const role = await db.collection("roles").findOne({ title: f.role });
    if (!role) {
      console.log(`  ⚠️  ${f.role.padEnd(30)} ROL BAZADA YO'Q — o'tkazildi`);
      missingRole += 1;
      continue;
    }

    const existing = await db
      .collection("users")
      .findOne({ oneIdPin: f.pin });
    if (existing) {
      console.log(
        `  ⏭  ${f.role.padEnd(30)} allaqachon bor (${existing.firstName} ${existing.lastName}) — tegilmadi`,
      );
      skipped += 1;
      continue;
    }

    const dept = resolveDept(f.departmentTitle);

    const doc = {
      firstName: f.firstName,
      lastName: f.lastName,
      middleName: null,
      role: role._id,
      oneIdPin: f.pin,
      department: dept ? dept._id : null,
      faculty: dept ? dept.faculty : null,
      position: null,
      division: null,
      stake: 1,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (DRY) {
      console.log(
        `  + ${f.role.padEnd(30)} ${f.pin}  ${f.firstName} ${f.lastName}  ` +
          `[${dept ? "kafedra: " + dept.title : "institut darajasi"}]  · ${f.note}`,
      );
    } else {
      const { insertedId } = await db.collection("users").insertOne(doc);
      console.log(
        `  ✅ ${f.role.padEnd(30)} ${f.pin}  ${f.firstName} ${f.lastName} yaratildi · ${f.note}`,
      );

      if (f.withProfile) {
        await db.collection("teacherprofiles").insertOne({
          user: insertedId,
          department: dept ? dept._id : null,
          faculty: dept ? dept.faculty : null,
          position: null,
          employmentType: "asosiy",
          degrees: [],
          hrApprovalStatus: "pending",
          changedFields: [],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(
          `     └─ teacherProfile yaratildi (hrApprovalStatus: pending)`,
        );
      }
    }
    created += 1;
  }

  console.log(
    `\n── Xulosa ──\n` +
      `  ${DRY ? "yaratiladi" : "yaratildi"}: ${created}\n` +
      `  o'tkazildi (allaqachon bor): ${skipped}\n` +
      `  rol topilmadi: ${missingRole}\n` +
      `  o'chirildi: 0  (bu seed hech qachon o'chirmaydi)\n`,
  );

  if (DRY) {
    console.log("Yozish uchun: node seed/teacher-chain-users.seed.js\n");
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
