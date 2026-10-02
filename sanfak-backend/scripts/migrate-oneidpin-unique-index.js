"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const DRY = !WRITE;

const INDEX_NAME = "oneIdPin_unique_partial";
const INDEX_SPEC = { oneIdPin: 1 };
const INDEX_OPTIONS = {
  unique: true,
  partialFilterExpression: { oneIdPin: { $type: "string" } },
  name: INDEX_NAME,
};

const log = (...a) => console.log(...a);
const err = (...a) => console.error("✗", ...a);

async function findDuplicates(usersColl) {
  return usersColl
    .aggregate([
      { $match: { oneIdPin: { $type: "string" } } },
      { $group: { _id: "$oneIdPin", count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();
}

async function main() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");

  log(`\n═══ oneIdPin unique index migratsiyasi ═══${DRY ? "  [DRY-RUN]" : "  [WRITE]"}`);

  await mongoose.connect(process.env.MONGO_HOST);
  log(`✓ Ulanishildi: ${process.env.MONGO_HOST}`);
  const usersColl = mongoose.connection.db.collection("users");

  const before = await usersColl.indexes();
  log(`\nMavjud indekslar (${before.length}):`);
  before.forEach((i) => log(`  - ${i.name}: ${JSON.stringify(i.key)}`));

  const duplicates = await findDuplicates(usersColl);

  if (duplicates.length > 0) {
    err(`${duplicates.length} ta dublikat oneIdPin topildi — indeks YARATILMAYDI:`);
    duplicates.forEach((d) => {
      err(`  PIN="${d._id}" → ${d.count} ta user: ${d.ids.map(String).join(", ")}`);
    });
    err(
      "\nDublikatni bu skript hal QILMAYDI — mahsulot qarori kerak (qaysi hisob to'g'ri?). " +
        "Hal qilingach skriptni qayta ishga tushiring.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  log("\n✓ Dublikat topilmadi — barcha oneIdPin qiymatlari unikal.");

  const alreadyExists = before.some((i) => i.name === INDEX_NAME);
  if (alreadyExists) {
    log(`\n✓ "${INDEX_NAME}" indeksi allaqachon mavjud — o'zgarish yo'q.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  if (DRY) {
    log(
      `\n[DRY-RUN] Yaratiladigan indeks: ${INDEX_NAME} ${JSON.stringify(INDEX_SPEC)} ${JSON.stringify(
        INDEX_OPTIONS,
      )}`,
    );
    log("Hech narsa yozilmadi. Haqiqiy yaratish uchun: --write");
    await mongoose.disconnect();
    process.exit(0);
  }

  const createdName = await usersColl.createIndex(INDEX_SPEC, INDEX_OPTIONS);
  log(`\n✓ Indeks yaratildi: ${createdName}`);

  const after = await usersColl.indexes();
  log(`\nYangi indekslar ro'yxati (${after.length}):`);
  after.forEach((i) => log(`  - ${i.name}: ${JSON.stringify(i.key)}`));

  await mongoose.disconnect();
  log("\n✓ Tayyor.");
}

main().catch((e) => {
  err("Migratsiya xatosi:", e.message);
  console.error(e);
  process.exit(1);
});
