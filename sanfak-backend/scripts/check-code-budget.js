"use strict";

const fs = require("fs");
const path = require("path");

const BASELINE_PATH = path.join(__dirname, "code-budget.baseline.json");
const TARGET = "src";

const TRACKED = [
  "max-lines-per-function",
  "max-lines",
  "max-statements",
  "max-params",
  "max-depth",
  "complexity",
];

const line = "═".repeat(63);
const UPDATE = process.argv.includes("--update");
const FORCE = process.argv.includes("--force");

async function collect() {
  const { ESLint } = require("eslint");
  const eslint = new ESLint({ errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles([TARGET]);

  const counts = Object.fromEntries(TRACKED.map((r) => [r, 0]));
  const worst = Object.fromEntries(TRACKED.map((r) => [r, null]));

  for (const file of results) {
    for (const m of file.messages) {
      if (!TRACKED.includes(m.ruleId)) continue;
      counts[m.ruleId] += 1;
      const n = Number(
        (m.message.match(/\((\d+)\)/) || m.message.match(/of (\d+)/) || [])[1] || 0,
      );
      const cur = worst[m.ruleId];
      if (!cur || n > cur.value) {
        worst[m.ruleId] = {
          value: n,
          file: path.relative(process.cwd(), file.filePath).replace(/\\/g, "/"),
          line: m.line,
        };
      }
    }
  }
  return { counts, worst };
}

function readBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch (err) {
    console.error(`Baseline o'qilmadi: ${err.message}`);
    process.exit(2);
  }
  return null;
}

function writeBaseline(counts, worst) {
  const payload = {
    _yangilandi: new Date().toISOString().slice(0, 10),
    counts,
    eng_yirik: worst,
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

(async () => {
  let collected;
  try {
    collected = await collect();
  } catch (err) {
    console.error(`ESLint ishga tushmadi: ${err.message}`);
    process.exit(2);
  }
  const { counts, worst } = collected;
  const baseline = readBaseline();

  if (!baseline) {
    writeBaseline(counts, worst);
    console.log(line);
    console.log("BASELINE YARATILDI — joriy qarz muzlatildi:");
    for (const r of TRACKED) console.log(`  ${r.padEnd(24)} ${counts[r]}`);
    console.log(line);
    process.exit(0);
  }

  const base = baseline.counts || {};
  const oshgan = [];
  const kamaygan = [];
  for (const r of TRACKED) {
    const now = counts[r];
    const was = Number.isInteger(base[r]) ? base[r] : 0;
    if (now > was) oshgan.push({ r, was, now });
    else if (now < was) kamaygan.push({ r, was, now });
  }

  if (UPDATE) {
    if (oshgan.length && !FORCE) {
      console.error(line);
      console.error("BASELINE OSHIRILMADI — avval qarzni kamaytiring:");
      for (const o of oshgan) console.error(`  ${o.r.padEnd(24)} ${o.was} → ${o.now}`);
      console.error("Ongli qaror bo'lsa: --update --force");
      console.error(line);
      process.exit(1);
    }
    writeBaseline(counts, worst);
    console.log("Baseline yangilandi.");
    process.exit(0);
  }

  console.log(line);
  console.log("KOD HAJMI BYUDJETI");
  for (const r of TRACKED) {
    const was = Number.isInteger(base[r]) ? base[r] : 0;
    const now = counts[r];
    const belgi = now > was ? "✗" : now < was ? "↓" : "=";
    console.log(`  ${belgi} ${r.padEnd(24)} ${String(now).padStart(5)}  (baseline ${was})`);
  }

  if (oshgan.length) {
    console.error(line);
    console.error("YANGI QARZ QO'SHILDI — ruxsat etilmaydi:");
    for (const o of oshgan) {
      const w = worst[o.r];
      console.error(`  ${o.r}: ${o.was} → ${o.now}`);
      if (w) console.error(`      eng yirigi: ${w.value} (${w.file}:${w.line})`);
    }
    console.error("");
    console.error("Nima qilish kerak: yangi mantiqni kontrollerga emas, servisga yozing");
    console.error("(model → validatsiya → servis → kontroller → route), funksiyani bo'ling.");
    console.error(line);
    process.exit(1);
  }

  if (kamaygan.length) {
    console.log(line);
    console.log("Qarz kamaydi — baseline'ni yangilang:");
    for (const k of kamaygan) console.log(`  ↓ ${k.r}: ${k.was} → ${k.now}`);
    console.log("  node scripts/check-code-budget.js --update");
  }
  console.log(line);
  process.exit(0);
})();
