"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { normalizeTitle } = require("#references/_services/academicYearResolver");

const WRITE = process.argv.includes("--write");

const log = (m) => console.log(m);

async function main() {
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  await mongoose.connect(process.env.MONGO_HOST);
  log(`\n  DB: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
  log(`  Rejim: ${WRITE ? "--write (YOZADI)" : "dry-run (hech narsa yozilmaydi)"}\n`);

  const rows = await AcademicYear.find({}).select("title active").lean();
  if (!rows.length) {
    log("  Ma'lumotnoma bo'sh — qiladigan ish yo'q.\n");
    return;
  }

  const plan = [];
  for (const r of rows) {
    const canonical = normalizeTitle(r.title);
    if (canonical === null) plan.push({ row: r, kind: "unparsable" });
    else if (canonical === r.title) plan.push({ row: r, kind: "ok" });
    else plan.push({ row: r, kind: "rename", to: canonical });
  }

  const byCanonical = new Map();
  for (const p of plan) {
    if (p.kind === "unparsable") continue;
    const key = p.to ?? p.row.title;
    if (!byCanonical.has(key)) byCanonical.set(key, []);
    byCanonical.get(key).push(p);
  }
  const collisions = [...byCanonical.entries()].filter(([, ps]) => ps.length > 1);

  log("  ── Reja ──────────────────────────────────────────────────────────");
  for (const p of plan) {
    const flag = p.row.active === false ? " (nofaol)" : "";
    if (p.kind === "ok") log(`     ✓  ${p.row.title}${flag} — allaqachon kanonik`);
    else if (p.kind === "rename") log(`     →  ${p.row.title}${flag}  ⟶  ${p.to}`);
    else log(`     ✗  ${JSON.stringify(p.row.title)}${flag} — TAHLIL QILIB BO'LMADI`);
  }

  const renames = plan.filter((p) => p.kind === "rename");
  const unparsable = plan.filter((p) => p.kind === "unparsable");
  log("");
  log(`  Jami ${rows.length} qator · kanonik ${plan.length - renames.length - unparsable.length}` +
      ` · o'zgartiriladi ${renames.length} · tahlil qilib bo'lmadi ${unparsable.length}`);

  if (collisions.length) {
    log("\n  🔴 TO'QNASHUV — yozilmadi. Quyidagi qatorlar bir xil kanonik sarlavhaga tushadi:");
    for (const [key, ps] of collisions) {
      log(`     ${key}  ←  ${ps.map((p) => JSON.stringify(p.row.title)).join(", ")}`);
    }
    log("     `title` UNIQUE — birlashtirish qarori odamniki (ikkala qatorga ham");
    log("     `ref` osilgan bo'lishi mumkin). Avval dublikatni qo'lda hal qiling.\n");
    process.exitCode = 1;
    return;
  }

  if (unparsable.length) {
    log("\n  ⚠️  Yuqoridagi ✗ qatorlar TEGILMAYDI — `normalizeTitle` ularni tanimadi.");
  }

  if (!renames.length) {
    log("\n  Qiladigan ish yo'q — barcha sarlavhalar kanonik.\n");
    return;
  }

  if (!WRITE) {
    log("\n  Dry-run — hech narsa yozilmadi. Qo'llash uchun: --write\n");
    return;
  }

  let done = 0;
  for (const p of renames) {
    await AcademicYear.updateOne(
      { _id: p.row._id },
      { $set: { title: p.to } },
      { runValidators: true },
    );
    done++;
  }
  log(`\n  ✅ ${done} qator normallashtirildi.`);

  const after = await AcademicYear.find({}).select("title").lean();
  log(`  Hozirgi holat: ${after.map((a) => a.title).join(", ")}\n`);
}

main()
  .catch((err) => {
    console.error(`\n  ❌ ${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
