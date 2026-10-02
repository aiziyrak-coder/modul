"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

async function main() {
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  log();
  line("═");
  log("  TAQSIMOT SOAT DIAGNOSTIKASI (READ-ONLY, --dry)");
  log(`  Baza: ${mongoose.connection.name}`);
  line("═");

  const drafts = await db
    .collection("workloaddistributions")
    .find({ status: "draft" })
    .project({ department: 1, workload: 1, totalHour: 1, residueHour: 1, teachers: 1 })
    .toArray();

  log(`\nJami "draft" hujjat: ${drafts.length}`);

  const negativeResidue = [];
  const brokenIdentity = [];

  for (const dist of drafts) {
    const teachersSum = (dist.teachers || []).reduce(
      (sum, t) => sum + (t.totalHour || 0),
      0,
    );
    const expectedResidue = (dist.totalHour || 0) - teachersSum;
    const residue = dist.residueHour || 0;

    if (residue < 0) {
      negativeResidue.push({ _id: dist._id, department: dist.department, residue });
    }
    if (residue !== expectedResidue) {
      brokenIdentity.push({
        _id: dist._id,
        department: dist.department,
        residueHour: residue,
        expected: expectedResidue,
        totalHour: dist.totalHour || 0,
        teachersSum,
      });
    }
  }

  line();
  log(`\n1) residueHour < 0 (${negativeResidue.length} ta):`);
  if (negativeResidue.length === 0) {
    log("   — yo'q");
  } else {
    for (const d of negativeResidue) {
      log(`   · ${d._id}  department=${d.department ?? "—"}  residueHour=${d.residue}`);
    }
  }

  log(`\n2) residueHour !== totalHour - Σ teachers[].totalHour (${brokenIdentity.length} ta):`);
  if (brokenIdentity.length === 0) {
    log("   — yo'q");
  } else {
    for (const d of brokenIdentity) {
      log(
        `   · ${d._id}  department=${d.department ?? "—"}  ` +
          `residueHour=${d.residueHour} (kutilgan: ${d.expected}) ` +
          `totalHour=${d.totalHour} Σteachers=${d.teachersSum}`,
      );
    }
  }

  line("═");
  log(
    `\nXULOSA: ${negativeResidue.length + brokenIdentity.length} ta hujjatda ` +
      `nomuvofiqlik (${negativeResidue.length} manfiy qoldiq, ` +
      `${brokenIdentity.length} identity buzilishi). Bu skript HECH NARSA ` +
      `YOZMADI — tuzatish O'UB tomonidan updateBlockHours orqali qo'lda.`,
  );
  line("═");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Diagnostika xatosi:", err.message);
  process.exit(1);
});
