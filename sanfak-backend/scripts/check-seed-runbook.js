"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SEED_DIR = path.join(ROOT, "seed");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");
const DEPLOY_MD_PATH = path.join(ROOT, "docs", "DEPLOY.md");

const RBAC_PATTERNS = [/-roles\.seed\.js$/i, /^permissions[\w-]*\.seed\.js$/i, /^permissionGroups\.seed\.js$/i];

const DEV_ONLY_PATTERNS = [
  /-test-users\.seed\.js$/i,
  /-sample-data\.seed\.js$/i,
  /-demo(-data)?\.seed\.js$/i,
  /^testUsers\.seed\.js$/i,
];

function isRbac(file) {
  return RBAC_PATTERNS.some((re) => re.test(file));
}
function isDevOnly(file) {
  return DEV_ONLY_PATTERNS.some((re) => re.test(file));
}

const USER_SEED_PATTERNS = [/users/i, /test/i];

const GUARD_EXEMPT = new Map([
  [
    "oqituvchi-test-rbac.seed.js",
    "foydalanuvchi YARATMAYDI — `malaka_oqituvchi` roliga savol-banki ruxsatlarini " +
      "qo'shadigan ADDITIVE RBAC seed'i, deploy'da ishga tushirilishi SHART.",
  ],
]);

const DEV_GUARD_DECL = /const\s+DEV_ENVS\s*=\s*\[/;
const DEV_GUARD_USE = /DEV_ENVS\.includes\(\s*String\(\s*process\.env\.NODE_ENV/;

function needsDevGuard(file) {
  return USER_SEED_PATTERNS.some((re) => re.test(file)) && !GUARD_EXEMPT.has(file);
}
function hasDevGuard(file) {
  const text = fs.readFileSync(path.join(SEED_DIR, file), "utf8");
  return DEV_GUARD_DECL.test(text) && DEV_GUARD_USE.test(text);
}

function listSeedFiles() {
  return fs
    .readdirSync(SEED_DIR)
    .filter((f) => f.endsWith(".seed.js"))
    .sort();
}

function readPackageScripts() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  return pkg.scripts || {};
}

function buildSeedToScripts(scripts) {
  const map = new Map();
  for (const [scriptName, cmd] of Object.entries(scripts)) {
    const matches = cmd.match(/seed\/[\w.-]+\.seed\.js/g) || [];
    for (const m of matches) {
      const file = m.replace(/^seed\//, "");
      if (!map.has(file)) map.set(file, []);
      map.get(file).push(scriptName);
    }
  }
  return map;
}

function readDocScriptNames() {
  const text = fs.readFileSync(DEPLOY_MD_PATH, "utf8");
  const names = new Set();
  const re = /(?:npm run|yarn) ([\w:.-]+)/g;
  let m;
  while ((m = re.exec(text))) names.add(m[1]);
  const rawFiles = new Set((text.match(/seed\/[\w.-]+\.seed\.js/g) || []).map((s) => s.replace(/^seed\//, "")));
  return { docScriptNames: names, docRawFiles: rawFiles };
}

function readDeployPlan() {
  const { STEPS, EXCLUDED } = require("../seed/_deploy-plan");
  const planned = new Set(
    STEPS.filter((s) => s.file.startsWith("seed/")).map((s) => s.file.replace(/^seed\//, "")),
  );
  return { planned, excluded: EXCLUDED };
}

function check() {
  const seedFiles = listSeedFiles();
  const scripts = readPackageScripts();
  const seedToScripts = buildSeedToScripts(scripts);
  const { docScriptNames, docRawFiles } = readDocScriptNames();
  const plan = readDeployPlan();

  const result = {
    ok: [],
    missingNoScript: [],
    missingNotDocumented: [],
    uncertain: [],
    devOnly: [],
    missingDevGuard: [],
    notInPlan: [],
    unsafeInPlan: [],
  };

  for (const file of plan.planned) {
    if (isDevOnly(file) || needsDevGuard(file)) result.unsafeInPlan.push(file);
  }

  for (const file of seedFiles) {
    const scriptNames = seedToScripts.get(file) || [];
    const hasScript = scriptNames.length > 0;
    const inDocs = docRawFiles.has(file) || scriptNames.some((s) => docScriptNames.has(s));

    if (needsDevGuard(file) && !hasDevGuard(file)) {
      result.missingDevGuard.push(file);
    }

    if (isDevOnly(file)) {
      result.devOnly.push(file);
      continue;
    }

    if (!isRbac(file)) {
      if (!inDocs) result.uncertain.push(file);
      else result.ok.push(file);
      continue;
    }

    if (!plan.planned.has(file) && !plan.excluded.has(file)) {
      result.notInPlan.push(file);
    }

    if (!hasScript) {
      result.missingNoScript.push(file);
    } else if (!inDocs) {
      result.missingNotDocumented.push(file);
    } else {
      result.ok.push(file);
    }
  }

  return result;
}

function printReport(result) {
  const line = (s = "") => console.log(s);
  line("═══════════════════════════════════════════════════════════════");
  line(" seed/*.seed.js  ↔  package.json  ↔  docs/DEPLOY.md §3 (RBAC seed)");
  line("═══════════════════════════════════════════════════════════════");
  line(`  MOS (RBAC yoki hujjatlangan boshqa seed):  ${result.ok.length}`);
  line(`  DEV-ONLY (ataylab runbookdan tashqarida):  ${result.devOnly.length}`);
  line(`  YETISHMAYAPTI — npm skript yo'q:           ${result.missingNoScript.length}`);
  result.missingNoScript.forEach((f) => line(`    ✗ ${f}  — package.json'da script yo'q`));
  line(`  YETISHMAYAPTI — runbookda yo'q:            ${result.missingNotDocumented.length}`);
  result.missingNotDocumented.forEach((f) => line(`    ✗ ${f}  — docs/DEPLOY.md §3'da yo'q`));
  line(`  TEKSHIRILSIN (noaniq, RBAC emas, hujjatda yo'q): ${result.uncertain.length}`);
  result.uncertain.forEach((f) => line(`    ? ${f}`));
  line(`  QO'RIQCHISIZ test-foydalanuvchi seedi (DEV_ENVS yo'q): ${result.missingDevGuard.length}`);
  result.missingDevGuard.forEach((f) => line(`    ✗ ${f}  — fail-closed DEV_ENVS allowlist qo'riqchisi YO'Q`));
  line(`  setup:seed REJASIDA YO'Q (seed/_deploy-plan.js): ${result.notInPlan.length}`);
  result.notInPlan.forEach((f) => line(`    ✗ ${f}  — RBAC seed, lekin yarn setup:seed uni ishga tushirmaydi`));
  line(`  REJADA TEST/DEMO seed: ${result.unsafeInPlan.length}`);
  result.unsafeInPlan.forEach((f) => line(`    ✗ ${f}  — production rejasiga kirmasligi kerak`));
  line("═══════════════════════════════════════════════════════════════");
  const totalMissing = result.missingNoScript.length + result.missingNotDocumented.length;
  if (totalMissing > 0) {
    line(`\n❌ ${totalMissing} ta RBAC seed runbook'dan yetishmayapti.`);
  } else {
    line("\n✅ RBAC seed oilasi to'liq — script + runbook mos.");
  }
  if (result.missingDevGuard.length > 0) {
    line(`\n❌ ${result.missingDevGuard.length} ta test-foydalanuvchi seedida DEV_ENVS qo'riqchisi YO'Q.`);
    line("   Namuna: seed/task-users.seed.js (const bloki + main() boshidagi throw):");
    line('     const DEV_ENVS = ["dev", "development", "test", "qa", "local"];');
    line('     const IS_DEV_ENV = DEV_ENVS.includes(String(process.env.NODE_ENV || "").toLowerCase());');
    line("     // main() boshida:  if (!IS_DEV_ENV) throw new Error(...)");
  } else {
    line("✅ Test-foydalanuvchi seedlarida fail-closed DEV_ENVS qo'riqchisi to'liq.");
  }
  if (result.notInPlan.length + result.unsafeInPlan.length > 0) {
    line(`\n❌ yarn setup:seed rejasi mos emas — seed/_deploy-plan.js ni yangilang.`);
  } else {
    line("✅ yarn setup:seed rejasi RBAC seed oilasini to'liq qamraydi.");
  }
}

function hasFailures(result) {
  return (
    result.missingNoScript.length +
      result.missingNotDocumented.length +
      result.missingDevGuard.length +
      result.notInPlan.length +
      result.unsafeInPlan.length >
    0
  );
}

if (require.main === module) {
  const result = check();
  printReport(result);
  process.exit(hasFailures(result) ? 1 : 0);
}

module.exports = {
  check,
  hasFailures,
  isRbac,
  isDevOnly,
  needsDevGuard,
  hasDevGuard,
  RBAC_PATTERNS,
  DEV_ONLY_PATTERNS,
  USER_SEED_PATTERNS,
  GUARD_EXEMPT,
};
