"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");

const SECTIONS = [
  "researchWork",
  "mentoringWork",
  "organizationalWork",
  "extraWork",
];

function transformItem(item, isMentoring = false) {
  const next = { ...item };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(next, "workVolume")) {
    if (next.plannedCount === undefined) {
      const parsed = parseInt(next.workVolume, 10);
      next.plannedCount = Number.isNaN(parsed) ? 0 : parsed;
    }
    delete next.workVolume;
    changed = true;
  }

  if (typeof next.semester === "number") {
    next.semester = [next.semester];
    changed = true;
  }

  if (isMentoring && !next.title) {
    next.title = next.topic || next.studentName || "(nomsiz)";
    changed = true;
  }

  return { next, changed };
}

function transformDoc(doc) {
  const $set = {};
  let itemsChanged = 0;

  for (const section of SECTIONS) {
    const items = Array.isArray(doc[section]) ? doc[section] : [];
    if (items.length === 0) continue;

    let sectionChanged = false;
    const nextItems = items.map((item) => {
      const { next, changed } = transformItem(item, section === "mentoringWork");
      if (changed) {
        sectionChanged = true;
        itemsChanged += 1;
      }
      return next;
    });

    if (sectionChanged) $set[section] = nextItems;
  }

  return { $set, itemsChanged, docChanged: Object.keys($set).length > 0 };
}

async function migrate() {
  const db = mongoose.connection.db;
  const coll = db.collection("personalworkplans");
  const total = await coll.countDocuments();

  console.log(`\n→ personalworkplans (${total} hujjat)`);

  let docsChanged = 0;
  let itemsChanged = 0;

  const cursor = coll.find({});
  for await (const doc of cursor) {
    const result = transformDoc(doc);
    if (!result.docChanged) continue;

    docsChanged += 1;
    itemsChanged += result.itemsChanged;
    console.log(
      `  · ${doc._id} — ${Object.keys(result.$set).join(", ")} (${result.itemsChanged} element)`,
    );

    if (!DRY) {
      await coll.updateOne({ _id: doc._id }, { $set: result.$set });
    }
  }

  console.log(
    `\n  Hujjat: ${docsChanged}/${total} o'zgaradi, jami element: ${itemsChanged} ta`,
  );
  return { total, docsChanged, itemsChanged };
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  console.log(
    `[PersonalWorkPlan Migration] MongoDB${DRY ? "  —  🔍 DRY-RUN (hech narsa yozilmaydi)" : ""}`,
  );

  const summary = await migrate();

  console.log("\n═══════════════════════════════════════════════════");
  console.log(`  Jami hujjat : ${summary.total}`);
  console.log(`  O'zgaradi   : ${summary.docsChanged}`);
  console.log(`  Element     : ${summary.itemsChanged}`);
  console.log("═══════════════════════════════════════════════════");
  if (DRY) {
    console.log("\n  🔍 DRY-RUN — DB o'zgarmadi.");
    console.log("  Yozish: node seed/personalWorkPlan-item-shape.migration.js");
  }
  console.log("");

  await mongoose.disconnect();
}

module.exports = { transformItem, transformDoc, migrate };

if (require.main === module) {
  main().catch(async (err) => {
    console.error("[PersonalWorkPlan Migration] XATO:", err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}
