const fs = require("fs");
const path = require("path");

const BE_ROOT = path.resolve(__dirname, "..");
const CONSTANTS = path.join(BE_ROOT, "src", "config", "constants.js");

const outIdx = process.argv.indexOf("--out");
const OUT =
  outIdx !== -1 && process.argv[outIdx + 1]
    ? path.resolve(process.argv[outIdx + 1])
    : path.resolve(
        BE_ROOT,
        "..",
        "frontend",
        "src",
        "app",
        "modules",
        "backend-permission-catalog.json",
      );

const CHECK_ONLY = process.argv.includes("--check");
const line = "═".repeat(63);

function extractBlockValues(src, blockName) {
  const noComments = src.replace(/\/\/[^\n]*/g, "");
  const start = noComments.indexOf(`${blockName}:`);
  if (start === -1) return [];
  const braceStart = noComments.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < noComments.length; i++) {
    if (noComments[i] === "{") depth++;
    else if (noComments[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = noComments.slice(braceStart, end);
  const values = new Set();
  for (const m of block.matchAll(/["']([^"'\n]+)["']/g)) {
    if (m[1]) values.add(m[1]);
  }
  return [...values].sort();
}

function build() {
  if (!fs.existsSync(CONSTANTS)) {
    console.error(`XATO: constants.js topilmadi: ${CONSTANTS}`);
    process.exit(2);
  }
  const src = fs.readFileSync(CONSTANTS, "utf8");
  const modules = extractBlockValues(src, "MODULES");
  const actions = extractBlockValues(src, "ACTIONS");

  if (modules.length === 0 || actions.length === 0) {
    console.error(
      `XATO: katalog bo'sh chiqdi (MODULES=${modules.length}, ACTIONS=${actions.length}).\n` +
        `constants.js tuzilishi o'zgargan bo'lishi mumkin — generator yangilanishi kerak.\n` +
        `Bo'sh artefakt YOZILMAYDI: u FE testini soxta yashil qilardi.`,
    );
    process.exit(2);
  }
  return { modules, actions };
}

function main() {
  const { modules, actions } = build();

  const artifact = {
    source: "sanfak_backend/src/config/constants.js",
    modules,
    actions,
  };
  const json = JSON.stringify(artifact, null, 2) + "\n";

  if (CHECK_ONLY) {
    console.log(line);
    console.log(" ARTEFAKT YANGILIGI (--check)");
    console.log(line);
    console.log(`  Artefakt : ${OUT}`);
    console.log(`  Jonli    : MODULES ${modules.length} · ACTIONS ${actions.length}`);

    if (!fs.existsSync(OUT)) {
      console.log("");
      console.log("❌ Artefakt MAVJUD EMAS. Yarating: yarn gen:catalog");
      process.exit(1);
    }
    const mavjud = fs.readFileSync(OUT, "utf8");
    if (mavjud === json) {
      console.log("");
      console.log("✅ Artefakt jonli constants.js bilan mos.");
      process.exit(0);
    }
    let eski;
    try {
      eski = JSON.parse(mavjud);
    } catch {
      console.log("");
      console.log("❌ Artefakt buzuq JSON. Qayta yarating: yarn gen:catalog");
      process.exit(1);
    }
    const yangiModul = modules.filter((m) => !(eski.modules || []).includes(m));
    const yoqModul = (eski.modules || []).filter((m) => !modules.includes(m));
    const yangiAction = actions.filter((a) => !(eski.actions || []).includes(a));
    const yoqAction = (eski.actions || []).filter((a) => !actions.includes(a));
    console.log("");
    console.log("❌ Artefakt ESKIRGAN.");
    if (yangiModul.length) console.log(`  + yangi MODULES: ${yangiModul.join(", ")}`);
    if (yoqModul.length) console.log(`  - yo'qolgan MODULES: ${yoqModul.join(", ")}`);
    if (yangiAction.length) console.log(`  + yangi ACTIONS: ${yangiAction.join(", ")}`);
    if (yoqAction.length) console.log(`  - yo'qolgan ACTIONS: ${yoqAction.join(", ")}`);
    console.log("");
    console.log("  Tuzatish: yarn gen:catalog  (so'ng artefaktni frontend repo'siga commit qiling)");
    process.exit(1);
  }

  const dir = path.dirname(OUT);
  if (!fs.existsSync(dir)) {
    console.error(`XATO: chiqish papkasi yo'q: ${dir}`);
    console.error("Frontend repo yonma-yon turibdimi? `--out` bilan yo'l bering.");
    process.exit(2);
  }
  fs.writeFileSync(OUT, json, "utf8");

  console.log(line);
  console.log(" PERMISSION KATALOG ARTEFAKTI");
  console.log(line);
  console.log(`  MODULES : ${modules.length}`);
  console.log(`  ACTIONS : ${actions.length}`);
  console.log(`  Yozildi : ${OUT}`);
  console.log(line);
  console.log("");
  console.log("⚠️  Artefakt FRONTEND repo'siga tegishli — uni o'sha repo'da commit qiling.");
  console.log("   Aks holda FE CI eski katalogga qarab tekshiradi.");
}

try {
  main();
} catch (e) {
  console.error("XATO:", e.message);
  process.exit(2);
}
