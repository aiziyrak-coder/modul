#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const GiftedStudent = require("../src/modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const StudentAchievement = require("../src/modules/4.11-giftedStudent/studentAchievement/studentAchievement.model");
const Scholarship = require("../src/modules/4.11-giftedStudent/scholarship/scholarship.model");
const ScholarshipApplication = require("../src/modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model");
const DocumentType = require("../src/modules/4.11-giftedStudent/documentType/documentType.model");
const User = require("../src/modules/4.01-auth/user/user.model");
const Faculty = require("../src/references/faculty/faculty.model");
const { MODULE_PIN_PREFIX, DEMO_SLOT_START, modulePin } = require("./_module-pins");
const {
  currentAcademicYear,
} = require("../src/modules/4.11-giftedStudent/_services/academicYearWindow");

const PREFIX = MODULE_PIN_PREFIX["4.11"];

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");

const KUN = 86_400_000;
const kun = (n) => new Date(Date.now() + n * KUN);
const YIL = "2025-2026";

const HUJJAT_TURLARI = ["Ilmiy maqola", "Olimpiada", "Sertifikat", "Loyiha", "Patent"];

const TALABALAR = [
  { ism: "Nodira Rahimova", fak: 0, kurs: 3, ball: 96 },
  { ism: "Jasur Tolipov", fak: 0, kurs: 2, ball: 91 },
  { ism: "Malika Yusupova", fak: 1, kurs: 4, ball: 88 },
  { ism: "Bekzod Ergashev", fak: 1, kurs: 3, ball: 84 },
  { ism: "Sevara Qodirova", fak: 2, kurs: 1, ball: 79 },
  { ism: "Aziz Nazarov", fak: 0, kurs: 4, ball: 76 },
  { ism: "Dilnoza Sattorova", fak: 1, kurs: 2, ball: 72 },
  { ism: "Otabek Ismoilov", fak: 2, kurs: 3, ball: 68 },
  { ism: "Kamola Tursunova", fak: 2, kurs: 2, ball: 63 },
  { ism: "Shohruh Aliyev", fak: 0, kurs: 1, ball: 58 },
  { ism: "Zilola Xolmatova", fak: 1, kurs: 1, ball: 54 },
  { ism: "Sardor Umarov", fak: 2, kurs: 4, ball: 47 },
];

const YUTUQLAR = [
  { t: 0, d: 0, s: "approved", ofset: 60, ball: 25 },
  { t: 0, d: 1, s: "approved", ofset: 45, ball: 30 },
  { t: 1, d: 0, s: "approved", ofset: 40, ball: 25 },
  { t: 2, d: 2, s: "approved", ofset: 35, ball: 15 },
  { t: 3, d: 3, s: "approved", ofset: 30, ball: 20 },
  { t: 4, d: 1, s: "approved", ofset: 25, ball: 30 },
  { t: 5, d: 4, s: "approved", ofset: 20, ball: 35 },
  { t: 6, d: 0, s: "pending", ofset: 28, ball: 25 },
  { t: 7, d: 2, s: "pending", ofset: 19, ball: 15 },
  { t: 8, d: 1, s: "pending", ofset: 11, ball: 30 },
  { t: 9, d: 3, s: "pending", ofset: 6, ball: 20 },
  { t: 10, d: 0, s: "pending", ofset: 2, ball: 25 },
  { t: 11, d: 2, s: "rejected", ofset: 33, ball: 0 },
  { t: 4, d: 3, s: "rejected", ofset: 22, ball: 0 },
];

const ARIZALAR = [
  { t: 0, tur: "rektor_stipendiyasi", s: "approved", hakam: 3 },
  { t: 1, tur: "rektor_stipendiyasi", s: "pending", hakam: 3 },
  { t: 2, tur: "rektor_stipendiyasi", s: "pending", hakam: 1 },
  { t: 3, tur: "rektor_stipendiyasi", s: "pending", hakam: 0 },
  { t: 4, tur: "rektor_stipendiyasi", s: "pending", hakam: 2 },
  { t: 5, tur: "nomdor_stipendiya", s: "approved", hakam: 0 },
  { t: 6, tur: "nomdor_stipendiya", s: "pending", hakam: 0 },
  { t: 7, tur: "nomdor_stipendiya", s: "rejected", hakam: 0 },
  { t: 8, tur: "davlat_granti", s: "approved", hakam: 0 },
  { t: 9, tur: "davlat_granti", s: "pending", hakam: 0 },
  { t: 10, tur: "davlat_granti", s: "rejected", hakam: 0 },
];

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[GiftedDemo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const faculties = await Faculty.find({}).select("_id title").limit(3).lean();
  if (faculties.length < 1) {
    console.error("  ✖ Fakultet topilmadi — avval references seed'i kerak.");
    await mongoose.disconnect();
    process.exit(1);
  }
  const fak = (i) => faculties[i % faculties.length];

  const judges = await User.find({}).select('_id').limit(3).lean();
  const bandUserIds = new Set(
    (await GiftedStudent.find({ user: { $ne: null } }).select('user').lean()).map((d) =>
      String(d.user),
    ),
  );
  const userPool = (await User.find({}).select('_id').limit(120).lean()).filter(
    (u) => !bandUserIds.has(String(u._id)),
  );
  console.log(
    `  Fakultetlar: ${faculties.length} · hakamlar: ${judges.length} · ` +
      `bo'sh foydalanuvchi: ${userPool.length} (band: ${bandUserIds.size})`,
  );

  const docTypes = [];
  for (const name of HUJJAT_TURLARI) {
    let d = await DocumentType.findOne({ title: name });
    if (!d && WRITE) d = await DocumentType.create({ title: name, active: true });
    docTypes.push(d);
  }
  console.log(`  Hujjat turlari: ${docTypes.filter(Boolean).length}/${HUJJAT_TURLARI.length}`);

  const students = [];
  let yangiTalaba = 0;
  for (let i = 0; i < TALABALAR.length; i += 1) {
    const x = TALABALAR[i];
    const jshshir = modulePin(PREFIX, DEMO_SLOT_START + i);
    let doc = await GiftedStudent.findOne({ jshshir });
    if (!doc && WRITE) {
      const bogliqUser = userPool[i];
      if (!bogliqUser) { console.warn(`  ⚠ foydalanuvchi yetmadi (#${i}) — o'tkazildi`); students.push(null); continue; }
      doc = await GiftedStudent.create({
        user: bogliqUser._id,
        fullName: x.ism,
        jshshir,
        faculty: fak(x.fak).title,
        facultyId: fak(x.fak)._id,
        course: x.kurs,
        totalScore: x.ball,
        scoresByYear: { [currentAcademicYear()]: x.ball },
        rank: i + 1,
        academicYear: YIL,
        active: true,
      });
      yangiTalaba += 1;
    }
    students.push(doc);
  }
  console.log(`  Talabalar: +${yangiTalaba} yangi (jami shablon: ${TALABALAR.length})`);

  let yangiYutuq = 0;
  if (WRITE && students.every(Boolean) && docTypes.every(Boolean)) {
    for (const y of YUTUQLAR) {
      const student = students[y.t];
      const dt = docTypes[y.d];
      const title = `${dt.title} — ${student.fullName}`;
      const bor = await StudentAchievement.findOne({ title });
      if (bor) continue;
      await StudentAchievement.create({
        student: student._id,
        documentType: dt._id,
        title,
        score: y.ball,
        scoreLabel: dt.title,
        status: y.s,
        active: true,
        createdAt: kun(-y.ofset),
        updatedAt: kun(-y.ofset),
      });
      yangiYutuq += 1;
    }
  }
  console.log(`  Yutuqlar: +${yangiYutuq} yangi (jami shablon: ${YUTUQLAR.length})`);

  const scholarships = {};
  for (const [key, type, name] of [
    ["rektor", "rektor", "Rektor stipendiyasi 2025-2026"],
    ["nomdor", "nomdor", "Nomdor stipendiya 2025-2026"],
  ]) {
    let s = await Scholarship.findOne({ name });
    if (!s && WRITE) {
      s = await Scholarship.create({
        name,
        type,
        description: `${name} — demo`,
        academicYear: YIL,
        amount: type === "rektor" ? 2_000_000 : 1_500_000,
        judges: type === "rektor" ? judges.map((j) => j._id) : [],
        active: true,
      });
    }
    scholarships[key] = s;
  }
  console.log(`  Stipendiyalar: ${Object.values(scholarships).filter(Boolean).length}/2`);

  let yangiAriza = 0;
  if (WRITE && students.every(Boolean)) {
    for (const a of ARIZALAR) {
      const student = students[a.t];
      const bor = await ScholarshipApplication.findOne({
        giftedStudent: student._id,
        type: a.tur,
      });
      if (bor) continue;

      const sch = a.tur === "rektor_stipendiyasi" ? scholarships.rektor : scholarships.nomdor;
      const judgeScores = judges.slice(0, a.hakam).map((j) => ({
        judge: j._id,
        scores: [],
        totalScore: 60 + Math.round(student.totalScore / 4),
      }));

      await ScholarshipApplication.create({
        giftedStudent: student._id,
        scholarship: a.tur === "davlat_granti" ? undefined : sch?._id,
        type: a.tur,
        scholarshipName: a.tur === "davlat_granti" ? "Davlat granti" : sch?.name,
        status: a.s,
        academicYear: YIL,
        judgeScores,
        totalScore: student.totalScore,
        appliedAt: kun(-20 + a.t),
        active: true,
      });
      yangiAriza += 1;
    }
  }
  console.log(`  Stipendiya arizalari: +${yangiAriza} yangi (jami shablon: ${ARIZALAR.length})`);

  console.log(
    WRITE
      ? "\n  ✓ Tayyor. Sinash: GET /api/gifted-statistics/overview"
      : "\n  Yozish uchun: node seed/gifted-demo-data.seed.js --write",
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
