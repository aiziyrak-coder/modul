"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const WorkloadModel = require("../src/modules/4.02-studyLoad/workload/workload.model");

const APPLY = process.argv.includes("--apply");
const RECALC_STATUSES = ["draft", "new"];
const LOCKED_STATUSES = ["in_review", "approved"];

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB ulandi");
  console.log(
    `Rejim: ${APPLY ? "APPLY (o'zgarishlar YOZILADI)" : "DRY-RUN (hech narsa yozilmaydi)"}\n`,
  );

  const { calculateBlockTotal } = WorkloadModel;

  const lockedDocs = await WorkloadModel.find(
    { status: { $in: LOCKED_STATUSES } },
    { _id: 1, status: 1, department: 1 },
  ).lean();
  console.log(
    `⚠ status ∈ {in_review, approved}: ${lockedDocs.length} ta — ERI himoyasi tufayli TEGILMAYDI:`,
  );
  for (const d of lockedDocs) {
    console.log(`  - ${d._id} (${d.status})`);
  }

  const docs = await WorkloadModel.find({ status: { $in: RECALC_STATUSES } });
  console.log(
    `\nQayta hisoblanadigan (status ∈ {draft, new}): ${docs.length} ta\n`,
  );

  let changedDocs = 0;
  let scannedBlocks = 0;
  let changedBlocks = 0;
  const report = [];
  const warnings = [];

  for (const wl of docs) {
    let before = 0;
    let after = 0;
    let blockChanges = 0;

    for (const dir of wl.directions || []) {
      for (const block of dir.blocks || []) {
        scannedBlocks++;
        before += Number(block.totalHour) || 0;

        const newTotal = calculateBlockTotal(
          block.studyWork,
          block.otherWork,
          block.leadership,
        );

        if (newTotal !== block.totalHour) {
          block.totalHour = newTotal;
          blockChanges++;
          changedBlocks++;
        }
        after += newTotal;
      }
    }

    if (blockChanges > 0) {
      changedDocs++;
      report.push({
        workloadId: wl._id.toString(),
        department: wl.department ? wl.department.toString() : null,
        status: wl.status,
        blocksChanged: blockChanges,
        totalHourBefore: before,
        totalHourAfter: after,
      });

      if (APPLY) {
        try {
          await wl.save();
        } catch (err) {
          warnings.push(`${wl._id}: saqlashda xato — ${err.message}`);
        }
      }
    }
  }

  console.log("=== Hisobot ===");
  console.log(`Skanerlangan hujjat: ${docs.length}, blok: ${scannedBlocks}`);
  console.log(
    `O'zgargan hujjat: ${changedDocs}, o'zgargan blok: ${changedBlocks}\n`,
  );
  for (const r of report) {
    console.log(
      `  [${r.status}] ${r.workloadId} (dept: ${r.department || "—"}) — ` +
        `${r.blocksChanged} blok, jami ${r.totalHourBefore} → ${r.totalHourAfter}`,
    );
  }

  if (warnings.length) {
    console.log("\n⚠ Ogohlantirishlar:");
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (!APPLY) {
    console.log(
      "\nDRY-RUN — hech narsa yozilmadi. Yozish uchun: node seed/backfill-workload-hours.js --apply",
    );
  } else {
    console.log(`\n✓ APPLY — ${changedDocs} hujjat DB'ga yozildi.`);
  }

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill XATO:", err.message);
    console.error(err.stack);
    process.exit(1);
  });
