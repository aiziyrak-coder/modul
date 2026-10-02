"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const DRY = process.argv.includes("--dry");

(async () => {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const dists = await db
    .collection("workloaddistributions")
    .find({})
    .toArray();
  console.log(`workloaddistributions: ${dists.length} ta`);
  console.log(DRY ? "REJIM: --dry (yozilmaydi)\n" : "REJIM: YOZISH\n");

  let changedDocs = 0;
  let changedBlocks = 0;
  let untouchedDocs = 0;

  for (const dist of dists) {
    const label = `${String(dist._id)}  "${(dist.title || "").slice(0, 45)}"`;
    const teachers = dist.teachers || [];
    let docChanged = false;
    let blocksInDoc = 0;

    const nextTeachers = teachers.map((entry) => {
      const blocks = entry.blocks || [];
      const nextBlocks = blocks.map((block) => {
        if (Object.prototype.hasOwnProperty.call(block, "acceptanceStatus")) {
          return block;
        }
        docChanged = true;
        blocksInDoc += 1;
        return {
          ...block,
          acceptanceStatus: entry.acceptanceStatus ?? "pending",
          rejectionReason: entry.rejectionReason ?? null,
          respondedAt: entry.respondedAt ?? null,
        };
      });
      return { ...entry, blocks: nextBlocks };
    });

    if (!docChanged) {
      untouchedDocs += 1;
      continue;
    }

    console.log(`  O'ZGARADI  ${label} — ${blocksInDoc} ta blok to'ldiriladi`);
    changedDocs += 1;
    changedBlocks += blocksInDoc;

    if (!DRY) {
      await db
        .collection("workloaddistributions")
        .updateOne({ _id: dist._id }, { $set: { teachers: nextTeachers } });
    }
  }

  console.log(
    `\nXULOSA: o'zgaradi=${changedDocs} ta hujjat (${changedBlocks} ta blok)  tegilmadi=${untouchedDocs}`,
  );
  if (DRY && changedDocs > 0) {
    console.log("Yozish uchun `--dry` siz qayta ishga tushiring (avval zaxira!).");
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
