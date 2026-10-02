"use strict";

const mongoose = require("mongoose");
const AuditoriumHour = require("#references/auditoriumHour/auditoriumHour.model");
const Position = require("#references/position/position.model");

const DRY = process.argv.includes("--dry-run");
const TRAINEE_SLUG = "trainee";
const TRAINEE_TITLE = "Stajyor o'qituvchi";
const FALLBACK_FROM_SLUG = "assistant";

async function main() {
  const uri = process.env.MONGO_HOST;
  if (!uri) throw new Error("MONGO_HOST env topilmadi (dotenv)");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const log = (...a) => process.stdout.write(`${a.join(" ")}\n`);
  log(`[trainee-norma] ${DRY ? "DRY-RUN" : "APPLY"} → ${uri.replace(/\/\/.*@/, "//***@")}`);

  const normas = await AuditoriumHour.find({}).exec();
  for (const doc of normas) {
    const cats = doc.categories || [];
    if (cats.some((c) => c.slug === TRAINEE_SLUG)) {
      log(`  norma ${doc._id}: '${TRAINEE_SLUG}' allaqachon bor — o'tkazildi`);
      continue;
    }
    const envVal = Number(process.env.TRAINEE_AUDITORIUM_HOUR);
    const fallback = cats.find((c) => c.slug === FALLBACK_FROM_SLUG);
    const value = Number.isFinite(envVal) && envVal > 0
      ? envVal
      : Number(fallback?.value) || Number(doc.auditoriumHour) || 0;
    log(`  norma ${doc._id}: '${TRAINEE_SLUG}' qo'shiladi, value=${value}` +
      (Number.isFinite(envVal) && envVal > 0 ? " (env)" : ` (${fallback ? FALLBACK_FROM_SLUG : "umumiy"} dan)`));
    if (!DRY) {
      doc.categories.push({ slug: TRAINEE_SLUG, title: TRAINEE_TITLE, value });
      await doc.save();
    }
  }
  if (!normas.length) log("  ⚠️ auditoriumHour hujjati yo'q — kategoriya qo'shilmadi");

  const existing = await Position.findOne({ title: new RegExp(`^${TRAINEE_TITLE}$`, "i") }).exec();
  if (existing) {
    log(`  position '${existing.title}' allaqachon bor — o'tkazildi`);
  } else {
    const sample = await Position.findOne({ active: true }).sort({ date: -1 }).exec();
    const annualHours = Number(sample?.annualHours) || undefined;
    log(`  position '${TRAINEE_TITLE}' qo'shiladi (annualHours=${annualHours ?? "default"})`);
    if (!DRY) {
      await Position.create({ title: TRAINEE_TITLE, active: true, ...(annualHours ? { annualHours } : {}) });
    }
  }

  await mongoose.disconnect();
  log("[trainee-norma] tugadi");
}

main().catch((err) => {
  process.stderr.write(`[trainee-norma] XATO: ${err.message}\n`);
  process.exit(1);
});
