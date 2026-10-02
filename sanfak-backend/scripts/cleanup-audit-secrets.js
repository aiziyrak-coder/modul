"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const AuditLog = require("../src/system/_shared/auditLog.model");

const APPLY = process.argv.includes("--apply");

const isOpen = (value) => typeof value === "string" && value && value !== "***";

async function run() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  console.log("✓ MongoDB ulandi");
  console.log(
    `Rejim: ${APPLY ? "APPLY (o'zgarishlar YOZILADI)" : "DRY-RUN (hech narsa yozilmaydi)"}\n`,
  );

  const filter = {
    $or: [
      { "requestBody.oneIdPin": { $exists: true } },
      { "requestBody.refreshToken": { $exists: true } },
    ],
  };

  const docs = await AuditLog.find(filter, {
    "requestBody.oneIdPin": 1,
    "requestBody.refreshToken": 1,
  }).lean();

  const pinDocs = docs.filter((d) => isOpen(d.requestBody?.oneIdPin));
  const tokenDocs = docs.filter((d) => isOpen(d.requestBody?.refreshToken));

  console.log(`Tekshirilgan yozuvlar (maydon mavjud): ${docs.length}`);
  console.log(`  - ochiq oneIdPin: ${pinDocs.length}`);
  console.log(`  - ochiq refreshToken: ${tokenDocs.length}`);

  const toClean = docs.filter(
    (d) => isOpen(d.requestBody?.oneIdPin) || isOpen(d.requestBody?.refreshToken),
  );

  if (!toClean.length) {
    console.log("\nTozalanadigan yozuv topilmadi.");
    await mongoose.disconnect();
    return;
  }

  if (!APPLY) {
    console.log(
      `\nDRY-RUN — ${toClean.length} yozuv tozalanadi (hech narsa yozilmadi). ` +
        "Yozish uchun: node scripts/cleanup-audit-secrets.js --apply",
    );
    await mongoose.disconnect();
    return;
  }

  const ops = toClean.map((d) => {
    const set = {};
    if (isOpen(d.requestBody?.oneIdPin)) set["requestBody.oneIdPin"] = "***";
    if (isOpen(d.requestBody?.refreshToken)) set["requestBody.refreshToken"] = "***";
    return { updateOne: { filter: { _id: d._id }, update: { $set: set } } };
  });

  const result = await AuditLog.bulkWrite(ops);
  console.log(`\n✓ APPLY — ${result.modifiedCount} yozuv yangilandi.`);

  await mongoose.disconnect();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Cleanup XATO:", err.message);
    console.error(err.stack);
    process.exit(1);
  });
