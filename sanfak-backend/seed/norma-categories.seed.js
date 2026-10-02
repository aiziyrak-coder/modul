"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const AuditoriumHour = require("../src/references/auditoriumHour/auditoriumHour.model");

const NORMA_CATEGORIES = [
  { slug: "professor", title: "Professor", value: 300 },
  { slug: "docent", title: "Dotsent", value: 350 },
  { slug: "senior_teacher", title: "Katta o'qituvchi", value: 380 },
  { slug: "assistant", title: "Assistent", value: 400 },
  { slug: "trainee", title: "Stajyor o'qituvchi", value: 400 },
];

function resolveWriteMode(argv) {
  const WRITE = argv.includes("--write");
  const DRY = !WRITE || argv.includes("--dry-run");
  return { WRITE, DRY };
}

function decideCategoryChanges(existing, canonical = NORMA_CATEGORIES) {
  const current = Array.isArray(existing) ? existing : [];
  const bySlug = new Map(current.map((c) => [c.slug, c]));
  const result = { create: [], update: [], unchanged: [], extra: [] };

  for (const want of canonical) {
    const have = bySlug.get(want.slug);
    if (!have) {
      result.create.push({ ...want });
      continue;
    }
    const changes = [];
    if (Number(have.value) !== Number(want.value)) {
      changes.push({ field: "value", old: have.value, new: want.value });
    }
    if (!have.title) {
      changes.push({ field: "title", old: have.title ?? null, new: want.title });
    }
    if (changes.length) result.update.push({ slug: want.slug, changes });
    else result.unchanged.push(want.slug);
  }

  const canonicalSlugs = new Set(canonical.map((c) => c.slug));
  for (const c of current) {
    if (!canonicalSlugs.has(c.slug)) result.extra.push({ slug: c.slug, value: c.value });
  }
  return result;
}

const formatChanges = (changes) =>
  changes.map((c) => `${c.field}=${JSON.stringify(c.old)}→${JSON.stringify(c.new)}`).join(", ");

async function seed() {
  const { DRY } = resolveWriteMode(process.argv);
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST env topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST, { serverSelectionTimeoutMS: 5000 });
  console.log(`[norma-categories] Connected${DRY ? "  [DRY-RUN — yozilmaydi]" : ""}`);

  const all = await AuditoriumHour.find({});
  const active = all.filter((d) => d.active);
  const inactive = all.length - active.length;
  console.log(`[norma-categories] DB'da ${all.length} ta norma yozuvi (active: ${active.length}, nofaol: ${inactive} — tegilmaydi)`);

  if (active.length > 1) {
    console.log(
      `  ⚠️  ${active.length} ta ACTIVE yozuv bor — runtime faqat eng yangisini oladi ` +
        "(`getActiveNorma`: active + date desc). Ortiqchasini admin UI'dan nofaol qiling.",
    );
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const doc of active) {
    const decision = decideCategoryChanges(doc.categories);
    console.log(`\n  norma ${doc._id} | umumiy baza: ${doc.auditoriumHour} | stavkalar: ${JSON.stringify(doc.allowedStakes ?? [])}`);

    for (const c of decision.create) {
      created++;
      console.log(`    ${DRY ? "+ [DRY] qo'shilardi" : "+ qo'shildi   "} ${c.slug.padEnd(15)} = ${c.value}`);
      if (!DRY) doc.categories.push({ slug: c.slug, title: c.title, value: c.value });
    }
    for (const u of decision.update) {
      updated++;
      console.log(`    ${DRY ? "~ [DRY] yangilanardi" : "~ yangilandi  "} ${u.slug.padEnd(15)} ${formatChanges(u.changes)}`);
      if (!DRY) {
        const target = doc.categories.find((c) => c.slug === u.slug);
        for (const ch of u.changes) target[ch.field] = ch.new;
      }
    }
    unchanged += decision.unchanged.length;
    if (decision.unchanged.length) {
      console.log(`    = o'zgarmadi   ${decision.unchanged.join(", ")}`);
    }
    for (const e of decision.extra) {
      console.log(`    ? ro'yxatda yo'q (TEGILMAYDI): ${e.slug} = ${e.value}`);
    }
    if (!DRY && (decision.create.length || decision.update.length)) await doc.save();
  }

  if (!active.length) {
    console.log("\n  ⚠️  ACTIVE norma yozuvi YO'Q — avval `yarn seed:refs` (§18) yoki admin UI'dan yarating.");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log(`  ${DRY ? "Qo'shilardi" : "Qo'shildi"}:   ${created}`);
  console.log(`  ${DRY ? "Yangilanardi" : "Yangilandi"}:  ${updated}`);
  console.log(`  O'zgarmadi:   ${unchanged}`);
  console.log(`  Active yozuv: ${active.length} / ${all.length}`);
  if (DRY) console.log("\n  ⚠️  DRY-RUN edi — bazaga hech narsa yozilmadi. Yozish uchun: --write");
  else console.log("\n  ℹ️  Norma keshi 60 s (`NORMA_TTL_MS`) — taqsimot ekranida bir daqiqadan keyin ko'rinadi.");
  console.log("═══════════════════════════════════════════\n");

  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch((err) => {
    console.error("[norma-categories] ERROR:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = { NORMA_CATEGORIES, resolveWriteMode, decideCategoryChanges };
