"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Role = require("../src/modules/4.01-auth/role/role.model");

const NEW_ROLES = [
  {
    title: "magistrant",
    desc: "Magistratura talabasi (4.5)",
    scopeLevel: "self",
  },
  {
    title: "ilmiy_rahbar",
    desc: "Ilmiy rahbar (magistratura, 4.5)",
    scopeLevel: "self",
  },
  {
    title: "magistratura_bolim",
    desc: "Magistratura va klinik ordinatura bo'limi xodimi (4.5)",
    scopeLevel: "global",
  },
  {
    title: "rezident",
    desc: "Klinik ordinator (4.5)",
    scopeLevel: "self",
  },
  {
    title: "klinik_ustoz",
    desc: "Klinik ustoz — rezidentlarga rahbarlik (4.5)",
    scopeLevel: "self",
  },
];

const REFERENCE_READ = ["read", "readAll"];

const GRANTS = {
  magistratura_bolim: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: [
      "create",
      "read",
      "readAll",
      "update",
      "delete",
      "export",
      "changeStatus",
    ],
    residencySpecialty: ["create", "read", "readAll", "update", "delete"],
    residentAttendance: ["create", "read", "readAll", "update", "approve"],
    residentDailyLog: ["create", "read", "readAll", "update", "approve"],
    residentApplication: [
      "create",
      "read",
      "readAll",
      "update",
      "approve",
      "reject",
    ],
    residentAssessment: ["create", "read", "readAll", "update", "delete", "score"],
    residentResource: ["create", "read", "readAll", "update", "delete"],
    residencyActivityPlan: ["create", "read", "readAll", "update", "delete", "approve", "reject"],
    residencyDissertationPlan: ["create", "read", "readAll", "update", "delete", "approve", "reject"],
    residencyOpenLesson: ["read", "readAll"],
    room: ["read", "readAll"],
    residencyTheoryTopic: ["create", "read", "readAll", "update", "delete"],
    residencySkill: ["create", "read", "readAll", "update", "delete"],
    residencyAttestation: ["create", "read", "readAll", "update", "delete"],
    residencyCurriculum: ["create", "read", "readAll", "update", "delete"],
    residencyLesson: ["create", "read", "readAll", "update", "delete"],
    residencyNotice: ["read", "readAll", "update", "delete", "approve"],
    residencyProblemStudent: ["create", "read", "readAll", "update", "delete"],
    residencyAnnouncement: ["create", "read", "readAll", "update", "delete"],
    residencyReport: ["readAll"],
    department: ["read", "readAll"],
    group: ["read", "readAll"],
    science: ["read", "readAll"],
    direction: ["read", "readAll"],
    user: ["search"],
    role: ["read", "readAll"],
  },

  rezident: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read"],
    residencySpecialty: ["readAll"],
    residentAttendance: ["read", "readAll"],
    residentDailyLog: ["create", "read", "readAll", "update"],
    residentApplication: ["create", "read", "readAll"],
    residencySkill: ["read", "readAll"],
    residencyTheoryTopic: ["readAll"],
    residencyAnnouncement: ["readAll"],
    residentResource: ["read", "readAll"],
    chat: ["create", "read", "readAll", "delete"],
  },

  klinik_ustoz: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read", "readAll"],
    residencySpecialty: ["readAll"],
    residentAssessment: ["create", "read", "readAll", "update", "score"],
    residentAttendance: ["create", "read", "readAll", "update"],
    residentDailyLog: ["read", "readAll", "approve"],
    residencySkill: ["read", "readAll"],
    residencyTheoryTopic: ["readAll"],
    residencyLesson: ["read", "readAll"],
    residencyNotice: ["create", "read", "readAll", "update", "delete"],
    residencyAnnouncement: ["readAll"],
    residentResource: ["read", "readAll"],
    chat: ["create", "read", "readAll", "delete"],
    science: ["read", "readAll"],
    group: ["read", "readAll"],
    user: ["search"],
  },

  ilmiy_rahbar: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read", "readAll"],
    residencySpecialty: ["readAll"],
    residentAssessment: ["create", "read", "readAll", "update", "score"],
    residencyActivityPlan: ["read", "readAll", "approve", "reject"],
    residencyDissertationPlan: ["read", "readAll", "approve", "reject"],
    residencyOpenLesson: ["create", "read", "readAll", "update", "delete"],
    room: ["read", "readAll"],
    residentDailyLog: ["read", "readAll", "approve"],
    residencySkill: ["read", "readAll"],
    residencyTheoryTopic: ["readAll"],
    residencyCurriculum: ["read", "readAll"],
    residencyNotice: ["create", "read", "readAll", "update", "delete"],
    residencyAnnouncement: ["readAll"],
    residentResource: ["read", "readAll"],
    chat: ["create", "read", "readAll", "delete"],
    department: ["read", "readAll"],
    group: ["read", "readAll"],
    science: ["read", "readAll"],
    user: ["search"],
  },

  kafedra_mudiri: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read", "readAll", "update"],
    residencySpecialty: ["readAll"],
    residencyActivityPlan: ["read", "readAll", "approve", "reject"],
    residencyDissertationPlan: ["read", "readAll", "approve", "reject"],
    residencyOpenLesson: ["read", "readAll"],
    user: ["search"],
    department: ["read", "readAll"],
    residencyAnnouncement: ["readAll"],
  },

  magistrant: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read"],
    residencySpecialty: ["readAll"],
    residencyActivityPlan: ["create", "read", "readAll", "update", "delete"],
    residencyDissertationPlan: ["create", "read", "readAll", "update", "delete"],
    residencyOpenLesson: ["read", "readAll"],
    residentDailyLog: ["create", "read", "readAll", "update"],
    residentApplication: ["create", "read", "readAll"],
    residencySkill: ["read", "readAll"],
    residencyTheoryTopic: ["readAll"],
    residencyCurriculum: ["read", "readAll"],
    residencyAnnouncement: ["readAll"],
    residentResource: ["read", "readAll"],
    chat: ["create", "read", "readAll", "delete"],
  },

  rektor: {
    academicYear: REFERENCE_READ,
    course: REFERENCE_READ,
    educationForm: REFERENCE_READ,
    resident: ["read", "readAll"],
    residencySpecialty: ["readAll"],
    residencyActivityPlan: ["readAll"],
    residencyDissertationPlan: ["readAll"],
    residencyOpenLesson: ["readAll"],
    residencyAttestation: ["read", "readAll"],
    residencySkill: ["readAll"],
    residentApplication: ["readAll"],
    residentAttendance: ["readAll"],
    residentDailyLog: ["readAll"],
    residencyAnnouncement: ["readAll"],
    residentResource: ["read", "readAll"],
    residencyReport: ["readAll"],
  },
};

async function run() {
  const dry = process.argv.includes("--dry");
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);

  const wouldCreate = new Set();
  for (const r of NEW_ROLES) {
    const existing = await Role.findOne({ title: r.title });
    if (!existing && dry) {
      wouldCreate.add(r.title);
      console.log(`  [dry +role] "${r.title}" yaratilardi (scopeLevel=${r.scopeLevel})`);
    } else if (!existing) {
      await Role.create({
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
    const role = await Role.findOne({ title });
    if (!role && !wouldCreate.has(title)) {
      console.warn(`  [SKIP] rol topilmadi: "${title}"`);
      continue;
    }
    const perms = Array.isArray(role?.permissions) ? role.permissions : [];
    const bySection = new Map(perms.map((p) => [String(p.section), p]));
    const changes = [];

    for (const [section, wantActions] of Object.entries(sections)) {
      const existing = bySection.get(section);
      if (!existing) {
        perms.push({ section, actionKeys: [...wantActions] });
        changes.push(`+${section}`);
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
      if (!dry) {
        role.permissions = perms;
        await role.save();
      }
      totalAdded += changes.length;
      console.log(`  [${title}] ${changes.join("  ")}`);
    } else {
      console.log(`  [${title}] o'zgarishsiz (allaqachon to'liq)`);
    }
  }

  const verb = dry ? "qo'shilardi" : "qo'shildi";
  console.log(`\n4.5 RBAC seed tugadi — ${totalAdded} ta section/action ${verb}.`);
  if (dry) console.log("DRY-RUN — DB o'zgarmadi");
  await mongoose.disconnect();
}

module.exports = { NEW_ROLES, GRANTS, run };

if (require.main === module) {
  run().catch((err) => {
    console.error("4.5 RBAC seed XATO:", err.message);
    process.exit(1);
  });
}
