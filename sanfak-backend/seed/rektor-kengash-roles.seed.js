#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");

function loadConstants() {
  const candidates = [
    "../src/config/constants",
    "../config/constants",
    "../src/constants",
    "../src/config/constant",
  ];
  for (const c of candidates) {
    try {
      return { mod: require(c), from: c };
    } catch (e) {
      if (e.code !== "MODULE_NOT_FOUND" || !String(e.message).includes(c)) throw e;
    }
  }
  return { mod: null, from: null };
}

const { mod: constants, from: constantsPath } = loadConstants();
const CANONICAL_SECTIONS = constants ? new Set(Object.values(constants.MODULES)) : null;
const CANONICAL_ACTIONS = constants ? new Set(Object.values(constants.ACTIONS)) : null;

const MONGO_ENV_KEYS = ["MONGO_HOST", "MONGO_URI", "MONGODB_URI", "MONGO_URL", "DB_URL", "DATABASE_URL"];
const mongoKey = MONGO_ENV_KEYS.find((k) => process.env[k]);
const MONGO = mongoKey ? process.env[mongoKey] : "mongodb://127.0.0.1:27017/institute-test";

const READ = ["read", "readAll"];

const REKTOR_SECTIONS = [
  "user", "role", "auditLog", "notification", "announcement",
  "academicYear", "course", "direction", "documentType", "evaluationCriteria",
  "workload", "workloadDistribution", "studyPlan", "syllabus",
  "teacher", "personalWorkPlan",
  "qualCourse", "qualCourseSubscription", "qualCalendarPlan",
  "resident", "residentApplication", "residencyAttestation", "residencyCurriculum",
  "scienceCouncil", "scientificWork",
  "task", "taskCategory",
  "internationalAdmission", "admissionMessage",
  "councilMember", "councilTask", "rankApplication", "votingSession",
  "article", "monograph", "methodicalRecommendation", "thesis", "patent", "copyright",
  "scientificDegree", "scientificTitle", "scientificPost", "scientificPortal",
  "qualifyingApplicant",
  "giftedStudent", "studentAchievement", "scholarship", "scholarshipApplication",
  "indicator", "indicatorSubmission", "eqIndicator",
  "practice", "practiceStudent", "medicalOrganization",
];

const REKTOR = REKTOR_SECTIONS.map((section) => ({ section, actions: READ }));

const KOTIBI = [
  { section: "councilMember", actions: ["create", "read", "readAll", "update", "delete"] },
  {
    section: "councilTask",
    actions: [
      "create", "read", "readAll", "update", "delete",
      "approve", "reject", "changeStatus", "export",
    ],
  },
  { section: "rankApplication", actions: ["read", "readAll", "update", "approve", "reject"] },
  {
    section: "votingSession",
    actions: ["create", "read", "readAll", "update", "delete", "changeStatus", "export"],
  },
  { section: "anonymousVote", actions: ["readAll"] },
  { section: "announcement", actions: ["create", "read", "readAll", "delete"] },
  { section: "qualifyingApplicant", actions: ["read", "readAll", "update", "search", "filter"] },
  { section: "department", actions: READ },
  { section: "scientificPost", actions: READ },
  { section: "scientificPortal", actions: ["read"] },
  { section: "notification", actions: ["read", "readAll", "update", "delete"] },
];

const PLAN = [
  { title: "rektor", needs: REKTOR },
  { title: "ilmiy_kengash_kotibi", needs: KOTIBI },
];

function assertCanonical() {
  if (!CANONICAL_SECTIONS) {
    console.log("  ⚠ constants.js topilmadi — kanonik nom tekshiruvi o'tkazib yuborildi\n");
    return;
  }
  const xato = [];
  for (const { title, needs } of PLAN) {
    for (const n of needs) {
      if (!CANONICAL_SECTIONS.has(n.section)) xato.push(`${title}: bo'lim "${n.section}"`);
      for (const a of n.actions) {
        if (!CANONICAL_ACTIONS.has(a)) xato.push(`${title}: action "${a}"`);
      }
    }
  }
  if (xato.length) {
    throw new Error(`constants.js da yo'q qiymatlar:\n  - ${xato.join("\n  - ")}`);
  }
}

function mergePermissions(permissions, needs) {
  const added = [];
  for (const n of needs) {
    let hit = permissions.find((p) => p.section === n.section);
    if (!hit) {
      hit = { section: n.section, actionKeys: [] };
      permissions.push(hit);
    }
    const bor = new Set(hit.actionKeys || []);
    for (const a of n.actions) {
      if (!bor.has(a)) {
        bor.add(a);
        added.push(`${n.section}:${a}`);
      }
    }
    hit.actionKeys = [...bor];
  }
  return added;
}

(async () => {
  assertCanonical();

  await mongoose.connect(MONGO);

  const db = mongoose.connection.db;
  console.log(`[RolSeed] ${WRITE ? "WRITE" : "DRY-RUN"}`);
  console.log(`  Mongo : ${MONGO}   (${mongoKey ? `.env → ${mongoKey}` : "env yo'q → standart localhost"})`);
  console.log(`  Baza  : ${db.databaseName}`);
  console.log(`  const.: ${constantsPath || "topilmadi"}\n`);

  const rolesCount = await db.collection("roles").countDocuments();
  if (rolesCount === 0) {
    console.log("  ✖ `roles` kolleksiyasi BO'SH yoki yo'q.");
    console.log("    Bu baza institut AIS (`institute-ais`) bazasi emasga o'xshaydi —");
    console.log("    .env dagi Mongo manzilini va qaysi loyihada ishlayotganingizni tekshiring.");
    await mongoose.disconnect();
    process.exit(1);
  }

  let jami = 0;
  let topilmadi = 0;

  for (const { title, needs } of PLAN) {
    const role = await db.collection("roles").findOne({ title });
    if (!role) {
      console.log(`  ${title}: ROL TOPILMADI — o'tkazib yuborildi`);
      topilmadi += 1;
      continue;
    }

    const permissions = (role.permissions || []).map((p) => ({
      section: p.section,
      actionKeys: [...(p.actionKeys || [])],
    }));
    const oldin = permissions.reduce((s, p) => s + p.actionKeys.length, 0);

    const added = mergePermissions(permissions, needs);
    const keyin = permissions.reduce((s, p) => s + p.actionKeys.length, 0);
    jami += added.length;

    console.log(`  ${title}: ${oldin} → ${keyin} kalit  (+${added.length})`);

    if (added.length) {
      const bySection = added.reduce((m, k) => {
        const [s, a] = k.split(":");
        (m[s] = m[s] || []).push(a);
        return m;
      }, {});
      Object.entries(bySection).forEach(([s, acts]) => {
        console.log(`      + ${s}: ${acts.join(", ")}`);
      });
    }

    if (WRITE && added.length) {
      await db.collection("roles").updateOne({ _id: role._id }, { $set: { permissions } });
    }
  }

  console.log();
  if (topilmadi) {
    console.log(`  ${topilmadi} ta rol topilmadi — avval o'sha modulning rol seed'ini ishga tushiring.`);
    const bor = await db.collection("roles").find({}).project({ title: 1 }).toArray();
    console.log(`  Bazadagi rollar (${bor.length}): ${bor.map((r) => r.title).join(", ")}`);
  }
  if (!jami) console.log("  Hammasi joyida — qo'shiladigan kalit yo'q.");
  else if (WRITE) console.log(`  ✓ Yozildi: +${jami} kalit.`);
  else console.log(`  Yozish uchun: node seed/rektor-kengash-roles.seed.js --write  (+${jami} kalit)`);

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
