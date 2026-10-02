"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const DRY = !WRITE;

const NEW_TEACHERS = [
  {
    oneIdPin: "40400000000005",
    firstName: "Sardor",
    lastName: "Aliyev",
    middleName: "Baxtiyorovich",
    departmentTitle: "Gigiyena va ekologiya kafedrasi",
    positionTitle: "Dotsent",
    academicTitleTitle: "Dotsent-unvon",
    stake: 1,
  },
  {
    oneIdPin: "40400000000006",
    firstName: "Bekzod",
    lastName: "Yusupov",
    middleName: "Alisherovich",
    departmentTitle: "Gigiyena va ekologiya kafedrasi",
    positionTitle: "Katta o'qituvchi",
    academicTitleTitle: null,
    stake: 1,
  },
  {
    oneIdPin: "40400000000007",
    firstName: "Malika",
    lastName: "Nazarova",
    middleName: "Shukurovna",
    departmentTitle: "Gigiyena va ekologiya kafedrasi",
    positionTitle: "Assistent",
    academicTitleTitle: "Dotsent-unvon",
    stake: 0.5,
  },
  {
    oneIdPin: "40400000000008",
    firstName: "Farrux",
    lastName: "Rashidov",
    middleName: "Odilovich",
    departmentTitle: "Gigiyena va ekologiya kafedrasi",
    positionTitle: "Katta o'qituvchi",
    academicTitleTitle: null,
    stake: 0.5,
  },
];

const EXISTING_POSITION_FILL = [
  { oneIdPin: "40400000000002", positionTitle: "Katta o'qituvchi" },
  { oneIdPin: "40400000000003", positionTitle: "Assistent" },
  { oneIdPin: "40400000000004", positionTitle: "Dotsent" },
];

const ALL_TEACHER_PINS = [
  "40400000000001",
  "40400000000002",
  "40400000000003",
  "40400000000004",
  ...NEW_TEACHERS.map((t) => t.oneIdPin),
];

const ROLE_TITLE = "oqituvchi";
const PASSPORT_SERIA = "AA";
const passportNumberFor = (pin) => `500000${pin.slice(-1)}`;
const phoneFor = (pin) => `+998900000${pin.slice(-2)}`;
const emailFor = (pin) => `fixture.teacher.${pin.slice(-3)}@example.test`;

function emptyDegrees() {
  return {
    bachelorDegree: [],
    masterDegree: [],
    scientificDegree: [],
    scientificTitle: [],
  };
}

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  console.log(`REJIM: ${WRITE ? "YOZISH (--write)" : "DRY (yozilmaydi)"}\n`);

  async function requireByTitle(collection, title, label) {
    const doc = await db.collection(collection).findOne({ title });
    if (!doc) {
      throw new Error(
        `${label} "${title}" topilmadi (${collection}). Referens ma'lumot yo'q — skript to'xtatildi.`,
      );
    }
    return doc;
  }

  const roleDoc = await db
    .collection("roles")
    .findOne({ title: ROLE_TITLE });
  if (!roleDoc) throw new Error(`Rol "${ROLE_TITLE}" topilmadi (roles).`);

  const departmentCache = new Map();
  async function getDepartment(title) {
    if (departmentCache.has(title)) return departmentCache.get(title);
    const doc = await requireByTitle("departments", title, "Kafedra");
    departmentCache.set(title, doc);
    return doc;
  }

  const positionCache = new Map();
  async function getPosition(title) {
    if (!title) return null;
    if (positionCache.has(title)) return positionCache.get(title);
    const doc = await requireByTitle("positions", title, "Lavozim");
    positionCache.set(title, doc);
    return doc;
  }

  const academicTitleCache = new Map();
  async function getAcademicTitle(title) {
    if (!title) return null;
    if (academicTitleCache.has(title)) return academicTitleCache.get(title);
    const doc = await requireByTitle(
      "academictitles",
      title,
      "Akademik unvon",
    );
    academicTitleCache.set(title, doc);
    return doc;
  }

  const stats = {
    users: { created: 0, updated: 0, untouched: 0 },
    profiles: { created: 0, untouched: 0 },
  };

  console.log("── 1) Yangi o'qituvchilar (users) ──────────────────────────");
  for (const spec of NEW_TEACHERS) {
    const department = await getDepartment(spec.departmentTitle);
    const position = await getPosition(spec.positionTitle);
    const academicTitle = await getAcademicTitle(spec.academicTitleTitle);

    const existing = await db
      .collection("users")
      .findOne({ oneIdPin: spec.oneIdPin });

    if (existing) {
      const set = {};
      if (!existing.department) set.department = department._id;
      if (!existing.faculty) set.faculty = department.faculty;
      if (!existing.role) set.role = roleDoc._id;
      if (!existing.position && position) set.position = position._id;
      if (!existing.academicTitle && academicTitle) {
        set.academicTitle = academicTitle._id;
      }
      if (existing.stake === undefined || existing.stake === null) {
        set.stake = spec.stake;
      }

      if (Object.keys(set).length === 0) {
        console.log(`  TEGILMADI  ${spec.oneIdPin} (${spec.lastName}) — allaqachon to'liq`);
        stats.users.untouched += 1;
      } else {
        console.log(
          `  YANGILANADI  ${spec.oneIdPin} (${spec.lastName}) — maydonlar: ${Object.keys(set).join(", ")}`,
        );
        if (WRITE) {
          await db
            .collection("users")
            .updateOne(
              { _id: existing._id },
              { $set: { ...set, updatedAt: new Date() } },
            );
        }
        stats.users.updated += 1;
      }
      continue;
    }

    const doc = {
      firstName: spec.firstName,
      lastName: spec.lastName,
      middleName: spec.middleName,
      oneIdPin: spec.oneIdPin,
      role: roleDoc._id,
      department: department._id,
      faculty: department.faculty,
      position: position ? position._id : null,
      division: null,
      academicTitle: academicTitle ? academicTitle._id : null,
      email: emailFor(spec.oneIdPin),
      phone: phoneFor(spec.oneIdPin),
      photo: null,
      date: new Date(),
      active: true,
      degrees: emptyDegrees(),
      googleScholar: null,
      scopus: null,
      publications: null,
      hIndex: null,
      workingHours: "",
      workingSchedule: [],
      lastSeen: null,
      office: "",
      telegramChatId: null,
      stake: spec.stake,
      passportSeria: PASSPORT_SERIA,
      passportNumber: passportNumberFor(spec.oneIdPin),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      `  YARATILADI  ${spec.oneIdPin}  ${spec.lastName} ${spec.firstName}` +
        `  lavozim=${spec.positionTitle}  unvon=${spec.academicTitleTitle || "—"}  stavka=${spec.stake}`,
    );
    if (WRITE) {
      await db.collection("users").insertOne(doc);
    }
    stats.users.created += 1;
  }

  console.log(
    "\n── 2) Mavjud o'qituvchilarda lavozim to'ldirish (users) ────",
  );
  for (const spec of EXISTING_POSITION_FILL) {
    const existing = await db
      .collection("users")
      .findOne({ oneIdPin: spec.oneIdPin });

    if (!existing) {
      console.log(
        `  OGOHLANTIRISH  ${spec.oneIdPin} — user topilmadi (kutilgan edi, o'tkazib yuborildi)`,
      );
      continue;
    }

    const position = await getPosition(spec.positionTitle);
    const set = {};
    if (!existing.position) set.position = position._id;
    if (existing.stake === undefined || existing.stake === null) {
      set.stake = 1;
    }

    if (Object.keys(set).length === 0) {
      console.log(
        `  TEGILMADI  ${spec.oneIdPin} (${existing.lastName}) — position allaqachon bor`,
      );
      stats.users.untouched += 1;
    } else {
      console.log(
        `  YANGILANADI  ${spec.oneIdPin} (${existing.lastName}) — position: null → "${spec.positionTitle}"`,
      );
      if (WRITE) {
        await db
          .collection("users")
          .updateOne(
            { _id: existing._id },
            { $set: { ...set, updatedAt: new Date() } },
          );
      }
      stats.users.updated += 1;
    }
  }

  console.log("\n── 3) teacherProfile (hrApprovalStatus=approved) ───────────");
  for (const pin of ALL_TEACHER_PINS) {
    const user = await db.collection("users").findOne({ oneIdPin: pin });
    if (!user) {
      console.log(`  OGOHLANTIRISH  ${pin} — user topilmadi, profil o'tkazib yuborildi`);
      continue;
    }

    const existingProfile = await db
      .collection("teacherprofiles")
      .findOne({ user: user._id });

    if (existingProfile) {
      console.log(
        `  TEGILMADI  ${pin} (${user.lastName}) — profil mavjud (hrApprovalStatus="${existingProfile.hrApprovalStatus}")`,
      );
      stats.profiles.untouched += 1;
      continue;
    }

    const doc = {
      user: user._id,
      department: user.department || null,
      faculty: user.faculty || null,
      position: user.position || null,
      employmentType: "asosiy",
      education: [],
      academicDegree: null,
      academicTitle: null,
      photo: null,
      birthDate: null,
      gender: null,
      passportSeries: user.passportSeria || null,
      passportNumber: user.passportNumber || null,
      passportIssuedBy: null,
      passportIssuedAt: null,
      passportExpiry: null,
      jshshir: null,
      address: { region: null, district: null, street: null },
      contactInfo: { phone: user.phone || null, email: user.email || null },
      googleScholarUrl: null,
      scopusUrl: null,
      orcidUrl: null,
      hIndex: 0,
      hrApprovalStatus: "approved",
      hrApprovedBy: null,
      hrApprovalDate: new Date(),
      hrComment:
        "Fixture: 4.2.4 taqsimot sinovi uchun oldindan tasdiqlangan (seed-workload-teacher-fixtures.js)",
      changedFields: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      `  YARATILADI  ${pin}  ${user.lastName} ${user.firstName} — department=${doc.department}  position=${doc.position}`,
    );
    if (WRITE) {
      await db.collection("teacherprofiles").insertOne(doc);
    }
    stats.profiles.created += 1;
  }

  console.log("\nXULOSA:");
  console.log(
    `  users:           yaratildi=${stats.users.created}  yangilandi=${stats.users.updated}  tegilmadi=${stats.users.untouched}`,
  );
  console.log(
    `  teacherprofiles: yaratildi=${stats.profiles.created}  tegilmadi=${stats.profiles.untouched}`,
  );
  if (DRY) {
    console.log(
      "\nYozish uchun `--write` bilan qayta ishga tushiring (avval mongodump zaxira oling!).",
    );
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
