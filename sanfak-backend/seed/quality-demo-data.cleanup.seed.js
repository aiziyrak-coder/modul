#!/usr/bin/env node
"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const DEMO_DIVISION_TITLE = / — sifat bo'limi$/;

const log = (s = "") => process.stdout.write(`${s}\n`);

(async () => {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  log(`[DemoCleanup] ${WRITE ? "WRITE" : "DRY-RUN"}`);
  log("");

  const divisions = mongoose.connection.db.collection("divisions");
  const users = mongoose.connection.db.collection("users");
  const submissions = mongoose.connection.db.collection("indicatorsubmissions");

  const demoDivisions = await divisions.find({ title: DEMO_DIVISION_TITLE }).toArray();
  if (demoDivisions.length === 0) {
    log("  Demo bo'lim topilmadi — tozalashga hech narsa yo'q.");
    await mongoose.disconnect();
    return;
  }
  const divIds = demoDivisions.map((d) => d._id);
  log(`  Demo bo'lim: ${demoDivisions.length}`);
  demoDivisions.forEach((d) => log(`     ${d.title}`));

  const demoUsers = await users.find({ division: { $in: divIds } }).project({ _id: 1 }).toArray();
  const userIds = demoUsers.map((u) => u._id);
  log(`  Demo o'qituvchi: ${userIds.length}`);

  const subCount = await submissions.countDocuments({ teacher: { $in: userIds } });
  const keepCount = await submissions.countDocuments({ teacher: { $nin: userIds } });
  log("");
  log(`  O'chiriladigan yuborilma : ${subCount}`);
  log(`  Saqlanadigan yuborilma   : ${keepCount}`);

  if (!WRITE) {
    log("");
    log("  DRY-RUN — hech narsa o'chirilmadi. Qo'llash uchun: --write");
    await mongoose.disconnect();
    return;
  }

  const delSubs = await submissions.deleteMany({ teacher: { $in: userIds } });
  const unset = await users.updateMany({ division: { $in: divIds } }, { $unset: { division: "" } });
  const delDivs = await divisions.deleteMany({ _id: { $in: divIds } });

  log("");
  log(`  O'chirildi — yuborilma: ${delSubs.deletedCount}, bo'lim: ${delDivs.deletedCount}`);
  log(`  Biriktirma olib tashlandi: ${unset.modifiedCount} foydalanuvchida`);
  log(`  Qolgan yuborilma: ${await submissions.countDocuments({})}`);
  log(`  Indikatorlar (tegilmadi): ${await mongoose.connection.db.collection("indicators").countDocuments({})}`);

  await mongoose.disconnect();
})().catch((err) => {
  process.stderr.write(`[DemoCleanup] XATO: ${err.stack}\n`);
  process.exit(1);
});
