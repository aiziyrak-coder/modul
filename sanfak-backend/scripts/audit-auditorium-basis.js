"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const {
  getActiveNorma,
  calcMinHour,
  calcEntryAuditoriumHour,
  OVERLOAD_MULTIPLIER,
} = require("#modules/4.02-studyLoad/_services/workloadValidator");

const STATUSES = ["draft", "new", "in_review", "approved", "rejected"];

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const emptyBucket = () => ({
  entries: 0,
  oldGreen: 0,
  newShort: 0,
  regression: 0,
  zeroAuditorium: 0,
  overloadOld: 0,
  overloadNew: 0,
});

async function main() {
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_HOST);
  const db = mongoose.connection.db;

  log();
  line("═");
  log("  MIN/MAX NORMA BAZASI DIAGNOSTIKASI (READ-ONLY)");
  log(`  Baza: ${mongoose.connection.name}`);
  line("═");

  const norma = await getActiveNorma();
  if (!norma) {
    log("\n⚠️  active=true bo'lgan AuditoriumHour normasi TOPILMADI.");
    log("   Bu holatda validator ham hech narsani tekshira olmaydi");
    log("   (severity: 'config'). Tahlil qilinmadi.");
    await mongoose.disconnect();
    return;
  }
  log(`\nNorma (active): umumiy fallback = ${norma.auditoriumHour}`);
  for (const c of norma.categories || []) {
    log(`   · ${c.slug} = ${c.value}`);
  }
  log(`Ortiqcha yuklama ko'paytuvchisi: ${OVERLOAD_MULTIPLIER}`);

  const dists = await db
    .collection("workloaddistributions")
    .find({})
    .project({ department: 1, status: 1, teachers: 1 })
    .toArray();

  const departments = await db
    .collection("departments")
    .find({}, { projection: { title: 1 } })
    .toArray();
  const deptTitle = new Map(
    departments.map((d) => [String(d._id), d.title || "—"]),
  );

  const total = emptyBucket();
  const byStatus = new Map(STATUSES.map((s) => [s, emptyBucket()]));
  const byDept = new Map();
  const unknownPosition = new Map();
  const worst = [];

  for (const dist of dists) {
    const status = dist.status || "(status yo'q)";
    if (!byStatus.has(status)) byStatus.set(status, emptyBucket());
    const sBucket = byStatus.get(status);

    const deptKey = String(dist.department || "—");
    if (!byDept.has(deptKey)) byDept.set(deptKey, emptyBucket());
    const dBucket = byDept.get(deptKey);

    for (const entry of dist.teachers || []) {
      if (entry.isVacant) continue;

      const minHour = calcMinHour(norma, entry.position, entry.stavka);
      const maxHour = Math.round(minHour * OVERLOAD_MULTIPLIER);
      const oldBasis = Number(entry.totalHour) || 0;
      const newBasis = calcEntryAuditoriumHour(entry);

      const hasCategory = (norma.categories || []).some(
        (c) => c.slug === entry.position,
      );
      if (!hasCategory) {
        const key = entry.position || "(bo'sh)";
        unknownPosition.set(key, (unknownPosition.get(key) || 0) + 1);
      }

      const oldGreen = oldBasis >= minHour;
      const newShort = newBasis < minHour;
      const regression = oldGreen && newShort;

      for (const b of [total, sBucket, dBucket]) {
        b.entries += 1;
        if (oldGreen) b.oldGreen += 1;
        if (newShort) b.newShort += 1;
        if (regression) b.regression += 1;
        if (newBasis === 0) b.zeroAuditorium += 1;
        if (oldBasis > maxHour) b.overloadOld += 1;
        if (newBasis > maxHour) b.overloadNew += 1;
      }

      if (regression) {
        worst.push({
          dist: dist._id,
          status,
          dept: deptTitle.get(deptKey) || deptKey,
          position: entry.position || "(bo'sh)",
          stavka: entry.stavka,
          minHour,
          oldBasis,
          newBasis,
          drop: oldBasis - newBasis,
        });
      }
    }
  }

  line();
  log(`\nJAMI taqsimot: ${dists.length}`);
  log(`Tahlil qilingan (vakant BO'LMAGAN) o'qituvchi yozuvi: ${total.entries}`);
  log(`   · eski baza (totalHour) bo'yicha yashil : ${total.oldGreen}`);
  log(`   · yangi baza (auditoriya) bo'yicha qizil: ${total.newShort}`);
  log(`   🔴 REGRESSIYA (eski yashil → yangi qizil): ${total.regression}`);
  log(`   · auditoriya = 0 bo'lgan yozuv (eski/fallback bloklar): ${total.zeroAuditorium}`);
  log(`   · ortiqcha yuklama (eski baza / yangi baza): ${total.overloadOld} / ${total.overloadNew}`);

  log("\nSTATUS KESIMIDA");
  for (const [status, b] of byStatus) {
    if (b.entries === 0) {
      log(`   · ${status.padEnd(11)} yozuv yo'q`);
      continue;
    }
    log(
      `   · ${status.padEnd(11)} yozuv=${b.entries}  eski-yashil=${b.oldGreen}  ` +
        `yangi-qizil=${b.newShort}  REGRESSIYA=${b.regression}  aud=0 → ${b.zeroAuditorium}`,
    );
  }

  log("\nKAFEDRA KESIMIDA (regressiya bo'yicha kamayish tartibida)");
  const deptRows = [...byDept.entries()].sort(
    (a, b) => b[1].regression - a[1].regression || b[1].entries - a[1].entries,
  );
  if (deptRows.length === 0) {
    log("   — yo'q");
  }
  for (const [key, b] of deptRows) {
    log(
      `   · ${(deptTitle.get(key) || key).padEnd(38)} ` +
        `yozuv=${b.entries}  eski-yashil=${b.oldGreen}  ` +
        `yangi-qizil=${b.newShort}  REGRESSIYA=${b.regression}`,
    );
  }

  if (unknownPosition.size > 0) {
    log(
      `\n⚠️  Lavozimi norma categories[] da TOPILMAGAN yozuvlar ` +
        `(fallback ${norma.auditoriumHour} soatga tushadi — bu qoidadan ` +
        `OLDIN ham shunday edi):`,
    );
    for (const [slug, n] of [...unknownPosition.entries()].sort(
      (a, b) => b[1] - a[1],
    )) {
      log(`   · ${slug} → ${n} ta yozuv`);
    }
  }

  if (worst.length > 0) {
    log("\nENG KATTA FARQLI 15 YOZUV (namuna — qo'lda tekshirish uchun)");
    worst
      .sort((a, b) => b.drop - a.drop)
      .slice(0, 15)
      .forEach((w) => {
        log(
          `   · ${w.dist} [${w.status}] ${w.dept} · ${w.position} ×${w.stavka} · ` +
            `min=${w.minHour} · jami=${w.oldBasis} → auditoriya=${w.newBasis} ` +
            `(farq ${w.drop})`,
        );
      });
  }

  line("═");
  log(
    `\nXULOSA: ${total.regression} ta o'qituvchi yozuvi eski baza bo'yicha ` +
      `"yashil" edi, yangi (auditoriya) baza bo'yicha "me'yorga yetmagan" ` +
      `bo'ladi. Ular orasidan ${byStatus.get("draft")?.regression ?? 0} tasi ` +
      `\`draft\` (submit bloklanadi), qolganlari allaqachon zanjirga ` +
      `kirgan/tasdiqlangan hujjatlarda (ular qayta submit qilinmasa ` +
      `bloklanmaydi). Bu skript HECH NARSA YOZMADI.`,
  );
  line("═");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Diagnostika xatosi:", err.message);
  process.exit(1);
});
