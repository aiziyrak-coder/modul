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
  const residents = mongoose.connection.collection("residents");
  const users = mongoose.connection.collection("users");

  log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}`);
  log(`  Baza:  ${mongoose.connection.name}\n`);

  const rows = await residents
    .find({
      $or: [
        { supervisor: { $ne: null } },
        { supervisorName: { $type: "string", $ne: "" } },
      ],
    })
    .project({ fullName: 1, supervisor: 1, supervisorName: 1 })
    .toArray();

  const plan = [];
  const skipped = [];
  let mismatched = 0;

  for (const d of rows) {
    const raw = d.supervisor;
    if (!raw || !mongoose.isValidObjectId(raw)) {
      skipped.push({
        resident: d.fullName,
        reason: `ustoz id yo'q yoki ObjectId emas: ${String(raw)}`,
      });
      continue;
    }
    const u = await users.findOne(
      { _id: new mongoose.Types.ObjectId(String(raw)) },
      { projection: { firstName: 1, lastName: 1, middleName: 1 } },
    );
    if (!u) {
      skipped.push({ resident: d.fullName, reason: `foydalanuvchi topilmadi: ${String(raw)}` });
      continue;
    }
    const next = composeFullName(u);
    if (!next) {
      skipped.push({ resident: d.fullName, reason: "foydalanuvchining ismi bo'sh" });
      continue;
    }
    const from = d.supervisorName ?? "";
    if (from === next) continue;

    const wordsOf = (v) =>
      new Set(v.toLowerCase().split(/\s+/).filter(Boolean));
    const a = wordsOf(from);
    const b = wordsOf(next);
    const subset = (x, y) => [...x].every((w) => y.has(w));
    const sameHuman = a.size > 0 && (subset(a, b) || subset(b, a));
    if (from && !sameHuman) mismatched += 1;

    plan.push({ _id: d._id, resident: d.fullName, from, to: next, sameHuman });
  }

  log(`  Ko'rildi:      ${rows.length}`);
  log(`  Yoziladi:      ${plan.length}`);
  log(`  Tegilmaydi:    ${skipped.length}`);
  log(`  🔴 BOSHQA ODAM: ${mismatched}  (formatlash emas — nom butunlay boshqa)\n`);

  for (const p of plan) {
    log(`    ${p.sameHuman || !p.from ? "·" : "🔴"} ${p.resident}`);
    log(`        "${p.from}"  ->  "${p.to}"`);
  }
  for (const s of skipped) log(`    ⏭  ${s.resident} — ${s.reason}`);

  if (WRITE && plan.length) {
    for (const p of plan) {
      await residents.updateOne({ _id: p._id }, { $set: { supervisorName: p.to } });
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
