"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const AcademicYear = require("../src/references/academicYear/academicYear.model");
const Course = require("../src/references/course/course.model");
const Direction = require("../src/references/direction/direction.model");
const Language = require("../src/references/languageOfInstruction/languageOfInstruction.model");
const OrgType = require("../src/modules/4.13-practice/orgType/orgType.model");
const Region = require("../src/references/province/province.model");
const District = require("../src/references/region/region.model");
const MedOrg = require("../src/modules/4.13-practice/medicalOrganization/medicalOrganization.model");
const Student = require("../src/modules/4.13-practice/student/student.model");

const ACADEMIC_YEARS = ["2024/2025", "2025/2026", "2026/2027", "2027/2028"];
const COURSES = ["1-kurs", "2-kurs", "3-kurs", "4-kurs", "5-kurs", "6-kurs"];
const DIRECTIONS = [
  "Davolash ishi",
  "Stomatologiya",
  "Pediatriya",
  "Tibbiy profilaktika",
  "Farmatsiya",
  "Hamshiralik ishi",
];

const upsertByTitle = async (Model, title) => {
  const found = await Model.findOne({ title });
  if (found) return { doc: found, created: false };
  return { doc: await Model.create({ title }), created: true };
};

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[PracticeSample Seed] MongoDB ga ulandi\n");
  let created = 0;
  let skipped = 0;
  const inc = (c) => (c ? (created += 1) : (skipped += 1));

  const yearMap = {};
  for (const t of ACADEMIC_YEARS) {
    const { doc, created: c } = await upsertByTitle(AcademicYear, t);
    yearMap[t] = doc._id;
    inc(c);
  }
  for (const t of COURSES) inc((await upsertByTitle(Course, t)).created);

  const { doc: lang, created: langCreated } = await upsertByTitle(Language, "O'zbek tili");
  inc(langCreated);

  const dirMap = {};
  for (const t of DIRECTIONS) {
    let doc = await Direction.findOne({ title: t });
    if (!doc) {
      doc = await Direction.create({ title: t, teachingLanguages: [lang._id] });
      created += 1;
    } else skipped += 1;
    dirMap[t] = doc._id;
  }
  console.log("  Reference'lar (yil/kurs/yo'nalish/til) tayyor");

  const ot = async (t) => (await OrgType.findOne({ title: t }))?._id;
  const rg = async (t) => (await Region.findOne({ title: t }))?._id;
  const ds = async (t) => (await District.findOne({ title: t }))?._id;

  const fargonaReg = await rg("Farg'ona viloyati");
  const tashkentReg = await rg("Toshkent shahri");
  if (!fargonaReg || !tashkentReg) {
    console.error("  ⚠ Viloyat/tuman topilmadi — avval practice-references.seed.js ni ishga tushiring");
    await mongoose.disconnect();
    process.exit(1);
  }

  const bases = [
    {
      title: "Farg'ona tibbiyot birlashmasi",
      orgType: await ot("Tibbiyot birlashmasi"),
      stir: "301456789",
      region: fargonaReg,
      district: await ds("Farg'ona shahri"),
      address: "Farg'ona sh., Mustaqillik ko'chasi 1",
      headName: "Aliyev Vali Akramovich",
      headJshshir: "31904926710011",
      headPhone: "+998901112233",
      email: "fargona.tb@example.uz",
      capacity: 60,
    },
    {
      title: "Toshkent SEM markazi",
      orgType: await ot("Sanitariya-epidemiologik osoyishtalik markazi"),
      stir: "300112244",
      region: tashkentReg,
      district: await ds("Chilonzor tumani"),
      address: "Toshkent sh., Chilonzor 19-mavze",
      headName: "Rahimova Nodira Salimovna",
      headJshshir: "42509880330044",
      headPhone: "+998939001122",
      capacity: 50,
    },
  ];
  for (const b of bases) {
    if (!(await MedOrg.findOne({ stir: b.stir }))) {
      await MedOrg.create(b);
      created += 1;
    } else skipped += 1;
  }

  const students = [
    { fish: "Aliyev Sardor Akmalovich", academicYear: yearMap["2026/2027"], direction: dirMap["Davolash ishi"], course: 3, group: "301-A", region: fargonaReg, district: await ds("Farg'ona shahri") },
    { fish: "Karimova Dilnoza Bahromovna", academicYear: yearMap["2026/2027"], direction: dirMap["Davolash ishi"], course: 3, group: "301-A", region: fargonaReg, district: await ds("Marg'ilon shahri") },
    { fish: "Tursunov Jasur Olimovich", academicYear: yearMap["2026/2027"], direction: dirMap["Pediatriya"], course: 4, group: "402-B", region: tashkentReg, district: await ds("Chilonzor tumani") },
    { fish: "Yusupova Malika Shavkatovna", academicYear: yearMap["2026/2027"], direction: dirMap["Stomatologiya"], course: 2, group: "201-S", region: fargonaReg, district: await ds("Quvasoy shahri") },
  ];
  for (const s of students) {
    if (!(await Student.findOne({ fish: s.fish, group: s.group }))) {
      await Student.create(s);
      created += 1;
    } else skipped += 1;
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Yaratildi : ${created}`);
  console.log(`  O'tkazildi: ${skipped} (allaqachon mavjud)`);
  console.log("═══════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[PracticeSample Seed] XATO:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
