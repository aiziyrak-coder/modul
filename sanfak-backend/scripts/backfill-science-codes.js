"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const WRITE = process.argv.includes("--write");
const DRY = !WRITE;

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/, "")
    .trim();

const NON_SUBJECT_CODE_PREFIX = ["MM", "TM", "ICHM", "BOM", "BAKYDA"];
const isNonSubject = (code, title) => {
  const t = norm(title);
  if (!code) return true;
  if (t === "jami" || t === "hammasi") return true;
  return NON_SUBJECT_CODE_PREFIX.some((p) => String(code).startsWith(p));
};

async function main() {
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  log();
  line("═");
  log(`  FAN KODLARINI TO'LDIRISH — rejim: ${DRY ? "DRY-RUN (yozilmaydi)" : "WRITE (yoziladi)"}`);
  log(`  Baza: ${mongoose.connection.name}`);
  line("═");

  const studyPlans = await db.collection("studyplans").find({}).toArray();
  const planSubjects = new Map();
  let rowCount = 0;

  for (const sp of studyPlans) {
    for (const block of sp.blocks || []) {
      for (const el of block.sciences || []) {
        if (!el.code && !el.title) continue;
        rowCount += 1;
        const key = norm(el.title);
        if (!planSubjects.has(key)) {
          planSubjects.set(key, { code: el.code || null, title: el.title || null });
        }
      }
    }
  }

  log(`\n1) O'quv rejalar: ${studyPlans.length} ta hujjat, ${rowCount} ta fan qatori`);
  log(`   Noyob fan (nom bo'yicha): ${planSubjects.size}`);

  const sciences = await db.collection("sciences").find({}).toArray();
  const byTitle = new Map();
  const usedCodes = new Map();

  for (const sc of sciences) {
    byTitle.set(norm(sc.title), sc);
    if (sc.scienceCode) usedCodes.set(String(sc.scienceCode), sc);
  }

  log(`2) Katalog (sciences): ${sciences.length} ta`);
  log(`   `.padEnd(3) + `scienceCode to'ldirilgan: ${usedCodes.size}`);

  const toFill = [];
  const already = [];
  const conflicts = [];
  const needDecision = [];
  const nonSubjects = [];

  for (const [key, subj] of planSubjects) {
    const cat = byTitle.get(key);

    if (!cat) {
      (isNonSubject(subj.code, subj.title) ? nonSubjects : needDecision).push(subj);
      continue;
    }
    if (!subj.code) {
      nonSubjects.push({ ...subj, note: "kodsiz qator" });
      continue;
    }

    const current = cat.scienceCode ? String(cat.scienceCode) : "";
    if (current === String(subj.code)) {
      already.push({ subj, cat });
      continue;
    }
    if (current) {
      conflicts.push({
        subj,
        cat,
        reason: `katalogda boshqa kod turibdi: "${current}"`,
      });
      continue;
    }
    const owner = usedCodes.get(String(subj.code));
    if (owner && String(owner._id) !== String(cat._id)) {
      conflicts.push({
        subj,
        cat,
        reason: `bu kod boshqa fanga biriktirilgan: "${owner.title}"`,
      });
      continue;
    }
    toFill.push({ subj, cat });
  }

  log();
  line();
  log(`  ✅ TO'LDIRILADI (katalogda bor, kodi bo'sh): ${toFill.length}`);
  line();
  for (const { subj, cat } of toFill) {
    const dep = cat.department ? "kafedra: bor" : "⚠ KAFEDRA YO'Q";
    log(`   ${String(subj.code).padEnd(12)} → ${String(cat.title).slice(0, 45).padEnd(47)} ${dep}`);
  }

  if (already.length) {
    log();
    line();
    log(`  ⏭  ALLAQACHON TO'G'RI (o'tkazildi): ${already.length}`);
    line();
    for (const { subj, cat } of already) {
      log(`   ${String(subj.code).padEnd(12)} → ${String(cat.title).slice(0, 45)}`);
    }
  }

  if (conflicts.length) {
    log();
    line();
    log(`  🔴 ZIDDIYAT — TEGILMAYDI (qo'lda hal qilinadi): ${conflicts.length}`);
    line();
    for (const { subj, cat, reason } of conflicts) {
      log(`   ${String(subj.code).padEnd(12)} → ${String(cat.title).slice(0, 40)}`);
      log(`   ${" ".repeat(12)}   ${reason}`);
    }
  }

  log();
  line();
  log(`  ❓ QAROR KERAK — katalogda YO'Q, kafedra noma'lum: ${needDecision.length}`);
  log(`     (skript yaratmaydi: qaysi kafedra o'qitishini institut belgilaydi)`);
  line();
  for (const s of needDecision) {
    log(`   ${String(s.code).padEnd(12)} | ${s.title}`);
  }

  log();
  line();
  log(`  ℹ️  FAN EMAS — amaliyot / attestatsiya / jamlama qatorlar: ${nonSubjects.length}`);
  log(`     (bularga fan yaratish noto'g'ri bo'lardi)`);
  line();
  for (const s of nonSubjects) {
    log(`   ${String(s.code ?? "—").padEnd(12)} | ${s.title ?? "—"}${s.note ? ` (${s.note})` : ""}`);
  }

  log();
  line("═");
  if (DRY) {
    log(`  DRY-RUN — hech narsa yozilmadi.`);
    log(`  Yozish uchun: node scripts/backfill-science-codes.js --write`);
  } else {
    let written = 0;
    for (const { subj, cat } of toFill) {
      const r = await db
        .collection("sciences")
        .updateOne({ _id: cat._id }, { $set: { scienceCode: String(subj.code) } });
      if (r.modifiedCount) written += 1;
    }
    log(`  YOZILDI: ${written} ta fanga scienceCode qo'shildi.`);
  }
  log(`  Xulosa: to'ldiriladi ${toFill.length} · allaqachon ${already.length} · ziddiyat ${conflicts.length} · qaror kerak ${needDecision.length} · fan emas ${nonSubjects.length}`);
  line("═");
  log();

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("XATO:", err.message);
  process.exit(1);
});
