"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Position = require("../src/references/position/position.model");

const POSITION_HOURS = {
  "Assistent": {
    annualHours: 900,
    minAuditoriumHours: 550,
    maxAuditoriumHours: 950,
    allowedStakes: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
  },
  "Katta o'qituvchi": {
    annualHours: 850,
    minAuditoriumHours: 500,
    maxAuditoriumHours: 900,
    allowedStakes: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
  },
  "Dotsent": {
    annualHours: 800,
    minAuditoriumHours: 450,
    maxAuditoriumHours: 850,
    allowedStakes: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
  },
  "Professor": {
    annualHours: 720,
    minAuditoriumHours: 400,
    maxAuditoriumHours: 800,
    allowedStakes: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5],
  },

  "Kafedra mudiri": {
    annualHours: 720,
    minAuditoriumHours: 200,
    maxAuditoriumHours: 600,
    allowedStakes: [1.0],
  },
  "Dekan": {
    annualHours: 540,
    minAuditoriumHours: 100,
    maxAuditoriumHours: 400,
    allowedStakes: [1.0],
  },
  "Prorektor": {
    annualHours: 360,
    minAuditoriumHours: 50,
    maxAuditoriumHours: 200,
    allowedStakes: [1.0],
  },
  "Rektor": {
    annualHours: 180,
    minAuditoriumHours: 0,
    maxAuditoriumHours: 100,
    allowedStakes: [1.0],
  },
};

function resolveWriteMode(argv) {
  const WRITE = argv.includes("--write");
  const DRY = !WRITE || argv.includes("--dry-run");
  return { WRITE, DRY };
}

function decidePositionHoursChange(existing, config) {
  const changes = [];
  if (existing.annualHours !== config.annualHours) {
    changes.push({ field: "annualHours", old: existing.annualHours, new: config.annualHours });
  }
  if (existing.minAuditoriumHours !== config.minAuditoriumHours) {
    changes.push({ field: "minAuditoriumHours", old: existing.minAuditoriumHours, new: config.minAuditoriumHours });
  }
  if (existing.maxAuditoriumHours !== config.maxAuditoriumHours) {
    changes.push({ field: "maxAuditoriumHours", old: existing.maxAuditoriumHours, new: config.maxAuditoriumHours });
  }
  if (!changes.length) return { action: "unchanged", changes: [] };

  const oldStakes = JSON.stringify(existing.allowedStakes ?? []);
  const newStakes = JSON.stringify(config.allowedStakes ?? []);
  if (oldStakes !== newStakes) {
    changes.push({ field: "allowedStakes", old: existing.allowedStakes, new: config.allowedStakes });
  }
  return { action: "update", changes };
}

const formatChanges = (changes) =>
  changes.map((c) => `${c.field}=${JSON.stringify(c.old)}→${JSON.stringify(c.new)}`).join(", ");

async function seed() {
  const { WRITE, DRY } = resolveWriteMode(process.argv);
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(`[Position Hours Seed] Connected${DRY ? "  [DRY-RUN — yozilmaydi]" : ""}`);

  const positions = await Position.find({});
  console.log(`[Position Hours Seed] DB'da ${positions.length} ta Position`);

  let updated = 0;
  let unchanged = 0;
  let unknown = 0;

  for (const p of positions) {
    const config = POSITION_HOURS[p.title];
    if (!config) {
      console.log(`  ? ${p.title.padEnd(20)} | mapping yo'q (skipped)`);
      unknown++;
      continue;
    }

    const decision = decidePositionHoursChange(p, config);
    if (decision.action === "unchanged") {
      unchanged++;
      continue;
    }

    updated++;
    const diffText = formatChanges(decision.changes);
    if (DRY) {
      console.log(`  ~ [DRY] yangilanardi [${p.title.padEnd(20)}] ${diffText}`);
    } else {
      p.annualHours = config.annualHours;
      p.minAuditoriumHours = config.minAuditoriumHours;
      p.maxAuditoriumHours = config.maxAuditoriumHours;
      p.allowedStakes = config.allowedStakes;
      await p.save();
      console.log(`  ~ yangilandi    [${p.title.padEnd(20)}] ${diffText}`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  ${DRY ? "Yangilanardi" : "Updated"}:    ${updated}`);
  console.log(`  Unchanged:  ${unchanged}`);
  console.log(`  Unknown:    ${unknown} (mapping yo'q)`);
  console.log(`  DB total:   ${positions.length}`);
  if (DRY) console.log("\n  ⚠️  DRY-RUN edi — bazaga hech narsa yozilmadi. Yozish uchun: --write");
  console.log("═══════════════════════════════════════════\n");

  if (unknown > 0) {
    console.log("⚠ Unknown lavozimlar uchun mapping qo'shing yoki manual yangilang");
  }

  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("[Position Hours Seed] ERROR:", err);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { POSITION_HOURS, resolveWriteMode, decidePositionHoursChange };
