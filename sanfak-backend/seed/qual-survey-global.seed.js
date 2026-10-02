"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[QualSurveyGlobal Seed] MongoDB ga ulandi${DRY ? " (DRY-RUN, yozilmaydi)" : ""}\n`,
  );

  const col = mongoose.connection.db.collection("qualsurveys");

  const total = await col.countDocuments();
  const withCourse = await col.countDocuments({ course: { $exists: true } });
  console.log(`  Jami savol: ${total}   (kursga bog'langani: ${withCourse})`);

  const docs = await col
    .find({}, { projection: { question: 1, createdAt: 1 } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  const seen = new Set();
  const dupes = [];
  for (const d of docs) {
    const key = String(d.question || "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) dupes.push(d._id);
    else seen.add(key);
  }

  if (dupes.length) {
    console.log(`  - TAKRORIY savol o'chiriladi: ${dupes.length} ta`);
    if (!DRY) await col.deleteMany({ _id: { $in: dupes } });
  } else {
    console.log("  = takroriy savol yo'q");
  }

  if (withCourse) {
    console.log(`  ~ \`course\` maydoni olib tashlanadi: ${withCourse} ta yozuvdan`);
    if (!DRY) await col.updateMany({ course: { $exists: true } }, { $unset: { course: "" } });
  } else {
    console.log("  = `course` maydoni allaqachon yo'q");
  }

  const rest = await col
    .find({}, { projection: { _id: 1 } })
    .sort({ order: 1, createdAt: 1, _id: 1 })
    .toArray();
  if (!DRY && rest.length) {
    await col.bulkWrite(
      rest.map((d, i) => ({
        updateOne: { filter: { _id: d._id }, update: { $set: { order: i } } },
      })),
    );
  }
  console.log(`  ~ tartib qayta raqamlandi: ${rest.length} ta savol (0..${Math.max(rest.length - 1, 0)})`);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Umumiy so'rovnomada: ${DRY ? total - dupes.length : await col.countDocuments()} ta savol` +
      `${DRY ? "   (DRY — DB o'zgarmadi)" : ""}`,
  );
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualSurveyGlobal Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
