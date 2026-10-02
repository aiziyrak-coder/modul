const fs = require("fs");
const path = require("path");

const BE_ROOT = path.resolve(__dirname, "..");
const CONSTANTS = path.join(BE_ROOT, "src", "config", "constants.js");

const argIdx = process.argv.indexOf("--frontend");
const FE_ROOT =
  argIdx !== -1 && process.argv[argIdx + 1]
    ? path.resolve(process.argv[argIdx + 1])
    : path.resolve(BE_ROOT, "..", "frontend");

const line = "═".repeat(63);

function extractBlockValues(rawSrc, name) {
  const src = rawSrc.replace(/\/\/[^\n]*/g, "");
  const start = src.indexOf(`${name}: {`);
  if (start === -1) return new Set();
  let depth = 0;
  let i = src.indexOf("{", start);
  const from = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const block = src.slice(from, i + 1);
  const values = new Set();
  const re = /"([^"\n]+)"\s*,?/g;
  let m;
  while ((m = re.exec(block)) !== null) values.add(m[1]);
  return values;
}

function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(full, out);
    else if (e.name.endsWith(".module.tsx") || e.name.endsWith(".routes.tsx")) out.push(full);
  }
  return out;
}

const KEY_RE = /["']([a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*)["']/g;

function main() {
  if (!fs.existsSync(CONSTANTS)) {
    console.error(`XATO: backend constants.js topilmadi: ${CONSTANTS}`);
    process.exit(2);
  }

  if (!fs.existsSync(FE_ROOT)) {
    console.log(line);
    console.log(" FE↔BE PERMISSION SEAM");
    console.log(line);
    console.log("");
    console.log("  ⚠️  TEKSHIRILMADI — frontend topilmadi:");
    console.log(`      ${FE_ROOT}`);
    console.log("");
    console.log("  Bu YASHIL emas, TEKSHIRILMAGAN. Bu tekshiruv backend va frontend");
    console.log("  papkalari yonma-yon turganda ishlaydi (--frontend <yo'l> bilan ko'rsating).");
    console.log("");
    console.log(line);
    process.exit(0);
  }

  const src = fs.readFileSync(CONSTANTS, "utf8");
  const MODULES = extractBlockValues(src, "MODULES");
  const ACTIONS = extractBlockValues(src, "ACTIONS");

  const files = collectFiles(path.join(FE_ROOT, "src", "modules"));
  const keys = new Map();

  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    let m;
    KEY_RE.lastIndex = 0;
    while ((m = KEY_RE.exec(text)) !== null) {
      const key = m[1];
      if (!keys.has(key)) keys.set(key, new Set());
      keys.get(key).add(path.relative(FE_ROOT, f));
    }
  }

  const badSection = [];
  const badAction = [];
  for (const [key, where] of keys) {
    const [section, action] = key.split(":");
    if (!MODULES.has(section)) badSection.push({ key, section, where: [...where] });
    else if (!ACTIONS.has(action)) badAction.push({ key, action, where: [...where] });
  }

  console.log(line);
  console.log(" FE↔BE PERMISSION SEAM  (frontend gate'lari ↔ backend katalogi)");
  console.log(line);
  console.log(`  Backend MODULES        : ${MODULES.size}`);
  console.log(`  Backend ACTIONS        : ${ACTIONS.size}`);
  console.log(`  Skanerlangan FE fayl   : ${files.length}`);
  console.log(`  Topilgan noyob FE kalit: ${keys.size}`);
  console.log(`  Notanish SECTION       : ${badSection.length}`);
  console.log(`  Notanish ACTION        : ${badAction.length}`);
  console.log(line);

  if (badSection.length) {
    console.log("");
    console.log("❌ SECTION backend MODULES da YO'Q (grant qilib bo'lmaydi ⇒ abadiy 403):");
    for (const b of badSection) {
      console.log(`   ${b.key}   (section: ${b.section})`);
      b.where.forEach((w) => console.log(`      ← ${w}`));
    }
  }

  if (badAction.length) {
    console.log("");
    console.log("❌ ACTION backend ACTIONS da YO'Q:");
    for (const b of badAction) {
      console.log(`   ${b.key}   (action: ${b.action})`);
      b.where.forEach((w) => console.log(`      ← ${w}`));
    }
  }

  console.log("");
  if (badSection.length + badAction.length === 0) {
    console.log("✅ Seam drifti yo'q — barcha frontend permission kaliti backend katalogida bor.");
    process.exit(0);
  }
  console.log(`❌ Seam drifti: ${badSection.length + badAction.length} kalit.`);
  console.log("   Tuzatish: backend `constants.js` MODULES ga qo'shib `yarn seed:permissions`,");
  console.log("   YOKI frontend'dagi kalit nomini to'g'rilash.");
  process.exit(1);
}

main();
