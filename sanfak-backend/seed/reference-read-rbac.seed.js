"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
mongoose.plugin((schema) => schema.set("id", false));

const { MODULES, ACTIONS } = require("../src/config/constants");

const DRY = !process.argv.includes("--write");

const REFERENCE_SECTIONS = [
  MODULES.SCIENCE,
  MODULES.COURSE,
  MODULES.DIRECTION,
  MODULES.EDUCATION_ACTIVITY_TYPE,
  MODULES.ACADEMIC_YEAR,
  MODULES.ACADEMIC_LEVEL,
  MODULES.ACADEMIC_TITLE,
  MODULES.SCIENCE_BRANCH,
];

const READ_ACTIONS = [ACTIONS.READ, ACTIONS.READ_ALL];

function mergeReadActions(existing = []) {
  const set = new Set(existing);
  READ_ACTIONS.forEach((a) => set.add(a));
  return [...set];
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB:", mongoose.connection.name);
  console.log("  rejim:", DRY ? "DRY-RUN (yozilmaydi)" : "WRITE");
  console.log("  lug'atlar:", REFERENCE_SECTIONS.join(", "));
  console.log("  beriladigan amallar:", READ_ACTIONS.join(", "), "\n");

  const RoleModel = require("../src/modules/4.01-auth/role/role.model");
  const roles = await RoleModel.find({ active: true });

  let changed = 0;
  let untouched = 0;

  for (const role of roles) {
    const current = role.permissions || [];
    const next = [...current];
    const added = [];

    for (const section of REFERENCE_SECTIONS) {
      const idx = next.findIndex((p) => p.section === section);
      if (idx === -1) {
        next.push({ section, actionKeys: [...READ_ACTIONS] });
        added.push(`${section}: +${READ_ACTIONS.join(",")}`);
        continue;
      }
      const before = next[idx].actionKeys || [];
      const merged = mergeReadActions(before);
      if (merged.length !== before.length) {
        next[idx] = { ...next[idx].toObject?.() ?? next[idx], section, actionKeys: merged };
        added.push(`${section}: ${before.join(",") || "(bo'sh)"} → ${merged.join(",")}`);
      }
    }

    if (added.length === 0) {
      untouched++;
      continue;
    }

    changed++;
    console.log(`  ${DRY ? "~" : "+"} ${role.title}`);
    added.forEach((a) => console.log(`      ${a}`));

    if (!DRY) {
      role.permissions = next;
      await role.save();
    }
  }

  console.log(
    `\n${DRY ? "DRY-RUN" : "YOZILDI"} — o'zgaradigan rol: ${changed}, tegilmagan: ${untouched}`,
  );
  if (DRY) console.log("Yozish uchun: node seed/reference-read-rbac.seed.js --write");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("XATO:", err.message);
  process.exit(1);
});
