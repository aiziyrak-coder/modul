"use strict";

const fs = require("fs");
const path = require("path");

const { MODULES } = require("../src/config/constants");
const { scanFiles } = require("./permit-scan");

const BE = path.resolve(__dirname, "..");
const IMPORTS = require("../package.json").imports || {};

const rel = (f) => path.relative(BE, f).split(path.sep).join("/");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "node_modules") walk(p, out);
    } else if (e.name.endsWith(".js") && !e.name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

function resolveRequire(spec, fromFile) {
  for (const [alias, tpl] of Object.entries(IMPORTS)) {
    if (!alias.endsWith("*")) continue;
    const prefix = alias.slice(0, -1);
    if (spec.startsWith(prefix)) {
      return tpl.replace("*", spec.slice(prefix.length)).replace(/^\.\//, "");
    }
  }
  if (spec.startsWith(".")) {
    const abs = path.resolve(path.dirname(path.join(BE, fromFile)), spec);
    return rel(abs.endsWith(".js") ? abs : `${abs}.js`);
  }
  return null;
}

function buildCallerGraph(entries) {
  const callersOf = new Map();
  for (const e of entries) {
    for (const m of e.text.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
      const target = resolveRequire(m[1], e.file);
      if (!target) continue;
      if (!callersOf.has(target)) callersOf.set(target, new Set());
      callersOf.get(target).add(e.file);
    }
  }
  return callersOf;
}

function collectRequirements(root = path.join(BE, "src")) {
  const entries = walk(root).map((f) => ({ file: rel(f), text: fs.readFileSync(f, "utf8") }));
  return { entries, ...scanFiles(entries, buildCallerGraph(entries)) };
}

async function run() {
  require("dotenv").config({ path: path.join(BE, ".env") });
  const mongoose = require("mongoose");

  const { requirements, unresolved, warnings, stats } = collectRequirements();

  await mongoose.connect(process.env.MONGO_HOST, { serverSelectionTimeoutMS: 5000 });
  const db = mongoose.connection.db;
  const cat = await db
    .collection("permissions")
    .find({})
    .project({ section: 1, actionKeys: 1, groups: 1 })
    .toArray();
  const catMap = new Map(cat.map((c) => [c.section, c]));

  const missingSection = new Map();
  const missingAction = new Map();
  for (const [k, srcs] of requirements) {
    const i = k.lastIndexOf(":");
    const sec = k.slice(0, i);
    const act = k.slice(i + 1);
    const c = catMap.get(sec);
    if (!c) {
      if (!missingSection.has(sec)) missingSection.set(sec, new Set());
      [...srcs].forEach((s) => missingSection.get(sec).add(s));
      continue;
    }
    if (!(c.actionKeys || []).includes(act)) missingAction.set(k, [...srcs]);
  }
  const ungrouped = cat.filter((c) => !c.groups || c.groups.length === 0);

  console.log("=== RBAC KATALOG DRIFT ===");
  console.log(
    `permit() chaqiruvlari: ${stats.codeCalls}` +
      ` (literal ${stats.literal} · alias ${stats.alias} · fabrika ${stats.factory}` +
      ` · action-massivsiz ${stats.noActionArray})`,
  );
  const byKind = Object.entries(stats.nonCodeByKind)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
  console.log(`izoh/satr ichidagi "permit(" (gate EMAS): ${stats.inNonCode}` + (byKind ? `  [${byKind}]` : ""));
  console.log("Talab qilinadigan noyob section:action: " + requirements.size);
  console.log("constants.MODULES: " + Object.keys(MODULES).length + " | katalog: " + cat.length);

  console.log("\n[X] SECTION katalogda YO'Q (" + missingSection.size + "):");
  for (const [s, srcs] of missingSection) {
    console.log("   " + s + "  <-  " + [...srcs].slice(0, 2).join(", "));
  }

  console.log("\n[X] ACTION katalogda YO'Q (" + missingAction.size + "):");
  for (const [k, srcs] of [...missingAction].sort()) {
    console.log("   " + k + "  <-  " + srcs.slice(0, 2).join(", "));
  }

  console.log("\n[X] YECHILMAGAN permit() (" + unresolved.length + "):");
  for (const u of unresolved) console.log(`   ${u.where}  ${u.reason}  ->  ${u.text}`);

  console.log("\n[!] GURUHSIZ (admin UI chizmaydi) (" + ungrouped.length + "):");
  ungrouped.forEach((c) => console.log("   " + c.section));

  if (warnings.length) {
    console.log("\n[~] OGOHLANTIRISH:");
    warnings.forEach((w) => console.log("   " + w));
  }

  const bad =
    missingSection.size +
    missingAction.size +
    unresolved.length +
    ungrouped.length;
  console.log("\n" + (bad === 0 ? "OK - DRIFT YO'Q" : "JAMI MUAMMO: " + bad));
  await mongoose.disconnect();
  process.exit(bad === 0 ? 0 : 1);
}

if (require.main === module) {
  run().catch((e) => {
    console.error("XATO:", e.message);
    process.exit(2);
  });
}

module.exports = { walk, rel, resolveRequire, buildCallerGraph, collectRequirements };
