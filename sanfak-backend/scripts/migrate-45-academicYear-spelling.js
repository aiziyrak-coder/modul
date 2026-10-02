const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const { normalizeTitle } = require("#references/_services/academicYearResolver");

const COLLECTIONS = [
  "residents",
  "residencyannouncements",
  "residencycurriculums",
  "residencylessons",
  "residencynotices",
  "residencyproblemstudents",
  "residencyattestations",
  "residentapplications",
  "residencyactivityplans",
  "residencydissertationplans",
];

const WRITE = process.argv.includes("--write");
const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  log(
    WRITE
      ? "REJIM: --write — o'zgarishlar BAZAGA YOZILADI\n"
      : "REJIM: quruq ishlash — hech narsa yozilmaydi (yozish uchun --write)\n",
  );

  const rows = await db.collection("academicyears").find({}).toArray();
  const byKey = new Map();
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    if (key) byKey.set(key, r.title);
  }
  log(`Ma'lumotnoma: ${byKey.size} o'quv yili\n`);

  let changed = 0;
  let missed = 0;

  for (const name of COLLECTIONS) {
    const col = db.collection(name);
    const docs = await col
      .find({ academicYear: { $type: "string", $ne: "" } })
      .project({ academicYear: 1 })
      .toArray();
    if (!docs.length) continue;

    let touched = 0;
    for (const d of docs) {
      const key = normalizeTitle(d.academicYear);
      const canonical = key ? byKey.get(key) : null;
      if (!canonical) {
        missed++;
        continue;
      }
      if (canonical === d.academicYear) continue;

      touched++;
      changed++;
      if (WRITE) {
        await col.updateOne({ _id: d._id }, { $set: { academicYear: canonical } });
      }
    }
    log(`  ${name.padEnd(28)} ${String(touched).padStart(4)}/${docs.length} yozuv`);
  }

  log(
    `\nNatija${WRITE ? "" : " (QURUQ)"}: ${changed} ta satr tekislanadi, ` +
      `${missed} ta ma'lumotnomada topilmadi (TEGILMADI).\n`,
  );
  if (!WRITE) log("Yozish uchun: node scripts/migrate-45-academicYear-spelling.js --write\n");

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    console.error("Migratsiya XATO:", err.message);
    process.exit(1);
  });
}

module.exports = { run, COLLECTIONS };
