"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const DRY = process.argv.includes("--dry");
const PRUNE = process.argv.includes("--prune");

const TYPES = [
  "Ilmiy loyiha",
  "Amaliy loyiha",
  "Startap tanlov",
  "Xalqaro loyiha",
];

const norm = (s = "") => String(s).trim().toLowerCase().replace(/\s+/g, " ");

function missingTypes(existingNames = [], wanted = TYPES) {
  const have = new Set(existingNames.map(norm));
  return wanted.filter((n) => !have.has(norm(n)));
}

function extraTypes(existing = [], wanted = TYPES) {
  const ok = new Set(wanted.map(norm));
  return existing.filter((d) => !ok.has(norm(d.name)));
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[StartupTypes Seed] MongoDB ga ulandi${DRY ? " (DRY-RUN, yozilmaydi)" : ""}\n`,
  );

  const StartupType = require("../src/modules/4.10-scientificDept/startupType/startupType.model");
  const Startup = require("../src/modules/4.10-scientificDept/startup/startup.model");

  const existing = await StartupType.find({}, { name: 1, active: 1 }).lean();
  console.log(`  lug'atda hozir: ${existing.length} ta   (ro'yxat: ${TYPES.length} ta)`);

  const missing = missingTypes(existing.map((d) => d.name));
  missing.forEach((name) => console.log(`   + ${name}`));
  if (!DRY && missing.length) {
    await StartupType.insertMany(
      missing.map((name) => ({ name, active: true })),
      { ordered: false },
    );
  }

  const extra = PRUNE ? extraTypes(existing) : [];
  if (!PRUNE) {
    const wouldPrune = extraTypes(existing);
    if (wouldPrune.length) {
      console.log(
        `  i ro'yxatda yo'q ${wouldPrune.length} ta tur SAQLANDI ` +
          `(tozalash uchun: --prune): ${wouldPrune.map((d) => d.name).join(", ")}`,
      );
    }
  }
  let removed = 0;
  let deactivated = 0;

  for (const doc of extra) {
    const links = await Startup.countDocuments({ type: doc._id, active: true });
    if (links) {
      console.log(`   ! ${doc.name}   (${links} ta startap bog'langan → NOFAOL)`);
      if (!DRY) await StartupType.updateOne({ _id: doc._id }, { $set: { active: false } });
      deactivated += 1;
    } else {
      console.log(`   - ${doc.name}   (bog'lanish yo'q → o'chirildi)`);
      if (!DRY) await StartupType.deleteOne({ _id: doc._id });
      removed += 1;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(
    `  Qo'shildi: ${DRY ? 0 : missing.length}   O'chirildi: ${DRY ? 0 : removed}   ` +
      `Nofaol: ${DRY ? 0 : deactivated}   Bazada jami: ${await StartupType.countDocuments()}`,
  );
  console.log("═══════════════════════════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

module.exports = { TYPES, missingTypes, extraTypes, norm };

if (require.main === module) {
  main().catch((err) => {
    console.error("[StartupTypes Seed] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
