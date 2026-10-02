#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Workload = require("../src/modules/4.02-studyLoad/workload/workload.model");
const Distribution = require("../src/modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const TeacherProfile = require("../src/modules/4.03-teacher/teacher/teacher.model");
const PersonalWorkPlan = require("../src/modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");
const User = require("../src/modules/4.01-auth/user/user.model");
const Direction = require("../src/references/direction/direction.model");
const Department = require("../src/references/department/department.model");
const AcademicYear = require("../src/references/academicYear/academicYear.model");

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");
const YIL_TITLE = "2025/2026";

const KUN = 86_400_000;
const kun = (n) => new Date(Date.now() + n * KUN);

const YUKLAMALAR = [
  { nom: "Ichki kasalliklar kafedrasi yuklamasi", bosqich: "rektor", ofset: 18 },
  { nom: "Jarrohlik kafedrasi yuklamasi", bosqich: "rektor", ofset: 11 },
  { nom: "Pediatriya kafedrasi yuklamasi", bosqich: "rektor", ofset: 4 },
  { nom: "Farmatsevtika kafedrasi yuklamasi", bosqich: "prorektor", ofset: 9 },
  { nom: "Gigiyena kafedrasi yuklamasi", bosqich: "financial", ofset: 14 },
  { nom: "Stomatologiya kafedrasi yuklamasi", bosqich: "kafedra", ofset: 6 },
  { nom: "Jamoat salomatligi kafedrasi yuklamasi", bosqich: "approved", ofset: 40 },
  { nom: "Normal anatomiya kafedrasi yuklamasi", bosqich: "approved", ofset: 55 },
  { nom: "Mikrobiologiya kafedrasi yuklamasi", bosqich: "rejected", ofset: 30 },
  { nom: "Nevrologiya kafedrasi yuklamasi", bosqich: "draft", ofset: 3 },
];

const ZANJIR = ["methodical", "kafedra", "financial", "prorektor", "rektor"];

const OQITUVCHILAR = [
  { daraja: "fan_doktori", unvon: "professor", bandlik: "asosiy", h: 12 },
  { daraja: "fan_doktori", unvon: "professor", bandlik: "asosiy", h: 9 },
  { daraja: "fan_nomzodi", unvon: "dotsent", bandlik: "asosiy", h: 6 },
  { daraja: "fan_nomzodi", unvon: "dotsent", bandlik: "asosiy", h: 5 },
  { daraja: "fan_nomzodi", unvon: "dotsent", bandlik: "ichki_sovmestitel", h: 4 },
  { daraja: "falsafa_doktori", unvon: "katta_ilmiy_xodim", bandlik: "asosiy", h: 3 },
  { daraja: "falsafa_doktori", unvon: null, bandlik: "asosiy", h: 2 },
  { daraja: "falsafa_doktori", unvon: null, bandlik: "tashqi_sovmestitel", h: 2 },
  { daraja: null, unvon: null, bandlik: "asosiy", h: 0 },
  { daraja: null, unvon: null, bandlik: "asosiy", h: 0 },
  { daraja: null, unvon: null, bandlik: "soatbay", h: 0 },
  { daraja: null, unvon: null, bandlik: "tashqi_sovmestitel", h: 1 },
];

const REJALAR = [
  { holat: "completed", bajarilgan: 5, kechikkan: 0, rejada: 0 },
  { holat: "completed", bajarilgan: 4, kechikkan: 0, rejada: 1 },
  { holat: "approved", bajarilgan: 3, kechikkan: 1, rejada: 2 },
  { holat: "approved", bajarilgan: 3, kechikkan: 0, rejada: 3 },
  { holat: "approved", bajarilgan: 2, kechikkan: 2, rejada: 2 },
  { holat: "submitted", bajarilgan: 1, kechikkan: 1, rejada: 4 },
  { holat: "submitted", bajarilgan: 1, kechikkan: 0, rejada: 5 },
  { holat: "draft", bajarilgan: 0, kechikkan: 2, rejada: 4 },
  { holat: "draft", bajarilgan: 0, kechikkan: 0, rejada: 6 },
  { holat: "rejected", bajarilgan: 0, kechikkan: 1, rejada: 3 },
];

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[StudyLoad+Teacher Demo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const ay = await AcademicYear.findOne({ title: YIL_TITLE }).select("_id").lean();
  const directions = await Direction.find({}).select("_id").limit(4).lean();
  const departments = await Department.find({}).select("_id title").limit(7).lean();
  const users = await User.find({}).select("_id").limit(14).lean();

  if (!ay || !directions.length || !departments.length || users.length < 12) {
    console.error("  ✖ Ma'lumotnomalar yetarli emas (academicYear/direction/department/user).");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`  Manbalar: ${directions.length} yo'nalish · ${departments.length} kafedra · ${users.length} user`);

  if (!WRITE) {
    console.log("\n  Yozish uchun: --write");
    await mongoose.disconnect();
    return;
  }

  let yangiYuk = 0;
  const workloads = [];
  for (let i = 0; i < YUKLAMALAR.length; i += 1) {
    const x = YUKLAMALAR[i];
    let doc = await Workload.findOne({ title: x.nom });
    if (!doc) {
      const idx = ZANJIR.indexOf(x.bosqich);
      const steps = ZANJIR.map((step, k) => ({
        step,
        status:
          x.bosqich === "approved" || x.bosqich === "rejected"
            ? x.bosqich === "approved"
              ? "approved"
              : k === 0
                ? "rejected"
                : "pending"
            : idx >= 0 && k < idx
              ? "approved"
              : "pending",
        date: idx >= 0 && k < idx ? kun(-(x.ofset + (idx - k) * 2)) : null,
      }));

      const status =
        x.bosqich === "draft"
          ? "draft"
          : x.bosqich === "approved"
            ? "approved"
            : x.bosqich === "rejected"
              ? "rejected"
              : "in_review";

      doc = await Workload.create({
        title: x.nom,
        department: departments[i % departments.length]._id,
        academicYear: ay._id,
        direction: directions[i % directions.length]._id,
        status,
        date: kun(-x.ofset).toISOString().slice(0, 10),
        approvalSteps: steps,
        active: true,
        createdAt: kun(-x.ofset - 5),
        updatedAt: kun(-x.ofset),
      });
      yangiYuk += 1;
    }
    workloads.push(doc);
  }
  console.log(`  Yuklamalar: +${yangiYuk} (jami shablon: ${YUKLAMALAR.length})`);

  let yangiTaq = 0;
  for (let i = 0; i < workloads.length; i += 1) {
    const bor = await Distribution.findOne({ workload: workloads[i]._id });
    if (bor) continue;

    const vakantSoni = i % 3 === 0 ? 2 : i % 3 === 1 ? 1 : 0;
    const teachers = [0, 1, 2, 3].map((k) => {
      const vakant = k < vakantSoni;
      return {
        teacher: vakant ? null : users[(i + k) % users.length]._id,
        isVacant: vakant,
        vacantSince: vakant ? kun(-(20 + i * 3)) : null,
        totalHour: 120 + k * 20,
      };
    });
    const jami = teachers.reduce((s, t) => s + t.totalHour, 0);
    const qoldiq = teachers.filter((t) => t.isVacant).reduce((s, t) => s + t.totalHour, 0);

    await Distribution.create({
      workload: workloads[i]._id,
      academicYear: ay._id,
      department: departments[i % departments.length]._id,
      date: kun(-10 - i).toISOString().slice(0, 10),
      status: i < 3 ? "in_review" : i < 7 ? "approved" : "draft",
      teachers,
      totalHour: jami,
      residueHour: qoldiq,
      active: true,
    });
    yangiTaq += 1;
  }
  console.log(`  Taqsimotlar: +${yangiTaq}`);

  let yangiProf = 0;
  const profiles = [];
  for (let i = 0; i < OQITUVCHILAR.length; i += 1) {
    const x = OQITUVCHILAR[i];
    const user = users[i % users.length];
    let doc = await TeacherProfile.findOne({ user: user._id });
    if (!doc) {
      doc = await TeacherProfile.create({
        user: user._id,
        department: departments[i % departments.length]._id,
        academicDegree: x.daraja,
        academicTitle: x.unvon,
        employmentType: x.bandlik,
        hIndex: x.h,
        hrApprovalStatus: i < 9 ? "approved" : "pending",
        active: true,
      });
      yangiProf += 1;
    }
    profiles.push(doc);
  }
  console.log(`  O'qituvchi profillari: +${yangiProf} (jami: ${profiles.length})`);

  let yangiReja = 0;
  const ish = (status, n) =>
    Array.from({ length: n }, (_, k) => ({
      title: `Ish elementi ${k + 1}`,
      description: `Ish elementi ${k + 1} — demo`,
      status,
      completedAt: status === "completed" ? kun(-(10 + k)) : null,
    }));

  for (let i = 0; i < REJALAR.length; i += 1) {
    const x = REJALAR[i];
    const teacherUser = users[i % users.length];
    const bor = await PersonalWorkPlan.findOne({ teacher: teacherUser._id, academicYear: ay._id });
    if (bor) continue;

    await PersonalWorkPlan.create({
      teacher: teacherUser._id,
      academicYear: ay._id,
      name: `Shaxsiy ish reja — ${YIL_TITLE}`,
      status: x.holat,
      methodicalWork: ish("completed", x.bajarilgan),
      researchWork: ish("overdue", x.kechikkan),
      mentoringWork: ish("planned", x.rejada),
      organizationalWork: [],
      extraWork: [],
      active: true,
    });
    yangiReja += 1;
  }
  console.log(`  Ish rejalari: +${yangiReja} (${OQITUVCHILAR.length - REJALAR.length} o'qituvchida reja YO'Q — "topshirmaganlar" uchun)`);

  console.log("\n  ✓ Tayyor:");
  console.log("    GET /api/study-load-statistics/overview");
  console.log("    GET /api/teacher-statistics/overview");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
