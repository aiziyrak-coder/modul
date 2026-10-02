#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Indicator = require("../src/modules/4.12-qualityAssurance/indicator/indicator.model");
const Submission = require("../src/modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");
const User = require("../src/modules/4.01-auth/user/user.model");
const Faculty = require("../src/references/faculty/faculty.model");
const AcademicYear = require("../src/references/academicYear/academicYear.model");
const Division = require("../src/references/division/division.model");

const MONGO = process.env.MONGO_HOST || "mongodb://127.0.0.1:27017/institute-test";
const WRITE = process.argv.includes("--write");
const YIL_TITLE = "2025/2026";

const DEMO_INDIKATOR_SONI = 8;
const CANONICAL_DESC = /^TT 4\.(12|10)\./;

(async () => {
  await mongoose.connect(MONGO);
  console.log(`[QualityDemo] ${WRITE ? "✍ WRITE" : "🔍 DRY-RUN"} · ${MONGO}`);

  const ay = await AcademicYear.findOne({ title: YIL_TITLE }).select("_id").lean();
  if (!ay) {
    console.error(`  ✖ O'quv yili topilmadi: ${YIL_TITLE}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const faculties = await Faculty.find({}).select("_id title").limit(3).lean();
  if (!faculties.length) {
    console.error("  ✖ Fakultet topilmadi.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const divisions = [];
  for (const f of faculties) {
    const title = `${f.title} — sifat bo'limi`;
    let d = await Division.findOne({ title });
    if (!d && WRITE) d = await Division.create({ title, faculty: f._id, active: true });
    divisions.push(d);
  }
  console.log(`  Bo'limlar: ${divisions.filter(Boolean).length}/${faculties.length}`);

  const indicators = await Indicator.find({ desc: CANONICAL_DESC })
    .sort({ order: 1 })
    .limit(DEMO_INDIKATOR_SONI)
    .lean();
  if (indicators.length < DEMO_INDIKATOR_SONI) {
    console.error(
      `  ✖ Kanonik indikator yetarli emas (${indicators.length}/${DEMO_INDIKATOR_SONI}).` +
        " Avval ishga tushiring: node seed/indicators.seed.js",
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`  Indikatorlar: ${indicators.length} ta kanonik qayta ishlatildi (yangi yaratilmadi)`);

  if (!WRITE || indicators.some((x) => !x) || divisions.some((d) => !d)) {
    console.log(WRITE ? "\n  ⚠ To'liq emas" : "\n  Yozish uchun: --write");
    await mongoose.disconnect();
    return;
  }

  const teachers = await User.find({}).select("_id division").limit(12).lean();
  let biriktirildi = 0;
  for (let i = 0; i < teachers.length; i += 1) {
    if (teachers[i].division) continue;
    await User.updateOne(
      { _id: teachers[i]._id },
      { $set: { division: divisions[i % divisions.length]._id } },
    );
    biriktirildi += 1;
  }
  console.log(`  O'qituvchilarga bo'lim biriktirildi: ${biriktirildi}/${teachers.length}`);

  let yangiSub = 0;
  for (let i = 0; i < teachers.length; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      const ind = indicators[(i + k) % indicators.length];
      const bor = await Submission.findOne({
        teacher: teachers[i]._id,
        indicator: ind._id,
        academicYear: ay._id,
      });
      if (bor) continue;

      const tasdiq = k < 2;
      await Submission.create({
        teacher: teachers[i]._id,
        indicator: ind._id,
        academicYear: ay._id,
        status: tasdiq ? "approved" : "pending",
        score: tasdiq ? Math.max(1, ind.coefficient - (i % 4) * 2) : 0,
        data: {},
        active: true,
      });
      yangiSub += 1;
    }
  }
  console.log(`  Submissionlar: +${yangiSub}`);

  console.log("\n  ✓ Tayyor. Sinash: GET /api/quality-statistics/overview");
  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
