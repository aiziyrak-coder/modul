"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const PAD_REG = 6;
const DRY = process.argv.includes("--dry");

function pad(n) {
  return String(n).padStart(PAD_REG, "0");
}

async function findDuplicates(col) {
  const byNumber = await col
    .aggregate([
      { $match: { kind: 1, number: { $type: "string" } } },
      { $group: { _id: { t: "$template", n: "$number" }, c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ])
    .toArray();
  const byReg = await col
    .aggregate([
      { $match: { regNumber: { $type: "string" } } },
      { $group: { _id: "$regNumber", c: { $sum: 1 } } },
      { $match: { c: { $gt: 1 } } },
    ])
    .toArray();
  return { byNumber, byReg };
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  const col = mongoose.connection.db.collection("qualearnedcertificates");

  const dup = await findDuplicates(col);
  if (dup.byNumber.length || dup.byReg.length) {
    console.log("[QualCertRegNumber] ⚠ TAKRORIY RAQAMLAR TOPILDI");
    dup.byNumber.forEach((d) =>
      console.log("   seriya " + d._id.t + " raqam " + d._id.n + " — " + d.c + " ta yozuv"),
    );
    dup.byReg.forEach((d) =>
      console.log("   qayd raqami " + d._id + " — " + d.c + " ta yozuv"),
    );
    console.log("   Sabab: eski kodda raqam `countDocuments + 1` bilan berilardi —");
    console.log("   ikki sertifikat bir vaqtda yaratilsa bir xil raqam olardi.");
    console.log("   Oqibat: unikal indeks QURILMAYDI.");
    console.log("   Takrorlarni qo'lda tuzatib, seedni qayta ishga tushiring —");
    console.log("   bu seed ularni O'ZI o'zgartirmaydi (xavfli).");
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  const [last] = await col
    .find({ regNumber: { $type: "string" } })
    .sort({ regNumber: -1 })
    .limit(1)
    .toArray();
  let next = Number(last && last.regNumber ? last.regNumber : 0) + 1;

  const missing = await col
    .find({ kind: 1, regNumber: { $exists: false } })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();

  console.log("[QualCertRegNumber] " + (DRY ? "DRY-RUN — yozilmaydi" : "qo'llanmoqda"));
  console.log("  raqamsiz sertifikatlar :", missing.length);
  console.log("  keyingi raqam          :", pad(next));

  let done = 0;
  for (const cert of missing) {
    const regNumber = pad(next);
    console.log(
      "   " + String(cert._id) + "  seriya=" + (cert.number || "-") + "  ->  " + regNumber,
    );
    if (!DRY) {
      await col.updateOne({ _id: cert._id }, { $set: { regNumber } });
      done += 1;
    }
    next += 1;
  }

  const total = await col.countDocuments({ kind: 1 });
  const withReg = await col.countDocuments({
    kind: 1,
    regNumber: { $type: "string" },
  });
  console.log("  yangilandi             :", DRY ? 0 : done);
  console.log("  raqamli / jami         :", withReg + " / " + total);
  if (!DRY && withReg !== total) {
    console.log("  DIQQAT: hamma sertifikatda raqam yo'q — yuqoridagi ro'yxatni tekshiring");
  }

  await mongoose.disconnect();
}

module.exports = { pad };

if (require.main === module) {
  main().catch((err) => {
    console.error("[QualCertRegNumber] XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}
