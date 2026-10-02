"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");

function slotOf(title = "") {
  const t = String(title).toLowerCase();
  if (/pasport|passport/.test(t)) return "passport";
  if (/diplom|shahodatnoma|attestat|certificate.*diplom/.test(t)) return "diploma";
  if (/sertifikat|certificate/.test(t)) return "certificate";
  return null;
}

async function main() {
  await mongoose.connect(process.env.MONGO_HOST);
  const col = mongoose.connection.db.collection("applicants");

  const docs = await col.find({ documents: { $type: "array" } }).toArray();
  console.log(`Massiv documents topildi: ${docs.length} ta ariza`);

  let updated = 0;
  for (const d of docs) {
    const arr = Array.isArray(d.documents) ? d.documents : [];
    const out = {};
    const order = ["passport", "diploma", "certificate"];
    for (const item of arr) {
      if (!item || !item.fileUrl) continue;
      let slot = slotOf(item.title);
      if (!slot || out[slot]) slot = order.find((s) => !out[s]);
      if (!slot) continue;
      out[slot] = {
        fileUrl: item.fileUrl,
        fileName: item.fileName,
        fileSize: item.fileSize,
        uploadedAt: item.uploadedAt || new Date(),
        verified: !!item.verified,
      };
    }
    await col.updateOne({ _id: d._id }, { $set: { documents: out } });
    updated++;
    console.log(`  ~ ${d.applicationNumber}: ${arr.length} fayl → { ${Object.keys(out).join(", ")} }`);
  }

  console.log(`\n✓ Migratsiya tugadi: ${updated} ta ariza yangilandi`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("\n[MIGRATSIYA XATO]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
