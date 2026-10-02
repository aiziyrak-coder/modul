"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const log = (msg) => process.stdout.write(`${msg}\n`);

const composeFullName = (u) =>
  [u?.lastName, u?.firstName, u?.middleName]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ");

async function run() {
  const uri = process.env.MONGO_HOST;
  if (!uri) {
    log("  🔴 MONGO_HOST topilmadi — skript ISHGA TUSHMADI (zaxira ulanish yo'q)");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(uri);
  const students = mongoose.connection.collection("giftedstudents");
  const users = mongoose.connection.collection("users");

  log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}`);
  log(`  Baza:  ${mongoose.connection.name}\n`);

  const rows = await students
    .find({ $or: [{ advisor: { $ne: null } }, { advisorId: { $type: "string", $ne: "" } }] })
    .project({ fullName: 1, advisor: 1, advisorId: 1, advisorName: 1 })
    .toArray();

  const plan = [];
  const skipped = [];

  for (const d of rows) {
    const raw = d.advisor ?? d.advisorId;
    if (!raw || !mongoose.isValidObjectId(raw)) {
      skipped.push({ student: d.fullName, reason: `id ObjectId emas: ${String(raw)}` });
      continue;
    }
    const u = await users
      .findOne({ _id: new mongoose.Types.ObjectId(String(raw)) }, { projection: { firstName: 1, lastName: 1, middleName: 1 } });
    if (!u) {
      skipped.push({ student: d.fullName, reason: `foydalanuvchi topilmadi: ${String(raw)}` });
      continue;
    }
    const next = composeFullName(u);
    if (!next) {
      skipped.push({ student: d.fullName, reason: "foydalanuvchining ismi bo'sh" });
      continue;
    }
    if ((d.advisorName ?? "") === next) continue;
    plan.push({ _id: d._id, student: d.fullName, from: d.advisorName ?? "", to: next });
  }

  log(`  Ko'rildi:      ${rows.length}`);
  log(`  Yoziladi:      ${plan.length}`);
  log(`  Tegilmaydi:    ${skipped.length}\n`);

  for (const p of plan) {
    log(`    · ${p.student}`);
    log(`        "${p.from}"  ->  "${p.to}"`);
  }
  for (const s of skipped) log(`    ⏭  ${s.student} — ${s.reason}`);

  if (WRITE && plan.length) {
    for (const p of plan) {
      await students.updateOne({ _id: p._id }, { $set: { advisorName: p.to } });
    }
    log(`\n  ✅ ${plan.length} ta yozuv yangilandi`);
  } else if (!WRITE && plan.length) {
    log("\n  ℹ️  Dry-run — yozish uchun `--write` bering");
  }

  await mongoose.disconnect();
}

if (require.main === module) {
  run().catch((err) => {
    log(`  🔴 XATO: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { composeFullName };
