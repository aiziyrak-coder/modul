const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const {
  academicYearOf,
} = require("../src/modules/4.11-giftedStudent/_services/academicYearWindow");

const WRITE = process.argv.includes("--write");

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;
  const ach = db.collection("studentachievements");
  const gs = db.collection("giftedstudents");

  console.log(`\n  DB: ${mongoose.connection.name}`);
  console.log(`  Rejim: ${WRITE ? "YOZISH (--write)" : "DRY-RUN"}\n`);

  console.log("-- 1. O'quv yili muhri --");
  const unstamped = await ach
    .find({ $or: [{ academicYear: null }, { academicYear: { $exists: false } }] })
    .toArray();

  const byYear = new Map();
  let stamped = 0;
  let noDate = 0;
  for (const doc of unstamped) {
    const year = academicYearOf(doc.createdAt);
    if (!year) {
      noDate++;
      continue;
    }
    if (WRITE) await ach.updateOne({ _id: doc._id }, { $set: { academicYear: year } });
    byYear.set(year, (byYear.get(year) || 0) + 1);
    stamped++;
  }

  const total = await ach.countDocuments({});
  console.log(`     Jami yutuq:        ${total}`);
  console.log(`     Muhrsiz:           ${unstamped.length}`);
  console.log(`     ${WRITE ? "Muhrlandi" : "Muhrlanadi"}:${WRITE ? "         " : "        "}${stamped}`);
  if (noDate) console.log(`     ⚠️  Sanasiz (o'tkazildi): ${noDate}`);
  for (const [year, n] of [...byYear.entries()].sort()) {
    console.log(`       ${year}  ${n}`);
  }

  console.log("\n-- 2. Reyting (totalScore + scoresByYear) --");
  const students = await gs.find({}).project({ totalScore: 1 }).toArray();
  let changed = 0;
  for (const s of students) {
    const approved = await ach
      .find({ student: s._id, status: "approved", deletedAt: null })
      .toArray();

    const scoresByYear = {};
    let totalScore = 0;
    for (const a of approved) {
      const score = a.score || 0;
      totalScore += score;
      const year = a.academicYear || academicYearOf(a.createdAt);
      if (year) scoresByYear[year] = (scoresByYear[year] || 0) + score;
    }

    const years = Object.entries(scoresByYear)
      .sort()
      .map(([y, v]) => `${y}=${v}`)
      .join(" ");
    const drift = (s.totalScore || 0) !== totalScore ? ` (saqlangan ${s.totalScore})` : "";
    if (approved.length || s.totalScore) {
      console.log(`     ${String(s._id)}  jami ${totalScore}${drift}  ${years || "—"}`);
    }
    if (WRITE) await gs.updateOne({ _id: s._id }, { $set: { totalScore, scoresByYear } });
    changed++;
  }
  console.log(`     ${WRITE ? "Yangilandi" : "Yangilanadi"}: ${changed} talaba`);

  if (!WRITE) console.log("\n  Dry-run — hech narsa yozilmadi. Qo'llash uchun: --write");
  console.log("");
  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Backfill XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { run };
