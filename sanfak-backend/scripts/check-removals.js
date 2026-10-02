const { execFileSync } = require("child_process");

const line = "═".repeat(63);

const baseIdx = process.argv.indexOf("--base");
const BASE = baseIdx !== -1 && process.argv[baseIdx + 1] ? process.argv[baseIdx + 1] : "origin/main";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

const PATTERNS = [
  { re: /\bpermit\s*\(/, nima: "RBAC himoyasi (permit) olib tashlandi", faqat: /\.js$/ },
  { re: /\brouter\s*\.\s*(get|post|put|patch|delete)\s*\(/, nima: "backend route", faqat: /\.js$/ },
  {
    re: /\bpermission\s*:\s*["'][a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*["']/,
    nima: "frontend permission gate",
    faqat: /\.tsx?$/,
  },
  {
    re: /["'][a-z][a-zA-Z0-9]*:[a-z][a-zA-Z0-9]*["']\s*,?\s*$/,
    nima: "permission kaliti (manifest)",
    faqat: /\.module\.tsx$/,
  },
  {
    re: /^\s*[A-Za-z_][A-Za-z0-9_]*\s*:\s*["'][^"']+["']\s*,?\s*$/,
    nima: "konstanta qiymati",
    faqat: /config[\\/]constants\.js$/,
  },
  {
    re: /\bpath\s*:\s*["'][^"']*["'].*\belement\s*:/,
    nima: "frontend route (path + element)",
    faqat: /\.tsx$/,
  },
];

const SKIP_FILES = /\.(test|spec)\.[jt]sx?$|__tests__|__mocks__|[\\/]fixtures?[\\/]/;

const FILE_PATTERNS = [
  { re: /\.routes\.js$/, nima: "route fayli" },
  { re: /\.controller\.js$/, nima: "controller" },
  { re: /\.module\.tsx$/, nima: "modul manifesti" },
  { re: /-page\.tsx$/, nima: "sahifa" },
  { re: /\.seed\.js$/, nima: "seed" },
];

function main() {
  const rangeIdx = process.argv.indexOf("--range");
  if (rangeIdx !== -1 && process.argv[rangeIdx + 1]) {
    return run(process.argv[rangeIdx + 1]);
  }

  try {
    git(["rev-parse", "--verify", BASE]);
  } catch {
    console.log(`⚠️  Base ref '${BASE}' topilmadi — TEKSHIRILMADI.`);
    console.log("   To'liq git tarixi va to'g'ri base kerak. Tekshiruv o'tkazib yuborildi.");
    process.exit(0);
  }
  return run(`${BASE}...HEAD`);
}

function run(range) {
  const findings = [];

  const deleted = git(["diff", "--diff-filter=D", "--name-only", range])
    .split("\n")
    .filter(Boolean)
    .filter((f) => !SKIP_FILES.test(f));
  for (const f of deleted) {
    const hit = FILE_PATTERNS.find((p) => p.re.test(f));
    if (hit) findings.push({ turi: `BUTUN FAYL — ${hit.nima}`, fayl: f, matn: "(fayl o'chirildi)" });
  }

  const diff = git(["diff", "--unified=0", range]).split("\n");

  const added = new Set();
  let addedBlob = "";
  for (const raw of diff) {
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      const t = raw.slice(1).trim();
      if (t) {
        added.add(t);
        addedBlob += t + "\n";
      }
    }
  }

  let currentFile = "";
  let kochirilgan = 0;
  for (const raw of diff) {
    if (raw.startsWith("+++ b/")) {
      currentFile = raw.slice(6);
      continue;
    }
    if (!raw.startsWith("-") || raw.startsWith("---")) continue;
    if (SKIP_FILES.test(currentFile)) continue;
    const text = raw.slice(1);
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (const p of PATTERNS) {
      if (p.faqat && !p.faqat.test(currentFile)) continue;
      if (p.re.test(text)) {
        const literal = (trimmed.match(/["']([^"']+)["']/) || [])[1];
        const kochgan = added.has(trimmed) || (literal && addedBlob.includes(literal));
        if (kochgan) kochirilgan++;
        else findings.push({ turi: p.nima, fayl: currentFile, matn: trimmed.slice(0, 100) });
        break;
      }
    }
  }

  const messages = git(["log", "--format=%B", range]);

  const approved = /^O'?chirish-tasdiq\s*:\s*\S/m.test(messages);

  console.log(line);
  console.log(" JIMGINA O'CHIRISH QOPQONI");
  console.log(line);
  console.log(`  Oraliq                 : ${range}`);
  console.log(`  O'chirilgan muhim fayl : ${deleted.filter((f) => FILE_PATTERNS.some((p) => p.re.test(f))).length}`);
  console.log(`  Muhim o'chirish (jami) : ${findings.length}`);
  console.log(`  Ko'chirish deb o'tkazib yuborildi: ${kochirilgan}`);
  console.log(`  Commit'da tasdiq izi   : ${approved ? "BOR" : "YO'Q"}`);
  console.log(line);

  if (findings.length === 0) {
    console.log("");
    console.log("✅ Tasdiqlangan ishni o'chirish aniqlanmadi.");
    process.exit(0);
  }

  console.log("");
  const byType = new Map();
  for (const f of findings) {
    if (!byType.has(f.turi)) byType.set(f.turi, []);
    byType.get(f.turi).push(f);
  }
  for (const [turi, list] of byType) {
    console.log(`  ▸ ${turi} — ${list.length} ta`);
    for (const f of list.slice(0, 5)) console.log(`      ${f.fayl}\n        - ${f.matn}`);
    if (list.length > 5) console.log(`      ... yana ${list.length - 5} ta`);
    console.log("");
  }

  if (approved) {
    console.log("✅ Commit xabarida `O'chirish-tasdiq:` izi bor — ataylab qilingan deb qabul qilindi.");
    process.exit(0);
  }

  console.log("❌ TASDIQLANMAGAN O'CHIRISH.");
  console.log("");
  console.log("   Yuqoridagi o'chirishlar ataylab bo'lsa — commit xabariga qator qo'shing:");
  console.log("");
  console.log("       O'chirish-tasdiq: <nima va nega o'chirildi>");
  console.log("");
  console.log("   Ataylab BO'LMASA — bu regressiya.");
  process.exit(1);
}

try {
  main();
} catch (e) {
  console.error("XATO:", e.message);
  process.exit(2);
}
