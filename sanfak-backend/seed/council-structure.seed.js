"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");
const line = (c = "─") => console.log(c.repeat(64));

const FACULTIES = [
  "Davolash ishi fakulteti",
  "Tibbiy profilaktika fakulteti",
  "Stomatologiya va farmatsiya fakulteti",
];

const DEPARTMENTS = [
  { title: "Ichki kasalliklar kafedrasi", f: 0 },
  { title: "Xirurgiya kasalliklari kafedrasi", f: 0 },
  { title: "Pediatriya kafedrasi", f: 0 },
  { title: "Gigiyena va epidemiologiya kafedrasi", f: 1 },
  { title: "Jamoat salomatligi kafedrasi", f: 1 },
  { title: "Terapevtik stomatologiya kafedrasi", f: 2 },
  { title: "Farmatsevtika kafedrasi", f: 2 },
];

const POSITIONS = [
  { title: "Assistent", annualHours: 400 },
  { title: "Katta o'qituvchi", annualHours: 380 },
  { title: "Dotsent", annualHours: 350 },
  { title: "Professor", annualHours: 300 },
  { title: "Kafedra mudiri", annualHours: 300 },
];

const ACADEMIC_TITLES = [
  { title: "Dotsent", rateTime: 350 },
  { title: "Professor", rateTime: 300 },
  { title: "Katta ilmiy xodim", rateTime: 380 },
];

const GRANT_DEPARTMENT_READ = ["ilmiy_kengash_kotibi", "oqituvchi"];

async function upsertByTitle(Model, title, extra, created, skipped, label) {
  const found = await Model.findOne({ title }).lean();
  if (found) {
    skipped.push(`${label}: ${title}`);
    return found;
  }
  created.push(`${label}: ${title}`);
  if (!APPLY) return { _id: `(dry-${title})`, title };
  return (await Model.create({ title, active: true, ...extra })).toObject();
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(`\n[Kengash tuzilma seed] rejim: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  line("═");

  const Faculty = require("../src/references/faculty/faculty.model");
  const Department = require("../src/references/department/department.model");
  const Position = require("../src/references/position/position.model");
  const AcademicTitle = require("../src/references/academicTitle/academicTitle.model");
  const User = require("../src/modules/4.01-auth/user/user.model");
  const Role = require("../src/modules/4.01-auth/role/role.model");

  const created = [];
  const skipped = [];

  const faculties = [];
  for (const t of FACULTIES) {
    faculties.push(await upsertByTitle(Faculty, t, {}, created, skipped, "Fakultet"));
  }

  const departments = [];
  for (const d of DEPARTMENTS) {
    departments.push(
      await upsertByTitle(Department, d.title, { faculty: faculties[d.f]._id }, created, skipped, "Kafedra"),
    );
  }

  const positions = [];
  for (const p of POSITIONS) {
    positions.push(
      await upsertByTitle(Position, p.title, { annualHours: p.annualHours }, created, skipped, "Lavozim"),
    );
  }

  const titles = [];
  for (const a of ACADEMIC_TITLES) {
    titles.push(
      await upsertByTitle(AcademicTitle, a.title, { rateTime: a.rateTime }, created, skipped, "Ilmiy unvon"),
    );
  }

  console.log(`  Yaratiladi : ${created.length}`);
  created.forEach((c) => console.log(`    + ${c}`));
  if (skipped.length) console.log(`  Mavjud (skip): ${skipped.length}`);

  line();
  const users = await User.find({ active: true }).select("_id firstName lastName oneIdPin department position academicTitle").lean();
  let assigned = 0;
  let already = 0;
  const plan = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    if (u.department && u.position && u.academicTitle) {
      already += 1;
      continue;
    }
    const dep = departments[i % departments.length];
    const pos = positions[i % positions.length];
    const ttl = titles[i % titles.length];
    plan.push({
      _id: u._id,
      who: `${u.lastName ?? ""} ${u.firstName ?? ""}`.trim() || u.oneIdPin,
      dep: dep.title,
      pos: pos.title,
      ttl: ttl.title,
      set: {
        ...(u.department ? {} : { department: dep._id }),
        ...(u.position ? {} : { position: pos._id }),
        ...(u.academicTitle ? {} : { academicTitle: ttl._id }),
      },
    });
    assigned += 1;
  }
  console.log(`  Userlarga biriktiriladi: ${assigned} (allaqachon to'liq: ${already})`);
  plan.slice(0, 6).forEach((p) => console.log(`    · ${p.who.padEnd(24)} → ${p.dep} | ${p.pos} | ${p.ttl}`));
  if (plan.length > 6) console.log(`    · ... va yana ${plan.length - 6} ta`);

  if (APPLY) {
    for (const p of plan) await User.updateOne({ _id: p._id }, { $set: p.set });
  }

  line();
  const { MODULES, ACTIONS } = require("../src/config/constants");
  const grants = [];
  for (const roleTitle of GRANT_DEPARTMENT_READ) {
    const role = await Role.findOne({ title: roleTitle });
    if (!role) {
      console.log(`  ⚠ rol topilmadi: ${roleTitle}`);
      continue;
    }
    const key = role.permissions ? "permissions" : "sections";
    const list = role[key] || [];
    const has = list.some((s) => (s.section || s.module) === MODULES.DEPARTMENT);
    if (has) {
      console.log(`  ~ ${roleTitle}: department allaqachon bor`);
      continue;
    }
    grants.push(roleTitle);
    if (APPLY) {
      list.push({ section: MODULES.DEPARTMENT, actionKeys: [ACTIONS.READ, ACTIONS.READ_ALL] });
      role[key] = list;
      await role.save();
    }
  }
  console.log(`  \`department: [read, readAll]\` beriladi: ${grants.length ? grants.join(", ") : "—"}`);

  line("═");
  if (!APPLY) {
    console.log("  DRY-RUN — hech narsa yozilmadi.");
    console.log("  Yozish uchun: node seed/council-structure.seed.js --apply\n");
  } else {
    console.log("  ✅ Qo'llandi. Kurs / o'quv yili referenslariga TEGILMADI.\n");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[Kengash tuzilma seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
