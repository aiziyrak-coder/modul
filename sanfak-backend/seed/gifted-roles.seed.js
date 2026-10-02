const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

const NEW_ROLES = [
  {
    title: "talaba",
    desc: "Talaba (4.11 Iqtidorli yoshlar)",
    scopeLevel: "self",
  },
  {
    title: "iqtidorli_bolim",
    desc: "Iqtidorli yoshlar bilan ishlash bo'limi xodimi (4.11)",
    scopeLevel: "global",
  },
  {
    title: "hakam",
    desc: "Hakam — Rektor stipendiyasi baholovchisi (4.11)",
    scopeLevel: "global",
  },
];

const REFERENCE_READ = ["read", "readAll"];

const GRANTS = {
  talaba: {
    giftedStudent: ["read"],
    studentAchievement: ["create", "read", "readAll"],
    scholarshipApplication: ["create", "read"],
    scholarship: ["readAll", "read"],
    evaluationCriteria: ["readAll"],
    documentType: ["readAll"],
    chat: ["create", "read", "readAll", "delete"],
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
  },
  iqtidorli_bolim: {
    giftedStudent: ["create", "read", "readAll", "update", "approve", "reject", "export", "delete"],
    evaluationCriteria: ["create", "read", "readAll", "update", "approve", "reject", "export", "delete"],
    studentAchievement: ["create", "read", "readAll", "update", "approve", "reject", "export", "delete"],
    scholarshipApplication: ["create", "read", "readAll", "update", "approve", "reject", "export", "delete"],
    scholarship: ["create", "read", "readAll", "update", "delete"],
    documentType: ["create", "read", "readAll", "update", "delete"],
    chat: ["create", "read", "readAll", "delete"],
    faculty: ["read", "readAll"],
    direction: ["read", "readAll"],
    group: ["read", "readAll"],
    department: ["read", "readAll"],
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
  },
  oqituvchi: {
    giftedStudent: ["read", "readAll"],
    studentAchievement: ["read", "readAll"],
    scholarshipApplication: ["read", "readAll"],
    documentType: ["read", "readAll"],
    chat: ["create", "read", "readAll", "update"],
    academicYear: ["readAll"],
    course: ["readAll"],
  },
  hakam: {
    giftedStudent: ["read"],
    studentAchievement: ["readAll"],
    evaluationCriteria: ["readAll"],
    scholarship: ["readAll"],
    scholarshipApplication: ["readAll", "score"],
    academicYear: ["readAll"],
    course: ["readAll"],
  },
  prorektor: {
    giftedStudent: ["read", "readAll"],
    evaluationCriteria: ["readAll"],
    studentAchievement: ["readAll"],
    scholarship: ["readAll"],
    scholarshipApplication: ["readAll"],
    documentType: ["readAll"],
    academicYear: ["readAll"],
    course: ["readAll"],
    faculty: ["readAll"],
  },
  rektor: {
    giftedStudent: ["read", "readAll"],
    evaluationCriteria: ["readAll"],
    studentAchievement: ["readAll"],
    scholarship: ["readAll"],
    scholarshipApplication: ["readAll"],
    documentType: ["readAll"],
    academicYear: ["read", "readAll"],
    course: ["read", "readAll"],
    faculty: ["readAll"],
  },
};

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const roles = mongoose.connection.db.collection("roles");

  for (const r of NEW_ROLES) {
    const existing = await roles.findOne({ title: r.title });
    if (!existing) {
      await roles.insertOne({
        title: r.title,
        desc: r.desc,
        scopeLevel: r.scopeLevel,
        permissions: [],
        active: true,
      });
      console.log(`  [+role] "${r.title}" yaratildi (scopeLevel=${r.scopeLevel})`);
    } else {
      console.log(`  [role] "${r.title}" allaqachon mavjud`);
    }
  }

  let totalAdded = 0;
  for (const [title, sections] of Object.entries(GRANTS)) {
    const role = await roles.findOne({ title });
    if (!role) {
      console.warn(`  [SKIP] rol topilmadi: "${title}"`);
      continue;
    }
    const perms = Array.isArray(role.permissions) ? role.permissions : [];
    const bySection = new Map(perms.map((p) => [String(p.section), p]));
    const changes = [];

    for (const [section, wantActions] of Object.entries(sections)) {
      const existing = bySection.get(section);
      if (!existing) {
        perms.push({ section, actionKeys: [...wantActions] });
        changes.push(`+${section}[${wantActions.join(",")}]`);
      } else {
        const have = new Set(existing.actionKeys || []);
        const missing = wantActions.filter((a) => !have.has(a));
        if (missing.length) {
          existing.actionKeys = [...(existing.actionKeys || []), ...missing];
          changes.push(`${section}+[${missing.join(",")}]`);
        }
      }
    }

    if (changes.length) {
      await roles.updateOne({ _id: role._id }, { $set: { permissions: perms } });
      totalAdded += changes.length;
      console.log(`  [${title}] ${changes.join("  ")}`);
    } else {
      console.log(`  [${title}] o'zgarishsiz (allaqachon to'liq)`);
    }
  }

  console.log(`\nGifted RBAC seed tugadi — ${totalAdded} ta section/action qo'shildi.`);
  await mongoose.disconnect();
}

module.exports = { NEW_ROLES, GRANTS };

if (require.main === module) {
  run().catch((err) => {
    console.error("Gifted RBAC seed XATO:", err.message);
    process.exit(1);
  });
}
