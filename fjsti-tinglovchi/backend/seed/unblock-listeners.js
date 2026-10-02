"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const PIN = process.argv[2] || null;
const URI = process.env.MONGO_HOST;
const DB = process.env.LISTENER_DB || "listener-db";

async function main() {
  if (!URI) throw new Error("MONGO_HOST (.env) sozlanmagan");
  if (PIN && !/^\d{14}$/.test(PIN)) throw new Error("PIN 14 ta raqam bo'lishi kerak");

  const conn = await mongoose.createConnection(URI).asPromise();
  const db = conn.useDb(DB, { useCache: true }).db;
  const col = db.collection("listeners");

  const filter = PIN ? { passport: PIN } : { active: false };
  const bloklangan = await col.countDocuments({ active: false });
  console.log(`Baza: ${db.databaseName}`);
  console.log(`Bloklangan yozuvlar: ${bloklangan}`);

  const res = await col.updateMany(filter, { $set: { active: true } });
  console.log(`Tiklandi: ${res.modifiedCount} ta`);

  console.log("");
  const docs = await col
    .find({})
    .project({ passport: 1, fullName: 1, active: 1 })
    .toArray();
  docs.forEach((d) =>
    console.log(
      `  ${String(d.passport).slice(0, 4)}****  ${String(d.fullName || "?").padEnd(30)} active:${d.active}`,
    ),
  );

  await conn.close();
}

main().catch((err) => {
  console.error("\n[UNBLOCK XATO]", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
