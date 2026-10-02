"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const AcademicTitle = require("../src/references/academicTitle/academicTitle.model");

const TITLES = [
  {
    title: "Assistent",
    rateTime: 900,
    hourMultiplier: 1.0,
    desc: "Boshlovchi o'qituvchi (Assistant)",
  },
  {
    title: "Katta o'qituvchi",
    rateTime: 850,
    hourMultiplier: 1.0,
    desc: "Senior teacher",
  },
  {
    title: "Dotsent",
    rateTime: 800,
    hourMultiplier: 1.15,
    desc: "Associate Professor (PhD)",
  },
  {
    title: "Professor",
    rateTime: 720,
    hourMultiplier: 1.2,
    desc: "Full Professor (DSc)",
  },
];

function resolveWriteMode(argv) {
  const WRITE = argv.includes("--write");
  const DRY = !WRITE || argv.includes("--dry-run");
  return { WRITE, DRY };
}

function decideAcademicTitleChange(existing, target) {
  if (!existing) return { action: "create" };

  const changes = [];
  if (existing.rateTime !== target.rateTime) {
    changes.push({ field: "rateTime", old: existing.rateTime, new: target.rateTime });
  }
  if (existing.hourMultiplier !== target.hourMultiplier) {
    changes.push({ field: "hourMultiplier", old: existing.hourMultiplier, new: target.hourMultiplier });
  }
  if (existing.active !== true) {
    changes.push({ field: "active", old: existing.active, new: true });
  }
  return changes.length ? { action: "update", changes } : { action: "unchanged" };
}

const formatChanges = (changes) => changes.map((c) => `${c.field}: ${c.old} → ${c.new}`).join(", ");

async function seed() {
  const { WRITE, DRY } = resolveWriteMode(process.argv);
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(`[AcademicTitles Seed] Connected${DRY ? "  [DRY-RUN — yozilmaydi]" : ""}`);

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const t of TITLES) {
    const existing = await AcademicTitle.findOne({ title: t.title });
    const decision = decideAcademicTitleChange(existing, t);

    if (decision.action === "create") {
      created++;
      if (DRY) {
        console.log(`  + [DRY] yaratilardi [${t.title.padEnd(20)}] rateTime=${t.rateTime} | mult=${t.hourMultiplier}`);
      } else {
        await AcademicTitle.create({ ...t, active: true });
        console.log(`  + yaratildi     [${t.title.padEnd(20)}] rateTime=${t.rateTime} | mult=${t.hourMultiplier}`);
      }
      continue;
    }

    if (decision.action === "update") {
      updated++;
      const diffText = formatChanges(decision.changes);
      if (DRY) {
        console.log(`  ~ [DRY] yangilanardi [${t.title.padEnd(20)}] ${diffText}`);
      } else {
        existing.rateTime = t.rateTime;
        existing.hourMultiplier = t.hourMultiplier;
        existing.desc = t.desc;
        existing.active = true;
        await existing.save();
        console.log(`  ~ yangilandi    [${t.title.padEnd(20)}] ${diffText}`);
      }
      continue;
    }

    unchanged++;
  }

  const total = await AcademicTitle.countDocuments({});
  console.log("\n═══════════════════════════════════════════");
  console.log(`  ${DRY ? "Yaratilardi" : "Created"}:    ${created}`);
  console.log(`  ${DRY ? "Yangilanardi" : "Updated"}:    ${updated}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  DB total:   ${total}`);
  if (DRY) console.log("\n  ⚠️  DRY-RUN edi — bazaga hech narsa yozilmadi. Yozish uchun: --write");
  console.log("═══════════════════════════════════════════\n");

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("[AcademicTitles Seed] ERROR:", err);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { TITLES, resolveWriteMode, decideAcademicTitleChange };
