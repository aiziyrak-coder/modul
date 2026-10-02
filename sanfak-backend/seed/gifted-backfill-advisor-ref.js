"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const log = (msg) => process.stdout.write(`${msg}\n`);

async function run() {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    log("  🔴 MONGO_HOST topilmadi — skript ISHGA TUSHMADI (zaxira ulanish yo'q)");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection("giftedstudents");

  log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}`);
  log(`  Baza:  ${mongoose.connection.name}\n`);

  const rows = await col
    .find({ advisorId: { $type: "string", $ne: "" }, advisor: null })
    .project({ fullName: 1, advisorId: 1 })
    .toArray();

  const plan = [];
  const skipped = [];
  for (const r of rows) {
    if (mongoose.isValidObjectId(r.advisorId)) {
      plan.push({ _id: r._id, advisor: new mongoose.Types.ObjectId(String(r.advisorId)) });
    } else {
      skipped.push({ who: r.fullName, advisorId: r.advisorId });
    }
  }

  log(`  ── Reja ──────────────────────────────────────────────────────────`);
  log(`     Bog'lanmagan yozuvlar : ${rows.length}`);
  log(`     Bog'lanadi            : ${plan.length}`);
  log(`     TEGILMAYDI (noaniq)   : ${skipped.length}`);

  if (skipped.length) {
    log("\n  ⚠️  Quyidagi `advisorId` ObjectId EMAS — satr tegilmaydi, ref null qoladi:");
    for (const s of skipped) log(`     ${s.who} — ${JSON.stringify(s.advisorId)}`);
    log("     (bular qo'lda tekshirilishi kerak — maslahatchi qayta biriktirilsin)");
  }

  if (!WRITE) {
    log("\n  Dry-run — hech narsa yozilmadi. Qo'llash uchun: --write\n");
    await mongoose.disconnect();
    return;
  }

  let written = 0;
  for (const p of plan) {
    const res = await col.updateOne({ _id: p._id }, { $set: { advisor: p.advisor } });
    written += res.modifiedCount;
  }

  log(`\n  ✅ Yozildi: ${written} ta yozuv`);

  const left = await col.countDocuments({
    advisorId: { $type: "string", $ne: "" },
    advisor: null,
  });
  log(`  Qolgan bog'lanmagan: ${left}${left ? " (yuqoridagi noaniqlar)" : ""}\n`);

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    process.stderr.write(`  🔴 Xato: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { run };
