"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const ScienceBranch = require("../src/references/scienceBranch/scienceBranch.model");

const BRANCHES = [
  ["01.00.00", "Fizika-matematika fanlari"],
  ["02.00.00", "Kimyo fanlari"],
  ["03.00.00", "Biologiya fanlari"],
  ["04.00.00", "Geologiya-mineralogiya fanlari"],
  ["05.00.00", "Texnika fanlari"],
  ["06.00.00", "Qishloq xo'jaligi fanlari"],
  ["07.00.00", "Tarix fanlari"],
  ["08.00.00", "Iqtisodiyot fanlari"],
  ["09.00.00", "Falsafa fanlari"],
  ["10.00.00", "Filologiya fanlari"],
  ["11.00.00", "Geografiya fanlari"],
  ["12.00.00", "Yuridik fanlar"],
  ["13.00.00", "Pedagogika fanlari"],
  ["14.00.00", "Tibbiyot fanlari"],
  ["15.00.00", "Farmatsevtika fanlari"],
  ["16.00.00", "Veterinariya fanlari"],
  ["17.00.00", "San'atshunoslik fanlari"],
  ["18.00.00", "Arxitektura"],
  ["19.00.00", "Psixologiya fanlari"],
  ["21.00.00", "Harbiy fanlar"],
  ["22.00.00", "Sotsiologiya fanlari"],
  ["23.00.00", "Siyosiy fanlar"],
  ["24.00.00", "Islomshunoslik fanlari"],
];

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("[ScienceBranches Seed] MongoDB ga ulandi\n");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [code, title] of BRANCHES) {
    const existing = await ScienceBranch.findOne({ title });
    if (existing) {
      if (existing.code !== code) {
        existing.code = code;
        await existing.save();
        updated += 1;
        console.log(`  ~ ${code}  ${title}   (shifr yozildi)`);
      } else {
        skipped += 1;
      }
      continue;
    }
    await ScienceBranch.create({ title, code, active: true });
    created += 1;
    console.log(`  + ${code}  ${title}`);
  }

  const total = await ScienceBranch.countDocuments();
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Yaratildi: ${created}   Shifr yozildi: ${updated}   ` +
      `O'zgarishsiz: ${skipped}   Bazada jami: ${total}`,
  );
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { BRANCHES };

if (require.main === module) {
  main().catch((err) => {
    console.error("[ScienceBranches Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
