"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const readline = require("readline");
const { spawn } = require("child_process");
const { parseArgs } = require("util");

const ROOT = path.join(__dirname, "..");
require("dotenv").config({ path: path.join(ROOT, ".env") });

const mongoose = require("mongoose");
const { EJSON } = mongoose.mongo.BSON;
const { PHASES, STEPS, EXCLUDED, TEST_ACCOUNT_PINS } = require("../seed/_deploy-plan");
const runbook = require("./check-seed-runbook");

const DEFAULT_OUT_DIR = path.join(ROOT, "scripts", "backups");
const DRIFT_SCRIPT = "scripts/check-permission-drift.js";
const FIRST_ADMIN_SCRIPT = "seed/first-admin.seed.js";
const BACKUP_FORMAT = "setup-seed-backup/1";
const BACKUP_COLLECTIONS = ["roles", "permissions", "permissiongroups"];
const LOCK_COLLECTION = "setupseedlocks";
const LOCK_ID = "setup-seed";
const STEP_TIMEOUT_MS = 10 * 60 * 1000;
const PIN_RE = /^\d{14}$/;

const EXIT = { OK: 0, FAILED: 1, USAGE: 2, INTERRUPTED: 130 };

const PROBLEM_PATTERNS = [
  /\[SKIP\]/,
  /rol topilmadi/i,
  /YETISHMAYDI/,
  /ORTIQCHA/,
  /Rol yo'q: [1-9]/,
];
const REMOVAL_PATTERNS = [/^\s*[-−]\s+\S/, /[-−]\s*\[[^\]]+\]/, /O'CHADI/, /olib tashla/i, /scopeLevel.*→/];

const HELP = `
Foydalanish:
  yarn setup:seed [bayroqlar]
  node scripts/setup-seed.js [bayroqlar]

Barcha production seedlarini (ruxsatlar katalogi, rol huquqlari, PIN indeksi)
to'g'ri tartibda ishga tushiradi, natijani tekshiradi va kerak bo'lsa birinchi
administratorni yaratadi.

Bayroqlar:
  --dry               Hech narsa yozmaydi: seedlarni ko'rish rejimida ishga tushirib,
                      qaysi huquqlar qo'shilishi/olib tashlanishini ko'rsatadi
  --yes               Tasdiq so'ramaydi (avtomatik deploy uchun)
  --skip-admin        Birinchi administrator qadamini o'tkazib yuboradi
  --allow-dev         NODE_ENV=production bo'lmagan (dev/test) bazada ishlashga ruxsat
  --force-unlock      Oldingi to'xtab qolgan ishga tushirish qoldirgan qulfni olib tashlaydi
  --out-dir <papka>   Zaxira va log papkasi (default: scripts/backups)
  --verbose           Har bir seedning to'liq chiqishini ekranga ham chiqaradi
  --restore <fayl>    Zaxiradan roles/permissions/permissiongroups ni qaytaradi
  --allow-other-db    --restore: zaxira boshqa bazadan olingan bo'lsa ham qaytaradi
  --help              Shu yordam

Exit kodlari: 0 — muvaffaqiyatli · 1 — qadam yoki tekshiruv xato · 2 — sozlama/tasdiq xatosi · 130 — to'xtatildi
`;

class UsageError extends Error {}

function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        dry: { type: "boolean", default: false },
        yes: { type: "boolean", default: false },
        "skip-admin": { type: "boolean", default: false },
        "allow-dev": { type: "boolean", default: false },
        "force-unlock": { type: "boolean", default: false },
        "out-dir": { type: "string" },
        verbose: { type: "boolean", default: false },
        restore: { type: "string" },
        "allow-other-db": { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
    });
  } catch (err) {
    throw new UsageError(err.message);
  }
  const v = parsed.values;
  if (v.restore !== undefined && v.dry) throw new UsageError("--restore va --dry birga ishlatilmaydi");
  if (v["allow-other-db"] && v.restore === undefined) throw new UsageError("--allow-other-db faqat --restore bilan ishlatiladi");
  return {
    dry: v.dry,
    yes: v.yes,
    skipAdmin: v["skip-admin"],
    allowDev: v["allow-dev"],
    forceUnlock: v["force-unlock"],
    outDir: path.resolve(v["out-dir"] || DEFAULT_OUT_DIR),
    verbose: v.verbose,
    restore: v.restore === undefined ? null : path.resolve(v.restore),
    allowOtherDb: v["allow-other-db"],
    help: v.help,
  };
}

function maskUri(uri) {
  return String(uri || "").replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]*@/gi, "$1***@");
}

function maskSecrets(text, mongoHost) {
  let out = String(text);
  if (mongoHost) out = out.split(mongoHost).join(maskUri(mongoHost));
  out = out.replace(/(mongodb(?:\+srv)?:\/\/)[^@/\s]*@/gi, "$1***@");
  out = out.replace(/\b\d{14}\b/g, "**************");
  return out;
}

function findProblemLines(output) {
  return String(output)
    .split(/\r?\n/)
    .filter((line) => PROBLEM_PATTERNS.some((re) => re.test(line)))
    .map((line) => line.trim());
}

function findRemovalLines(output) {
  return String(output)
    .split(/\r?\n/)
    .filter((line) => REMOVAL_PATTERNS.some((re) => re.test(line)))
    .map((line) => line.trim());
}

function evaluateStep(result, { dry, phase }) {
  const seconds = (result.ms / 1000).toFixed(1);
  if (result.timedOut) return { ok: false, reason: `vaqt tugadi (${seconds}s)`, problems: [] };
  if (result.code !== 0) {
    const how = result.code === null ? `signal ${result.signal}` : `exit ${result.code}`;
    return { ok: false, reason: how, problems: [] };
  }
  const problems = findProblemLines(result.output);
  if (problems.length && !dry) {
    return { ok: false, reason: "exit 0, lekin chiqishda o'tkazib yuborilgan qadam bor", problems };
  }
  const removals = dry && phase === "roles" ? findRemovalLines(result.output) : [];
  return { ok: true, reason: null, problems, removals };
}

function listPackageScripts() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts || {};
}

function validatePlan(steps = STEPS, excluded = EXCLUDED) {
  const problems = [];
  const scripts = listPackageScripts();
  const ids = new Set();
  const planned = new Set();
  for (const step of steps) {
    if (ids.has(step.id)) problems.push(`takroriy qadam: ${step.id}`);
    ids.add(step.id);
    if (!PHASES[step.phase]) problems.push(`${step.id}: noma'lum bosqich "${step.phase}"`);
    if (!fs.existsSync(path.join(ROOT, step.file))) problems.push(`${step.id}: fayl yo'q — ${step.file}`);
    if (!Array.isArray(step.args)) problems.push(`${step.id}: args massiv emas`);
    if (step.dryArgs !== null && !Array.isArray(step.dryArgs)) problems.push(`${step.id}: dryArgs massiv yoki null bo'lishi kerak`);
    if (step.script !== null) {
      const cmd = scripts[step.script];
      if (!cmd) problems.push(`${step.id}: package.json da "${step.script}" skripti yo'q`);
      else if (!cmd.includes(step.file)) problems.push(`${step.id}: "${step.script}" skripti ${step.file} ni ishga tushirmaydi`);
    }
    if (step.file.startsWith("seed/")) {
      const base = path.basename(step.file);
      planned.add(base);
      if (runbook.isDevOnly(base)) problems.push(`${step.id}: DEV-ONLY seed production rejasida`);
      if (runbook.needsDevGuard(base)) problems.push(`${step.id}: test-foydalanuvchi seedi production rejasida`);
    }
  }
  const seedFiles = fs.readdirSync(path.join(ROOT, "seed")).filter((f) => f.endsWith(".seed.js"));
  for (const file of seedFiles) {
    if (runbook.isRbac(file) && !planned.has(file) && !excluded.has(file)) {
      problems.push(`RBAC seed rejada yo'q: seed/${file}`);
    }
  }
  return problems;
}

function line(ch = "═") {
  return ch.repeat(72);
}

function createLogger(opts) {
  let logFile = null;
  const write = (text) => {
    if (logFile) fs.appendFileSync(logFile, maskSecrets(text, process.env.MONGO_HOST));
  };
  return {
    open(file) {
      logFile = file;
      fs.writeFileSync(logFile, "", { flag: "wx" });
    },
    get file() {
      return logFile;
    },
    say(text = "") {
      const masked = maskSecrets(text, process.env.MONGO_HOST);
      process.stdout.write(`${masked}\n`);
      write(`${text}\n`);
    },
    raw(text) {
      if (opts.verbose) process.stdout.write(maskSecrets(text, process.env.MONGO_HOST));
      write(text);
    },
  };
}

const state = { child: null, interrupted: false };

function runNode(file, args, { env, timeoutMs = STEP_TIMEOUT_MS, input = null } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(process.execPath, [file, ...args], {
      cwd: ROOT,
      env,
      stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    if (input !== null) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(input);
    }
    state.child = child;
    let timedOut = false;
    let spawnError = null;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("error", (err) => {
      spawnError = err;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      state.child = null;
      let output = Buffer.concat(chunks).toString("utf8");
      if (spawnError) output += `\n${spawnError.message}\n`;
      resolve({ code: spawnError ? 1 : code, signal, timedOut, output, ms: Date.now() - started });
    });
  });
}

async function runSteps(steps, { dry, env, log, timeoutMs }) {
  const results = [];
  const width = String(steps.length).length;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = `[${String(i + 1).padStart(width)}/${steps.length}] ${step.title}`;
    if (state.interrupted) break;
    if (dry && step.dryArgs === null) {
      log.say(`  ${label}  — o'tkazildi (ko'rish rejimi yo'q; haqiqiy ishga tushirishda yozadi)`);
      results.push({ step, skipped: true, ok: true, problems: [], removals: [], ms: 0 });
      continue;
    }
    const args = dry ? step.dryArgs : step.args;
    log.raw(`\n${line("─")}\n$ node ${[step.file, ...args].join(" ")}\n${line("─")}\n`);
    const result = await runNode(step.file, args, { env, timeoutMs });
    log.raw(result.output.endsWith("\n") ? result.output : `${result.output}\n`);
    const verdict = evaluateStep(result, { dry, phase: step.phase });
    const seconds = `${(result.ms / 1000).toFixed(1)}s`;
    results.push({ step, ...verdict, ms: result.ms, output: result.output });
    if (verdict.ok) {
      const warn = dry && verdict.problems.length ? `  ⚠️ ${verdict.problems.length} ta ogohlantirish` : "";
      log.say(`  ${label}  ✓ ${seconds}${warn}`);
      continue;
    }
    const tail = verdict.problems.length ? verdict.problems : result.output.trim().split(/\r?\n/).slice(-40);
    if (dry) {
      log.say(`  ${label}  ⚠️ ko'rib bo'lmadi (${verdict.reason})`);
      for (const l of tail.slice(-8)) log.say(`        ${l}`);
      continue;
    }
    log.say(`  ${label}  ✗ ${verdict.reason}`);
    for (const l of tail) log.say(`        ${l}`);
    break;
  }
  return results;
}

async function connect(uri) {
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: false,
    autoCreate: false,
  });
  await conn.asPromise();
  return conn;
}

async function countState(db) {
  const names = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const count = async (name) => (names.has(name) ? db.collection(name).countDocuments() : 0);
  return {
    roles: await count("roles"),
    permissions: await count("permissions"),
    permissiongroups: await count("permissiongroups"),
    users: await count("users"),
  };
}

class LockError extends Error {
  constructor(holder) {
    super("qulf band");
    this.holder = holder;
  }
}

function isDeadLocalHolder(holder) {
  if (!holder || holder.host !== os.hostname() || !Number.isInteger(holder.pid) || holder.pid === process.pid) return false;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch (err) {
    return err.code === "ESRCH";
  }
}

async function acquireLock(db, { force }) {
  const col = db.collection(LOCK_COLLECTION);
  const token = crypto.randomUUID();
  const doc = { _id: LOCK_ID, token, pid: process.pid, host: os.hostname(), startedAt: new Date() };
  try {
    await col.insertOne(doc);
    return { token, replaced: null, stale: false };
  } catch (err) {
    if (err.code !== 11000) throw err;
    const holder = await col.findOne({ _id: LOCK_ID });
    const stale = isDeadLocalHolder(holder);
    if (!force && !stale) throw new LockError(holder);
    await col.deleteOne({ _id: LOCK_ID });
    await col.insertOne(doc);
    return { token, replaced: holder, stale };
  }
}

async function releaseLock(db, token) {
  if (!token) return;
  await db.collection(LOCK_COLLECTION).deleteOne({ _id: LOCK_ID, token });
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function writeBackup(db, outDir, label) {
  fs.mkdirSync(outDir, { recursive: true });
  const collections = {};
  for (const name of BACKUP_COLLECTIONS) collections[name] = await db.collection(name).find({}).toArray();
  const payload = { format: BACKUP_FORMAT, createdAt: new Date(), db: db.databaseName, collections };
  const file = path.join(outDir, `${label}-${db.databaseName}-${stamp()}.json`);
  fs.writeFileSync(file, EJSON.stringify(payload, null, 1, { relaxed: false }), { flag: "wx" });
  const counts = Object.fromEntries(BACKUP_COLLECTIONS.map((n) => [n, collections[n].length]));
  return { file, counts };
}

function readBackup(file) {
  const payload = EJSON.parse(fs.readFileSync(file, "utf8"), { relaxed: false });
  if (!payload || payload.format !== BACKUP_FORMAT) throw new UsageError(`zaxira formati noto'g'ri: ${file}`);
  for (const name of BACKUP_COLLECTIONS) {
    if (!Array.isArray(payload.collections && payload.collections[name])) {
      throw new UsageError(`zaxirada "${name}" kolleksiyasi yo'q: ${file}`);
    }
  }
  return payload;
}

const stagingName = (name) => `${name}__setup_seed_restore`;

async function dropIfExists(db, name) {
  const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
  if (exists) await db.collection(name).drop();
}

async function restoreBackup(db, payload) {
  const result = {};
  try {
    for (const name of BACKUP_COLLECTIONS) {
      const staging = stagingName(name);
      await dropIfExists(db, staging);
      await db.createCollection(staging);
      const targetExists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
      const indexes = targetExists ? await db.collection(name).indexes() : [];
      for (const idx of indexes) {
        if (idx.name === "_id_") continue;
        const { key, v, ns, ...options } = idx;
        await db.collection(staging).createIndex(key, options);
      }
      const docs = payload.collections[name];
      if (docs.length) await db.collection(staging).insertMany(docs, { ordered: true });
      result[name] = docs.length;
    }
  } catch (err) {
    for (const name of BACKUP_COLLECTIONS) await dropIfExists(db, stagingName(name)).catch(() => undefined);
    throw err;
  }
  for (const name of BACKUP_COLLECTIONS) {
    await db.renameCollection(stagingName(name), name, { dropTarget: true });
  }
  return result;
}

function askLine(question) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\n");
      reject(new Error("INTERRUPTED"));
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });
}

function createHiddenInput(echo = () => undefined) {
  let value = "";
  let escape = null;
  return {
    feed(chunk) {
      for (const c of chunk) {
        if (escape === "start") {
          escape = c === "[" ? "csi" : c === "O" ? "ss3" : null;
          continue;
        }
        if (escape === "ss3") {
          escape = null;
          continue;
        }
        if (escape === "csi") {
          if (c >= "@" && c <= "~") escape = null;
          continue;
        }
        if (c === "\u001b") {
          escape = "start";
          continue;
        }
        if (c === "\r" || c === "\n") return { done: true, value };
        if (c === "\u0003") return { done: true, interrupted: true };
        if (c === "\u007f" || c === "\b") {
          if (value) {
            value = value.slice(0, -1);
            echo("\b \b");
          }
          continue;
        }
        if (c >= " ") {
          value += c;
          echo("*");
        }
      }
      return { done: false };
    },
  };
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const input = createHiddenInput((s) => process.stdout.write(s));
    const onData = (chunk) => {
      const r = input.feed(chunk);
      if (!r.done) return;
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (r.interrupted) reject(new Error("INTERRUPTED"));
      else resolve(r.value);
    };
    stdin.on("data", onData);
  });
}

const isYes = (answer) => ["ha", "h", "yes", "y"].includes(String(answer).toLowerCase());

function parseFullName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 && !parts[0].startsWith("--") ? parts.join(" ") : null;
}

async function activeSuperAdmins(db) {
  const role = await db.collection("roles").findOne({ title: "super_admin" }, { projection: { _id: 1 } });
  if (!role) return { role: null, count: 0 };
  const count = await db.collection("users").countDocuments({ role: role._id, active: { $ne: false } });
  return { role, count };
}

function describeExistingPin(existing, superAdminRoleId) {
  const isSuperAdmin = existing.role && String(existing.role) === String(superAdminRoleId);
  if (isSuperAdmin && existing.active === false) {
    return (
      "bu JSHSHIR bilan super_admin hisobi bor, lekin nofaol. Uni faollashtiring:\n" +
      `           db.users.updateOne({ _id: ObjectId("${existing._id}") }, { $set: { active: true } })`
    );
  }
  return (
    "bu JSHSHIR boshqa rolli mavjud hisobga tegishli — hech narsa o'zgartirilmadi.\n" +
    `           Hisob: _id ${existing._id}. Rolini administrator panelidan yoki qo'lda o'zgartiring.`
  );
}

async function askAdminDetails(log) {
  let pin = null;
  for (let attempt = 0; attempt < 3 && !pin; attempt++) {
    const first = await askHidden("  JSHSHIR (PIN, 14 raqam): ");
    if (!PIN_RE.test(first)) {
      log.say("  ✗ PIN aynan 14 ta raqamdan iborat bo'lishi kerak.");
      continue;
    }
    const second = await askHidden("  JSHSHIR ni qayta kiriting: ");
    if (first !== second) {
      log.say("  ✗ Ikki kiritish mos emas.");
      continue;
    }
    pin = first;
  }
  if (!pin) return { error: "PIN kiritilmadi" };
  let name = null;
  for (let attempt = 0; attempt < 3 && !name; attempt++) {
    name = parseFullName(await askLine("  Ism Familiya [Otasining ismi]: "));
    if (!name) log.say("  ✗ Kamida ikki so'z kiriting: avval ism, keyin familiya.");
  }
  if (!name) return { error: "ism va familiya kiritilmadi" };
  return { pin, name };
}

async function firstAdminStep(db, { opts, env, log, interactive }) {
  const { role, count } = await activeSuperAdmins(db);
  if (!role) return { ok: false, text: "super_admin roli topilmadi" };
  if (count > 0) return { ok: true, text: `mavjud (${count} ta faol super_admin)` };
  const manual =
    `yaratilmagan. Qo'lda (buyruq oldidagi bo'sh joy uni shell tarixiga yozmaydi):\n` +
    `           node ${FIRST_ADMIN_SCRIPT} --pin <14 RAQAM> --name "Ism Familiya"`;
  if (opts.skipAdmin || !interactive) return { ok: true, pending: true, text: manual };

  let details;
  try {
    log.say("");
    log.say("  Tizimda faol administrator (super_admin) yo'q.");
    const want = await askLine("  Birinchi administratorni hozir yaratamizmi? [ha/yo'q]: ");
    if (!isYes(want)) return { ok: true, pending: true, text: manual };
    details = await askAdminDetails(log);
  } catch (err) {
    if (err && err.message === "INTERRUPTED") return { ok: true, pending: true, interrupted: true, text: manual };
    throw err;
  }
  if (details.error) return { ok: false, text: details.error };

  const existing = await db.collection("users").findOne({ oneIdPin: details.pin }, { projection: { role: 1, active: 1 } });
  if (existing) return { ok: false, text: describeExistingPin(existing, role._id) };

  const result = await runNode(FIRST_ADMIN_SCRIPT, ["--pin-stdin", "--name", details.name], { env, input: `${details.pin}\n` });
  log.raw(`\n${line("─")}\n$ node ${FIRST_ADMIN_SCRIPT} --pin-stdin --name "${details.name}"\n${line("─")}\n${result.output}\n`);
  const after = await activeSuperAdmins(db);
  if (result.code !== 0 || after.count < 1) {
    for (const l of result.output.trim().split(/\r?\n/).slice(-15)) log.say(`        ${l}`);
    const why = result.code !== 0 ? `exit ${result.code}` : "faol super_admin topilmadi";
    return { ok: false, text: `birinchi administrator yaratilmadi (${why})` };
  }
  return { ok: true, text: `yaratildi (${details.name})` };
}

async function postChecks(db, { env, log, production }) {
  const checks = [];
  const drift = await runNode(DRIFT_SCRIPT, [], { env });
  log.raw(`\n${line("─")}\n$ node ${DRIFT_SCRIPT}\n${line("─")}\n${drift.output}\n`);
  if (drift.code === 0) {
    checks.push({ ok: true, name: "Ruxsatlar katalogi drifti", text: "drift yo'q" });
  } else {
    const detail = drift.output.split(/\r?\n/).filter((l) => /^\s+\S+:\S+\s+<-|\[X\]|\[!\]/.test(l)).slice(0, 20);
    checks.push({ ok: false, name: "Ruxsatlar katalogi drifti", text: `exit ${drift.code}`, detail });
  }

  const adminRole = await db.collection("roles").findOne({ title: "admin" }, { projection: { _id: 1 } });
  checks.push(
    adminRole
      ? { ok: false, name: "\"admin\" roli", text: "bazada bor — bo'lmasligi kerak", detail: ["db.roles.findOne({ title: \"admin\" })"] }
      : { ok: true, name: "\"admin\" roli", text: "yo'q" },
  );

  if (production) {
    const found = await db
      .collection("users")
      .find({ oneIdPin: { $in: TEST_ACCOUNT_PINS }, active: { $ne: false } }, { projection: { oneIdPin: 1 } })
      .toArray();
    checks.push(
      found.length
        ? {
            ok: false,
            name: "Ochiq test hisoblari",
            text: `${found.length} ta faol test hisobi bor — bloklang yoki o'chiring`,
            detail: found.map((u) => `db.users.updateOne({ _id: ObjectId("${u._id}") }, { $set: { active: false } })`),
          }
        : { ok: true, name: "Ochiq test hisoblari", text: "yo'q" },
    );
  }
  return checks;
}

function printPlan(log, steps, { dry }) {
  let phase = null;
  steps.forEach((step, i) => {
    if (step.phase !== phase) {
      phase = step.phase;
      log.say(`  ${PHASES[phase]}:`);
    }
    const cmd = step.script ? `yarn ${step.script}` : `node ${step.file}`;
    const note = dry && step.dryArgs === null ? "  (ko'rish rejimi yo'q — o'tkaziladi)" : "";
    log.say(`    ${String(i + 1).padStart(2)}. ${step.title.padEnd(46)} ${cmd}${note}`);
  });
}

function childEnv() {
  return { ...process.env };
}

async function confirm(opts, question) {
  if (opts.yes) return true;
  if (!process.stdin.isTTY) {
    throw new UsageError("tasdiq kerak: terminal yo'q — avtomatik ishga tushirish uchun --yes qo'shing");
  }
  return isYes(await askLine(question));
}

async function runRestore(db, opts, log) {
  if (!fs.existsSync(opts.restore)) throw new UsageError(`zaxira fayli topilmadi: ${opts.restore}`);
  const payload = readBackup(opts.restore);
  const counts = Object.fromEntries(BACKUP_COLLECTIONS.map((n) => [n, payload.collections[n].length]));
  log.say(`  Zaxira: ${opts.restore}`);
  log.say(`  Olingan: ${new Date(payload.createdAt).toISOString()} · baza: ${payload.db}`);
  log.say(`  Tarkibi: ${BACKUP_COLLECTIONS.map((n) => `${n} ${counts[n]}`).join(" · ")}`);
  if (payload.db !== db.databaseName && !opts.allowOtherDb) {
    throw new UsageError(`zaxira "${payload.db}" bazasidan, hozirgi baza "${db.databaseName}" — boshqa bazaga qaytarish uchun --allow-other-db`);
  }
  log.say("");
  log.say(`  ⚠️ Joriy ${BACKUP_COLLECTIONS.join(", ")} to'liq almashtiriladi (oldin joriy holat ham zaxiralanadi).`);
  if (!(await confirm(opts, "  Davom etamizmi? [ha/yo'q]: "))) {
    log.say("  Bekor qilindi — hech narsa o'zgarmadi.");
    return EXIT.USAGE;
  }
  const before = await writeBackup(db, opts.outDir, "setup-seed-before-restore");
  log.say(`  Joriy holat zaxirasi: ${before.file}`);
  let restored;
  try {
    restored = await restoreBackup(db, payload);
  } catch (err) {
    log.say(`  ❌ Qaytarib bo'lmadi: ${maskSecrets(err.message, process.env.MONGO_HOST)}`);
    log.say("     Joriy kolleksiyalarga tegilmadi (vaqtinchalik nusxalar o'chirildi).");
    log.say(`     Qaytarishdan oldingi holat zaxirasi: ${before.file}`);
    return EXIT.FAILED;
  }
  log.say(`  ✅ Qaytarildi: ${BACKUP_COLLECTIONS.map((n) => `${n} ${restored[n]}`).join(" · ")}`);
  log.say("  Backendni qayta yuklang: pm2 reload institute-ais");
  return EXIT.OK;
}

function printDrySummary(log, results) {
  const previewed = results.filter((r) => !r.skipped && r.ok);
  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.ok);
  log.say(`  Ko'rildi: ${previewed.length} · ko'rish rejimisiz (o'tkazildi): ${skipped.length} · ko'rib bo'lmadi: ${failed.length}`);
  const withRemovals = previewed.filter((r) => r.removals && r.removals.length);
  log.say("");
  if (withRemovals.length) {
    log.say("  Olib tashlanadigan yoki almashtiriladigan huquqlar (ko'rilgan seedlar bo'yicha):");
    for (const r of withRemovals) {
      log.say(`    ${r.step.title}:`);
      for (const l of r.removals.slice(0, 30)) log.say(`      ${l}`);
      if (r.removals.length > 30) log.say(`      … yana ${r.removals.length - 30} ta (to'liq ro'yxat logda)`);
    }
  } else {
    log.say("  Ko'rilgan seedlar chiqishida olib tashlash aniqlanmadi.");
  }
  if (skipped.length) {
    log.say("");
    log.say("  ⚠️ Ko'rish rejimi yo'q seedlar — haqiqiy ishga tushirishda o'z bo'limlarini kanonik holatga keltiradi,");
    log.say("     admin panelida shu bo'limlarga qo'lda qo'shilgan huquqlar qaytarilishi mumkin:");
    for (const r of skipped) log.say(`       · ${r.step.title}`);
  }
  for (const r of failed) {
    log.say(`  ⚠️ ${r.step.title}: ko'rib bo'lmadi (${r.reason}). Odatda ko'rish rejimisiz oldingi qadam yaratadigan`);
    log.say("     narsa hali bazada yo'qligi sababli; haqiqiy ishga tushirishda qadamlar tartib bilan bajariladi.");
  }
  for (const r of previewed.filter((x) => x.problems && x.problems.length)) {
    log.say(`  ⚠️ ${r.step.title}: ${r.problems.slice(0, 5).join(" | ")}`);
  }
  log.say("  Xulosa chiqishdan avtomatik ajratilgan — seedlarning to'liq chiqishi logda.");
}

function printSummary(log, { results, steps, checks, admin, backup, dry }) {
  log.say("");
  log.say(line());
  log.say(dry ? "  NATIJA (ko'rish rejimi — bazaga hech narsa yozilmadi)" : "  NATIJA");
  log.say(line());
  if (dry) {
    printDrySummary(log, results);
  } else {
    const done = results.filter((r) => r.ok && !r.skipped).length;
    const failed = results.find((r) => !r.ok);
    log.say(`  Seedlar: ${done}/${steps.length} bajarildi${failed ? ` · ✗ to'xtadi: ${failed.step.title}` : ""}`);
  }
  for (const c of checks) {
    log.say(`  ${c.ok ? "✅" : "❌"} ${c.name}: ${c.text}`);
    for (const d of c.detail || []) log.say(`       ${d}`);
  }
  if (admin) log.say(`  ${admin.ok ? (admin.pending ? "⚠️" : "✅") : "❌"} Birinchi administrator: ${admin.text}`);
  if (backup) log.say(`  Zaxira: ${backup.file}`);
  if (log.file) log.say(`  To'liq log: ${log.file}`);
}

async function main(argv = process.argv.slice(2)) {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`XATO: ${err.message}\n${HELP}`);
    return EXIT.USAGE;
  }
  if (opts.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }

  const log = createLogger(opts);
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !opts.yes);
  const uri = process.env.MONGO_HOST;
  const nodeEnv = String(process.env.NODE_ENV || "");

  log.say(line());
  log.say(`  SANFAK — seedlarni o'rnatish${opts.restore ? " · ZAXIRADAN QAYTARISH" : opts.dry ? " · KO'RISH REJIMI (--dry)" : ""}`);
  log.say(line());

  if (!uri) {
    log.say("  ❌ MONGO_HOST sozlanmagan (.env).");
    return EXIT.USAGE;
  }
  if (nodeEnv !== "production" && !opts.allowDev) {
    log.say(`  ❌ NODE_ENV "production" emas (hozir: "${nodeEnv || "bo'sh"}").`);
    log.say("     Production serverda .env ga NODE_ENV=production yozing.");
    log.say("     Dev/test bazasi bo'lsa: --allow-dev (dev muhitida ayrim seedlar sinov hisobini yaratadi).");
    return EXIT.USAGE;
  }
  if (nodeEnv !== "production") log.say(`  ⚠️ NODE_ENV="${nodeEnv}" — dev/test rejimi (--allow-dev).`);

  if (!opts.restore) {
    const planProblems = validatePlan();
    const rb = runbook.check();
    for (const f of [...rb.missingNoScript, ...rb.missingNotDocumented]) planProblems.push(`runbook: seed/${f} package.json yoki docs/DEPLOY.md da yo'q`);
    for (const f of rb.missingDevGuard) planProblems.push(`seed/${f}: DEV_ENVS qo'riqchisi yo'q`);
    if (planProblems.length) {
      log.say("  ❌ Seed rejasi tekshiruvdan o'tmadi:");
      for (const p of planProblems) log.say(`     - ${p}`);
      return EXIT.USAGE;
    }
  }

  let conn;
  try {
    conn = await connect(uri);
  } catch (err) {
    log.say(`  ❌ MongoDB'ga ulanib bo'lmadi: ${maskSecrets(err.message, uri)}`);
    return EXIT.USAGE;
  }
  const db = conn.db;
  let lockToken = null;
  const takeLock = async () => {
    const lock = await acquireLock(db, { force: opts.forceUnlock });
    if (lock.replaced) {
      const h = lock.replaced;
      const why = lock.stale ? "oldingi jarayon endi mavjud emas" : "--force-unlock";
      log.say(`  ⚠️ Qulf olib tashlandi (${why}): server ${h.host || "?"} · pid ${h.pid || "?"}`);
    }
    lockToken = lock.token;
  };
  const onSignal = () => {
    state.interrupted = true;
    if (state.child) state.child.kill();
  };
  const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const s of SIGNALS) process.on(s, onSignal);

  try {
    const before = await countState(db);
    log.say(`  Baza: ${db.databaseName} (${maskUri(uri)})`);
    log.say(`  NODE_ENV: ${nodeEnv || "bo'sh"}`);
    log.say(`  Hozirgi holat: ${before.permissiongroups} guruh · ${before.permissions} ruxsat · ${before.roles} rol · ${before.users} foydalanuvchi`);
    const fresh = before.permissiongroups === 0 && before.roles === 0;

    if (opts.restore) {
      await takeLock();
      return await runRestore(db, opts, log);
    }

    log.say("");
    printPlan(log, STEPS, opts);
    log.say("");

    if (opts.dry && fresh) {
      log.say("  Baza bo'sh — ko'rish rejimida ko'rsatadigan farq yo'q: barcha huquqlar yangidan yoziladi,");
      log.say("  hech narsa olib tashlanmaydi. O'rnatish uchun: yarn setup:seed");
      return EXIT.OK;
    }

    if (!opts.dry) {
      await takeLock();
      log.say(fresh ? "  Toza baza — barcha katalog va rollar yaratiladi." : "  Mavjud baza — katalog va rollar joriy versiyaga moslanadi (ayrim seedlar huquqlarni olib tashlaydi).");
      if (!fresh) log.say("  Oldin nimalar o'zgarishini ko'rish uchun: yarn setup:seed --dry");
      log.say(`  Yozishdan oldin ${BACKUP_COLLECTIONS.join(", ")} zaxiralanadi.`);
      if (!(await confirm(opts, "  Davom etamizmi? [ha/yo'q]: "))) {
        log.say("  Bekor qilindi — hech narsa o'zgarmadi.");
        return EXIT.USAGE;
      }
    }

    const runStamp = stamp();
    fs.mkdirSync(opts.outDir, { recursive: true });
    log.open(path.join(opts.outDir, `setup-seed-${opts.dry ? "dry-" : ""}${db.databaseName}-${runStamp}.log`));
    log.raw(`setup-seed · ${new Date().toISOString()} · ${opts.dry ? "dry" : "write"} · db=${db.databaseName} · host=${os.hostname()}\n`);

    let backup = null;
    if (!opts.dry) {
      backup = await writeBackup(db, opts.outDir, "setup-seed");
      log.say(`  Zaxira: ${backup.file}`);
    }

    log.say("");
    const env = childEnv();
    const results = await runSteps(STEPS, { dry: opts.dry, env, log, timeoutMs: STEP_TIMEOUT_MS });
    const interruptedExit = (checks = [], admin = null) => {
      log.say("  ✗ To'xtatildi (Ctrl+C yoki signal). Buyruqni qayta ishga tushiring — seedlar idempotent.");
      printSummary(log, { results, steps: STEPS, checks, admin, backup, dry: opts.dry });
      return EXIT.INTERRUPTED;
    };
    if (state.interrupted) return interruptedExit();

    if (opts.dry) {
      printSummary(log, { results, steps: STEPS, checks: [], admin: null, backup, dry: true });
      log.say(line());
      log.say("  ✅ Ko'rish tugadi. O'rnatish uchun: yarn setup:seed");
      return EXIT.OK;
    }

    const stepsOk = results.length === STEPS.length && results.every((r) => r.ok);
    let checks = [];
    let admin = null;
    if (stepsOk) {
      log.say("");
      log.say("  Yakuniy tekshiruvlar…");
      checks = await postChecks(db, { env, log, production: nodeEnv === "production" });
      if (state.interrupted) return interruptedExit(checks);
      admin = await firstAdminStep(db, { opts, env, log, interactive });
      if (state.interrupted || (admin && admin.interrupted)) return interruptedExit(checks, admin);
    }

    printSummary(log, { results, steps: STEPS, checks, admin, backup, dry: false });
    const ok = stepsOk && checks.every((c) => c.ok) && (!admin || admin.ok);
    log.say(line());
    if (!ok) {
      if (!stepsOk) {
        log.say("  ❌ Seedlar to'liq bajarilmadi. Yuqoridagi xatoni tuzatib, buyruqni qayta ishga tushiring —");
        log.say("     seedlar idempotent, qayta ishga tushirish xavfsiz.");
        if (backup) log.say(`     Oldingi holatga qaytarish kerak bo'lsa: yarn setup:seed --restore "${backup.file}"`);
      } else {
        log.say("  ❌ Seedlar muvaffaqiyatli yozildi, lekin yuqoridagi tekshiruv(lar) o'tmadi — ko'rsatilgan tuzatishni");
        log.say("     bajaring va buyruqni qayta ishga tushiring. Zaxiradan qaytarish bu holatda KERAK EMAS.");
      }
      return EXIT.FAILED;
    }
    log.say("  ✅ Tayyor. Keyingi qadam — backendni qayta yuklang:");
    log.say("       pm2 reload institute-ais");
    log.say("     va logda \"[RBAC] Integrity OK\" qatorini tekshiring.");
    return EXIT.OK;
  } catch (err) {
    if (err instanceof LockError) {
      const h = err.holder || {};
      log.say("  ❌ Boshqa setup:seed jarayoni ishlayapti yoki to'xtab qolgan:");
      log.say(`     boshlangan: ${h.startedAt ? new Date(h.startedAt).toISOString() : "?"} · server: ${h.host || "?"} · pid: ${h.pid || "?"}`);
      log.say("     U tugashini kuting. Jarayon yo'qligiga ishonchingiz komil bo'lsa: --force-unlock");
      return EXIT.USAGE;
    }
    if (err instanceof UsageError) {
      log.say(`  ❌ ${err.message}`);
      return EXIT.USAGE;
    }
    if (err && err.message === "INTERRUPTED") {
      log.say("  ✗ To'xtatildi.");
      return EXIT.INTERRUPTED;
    }
    log.say(`  ❌ Kutilmagan xato: ${maskSecrets(err && err.stack ? err.stack : String(err), uri)}`);
    return EXIT.FAILED;
  } finally {
    for (const s of SIGNALS) process.removeListener(s, onSignal);
    try {
      await releaseLock(db, lockToken);
    } catch (err) {
      log.say(`  ⚠️ Qulfni bo'shatib bo'lmadi: ${err.message} — keyingi safar --force-unlock kerak bo'ladi`);
    }
    await conn.close().catch(() => undefined);
  }
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`XATO: ${maskSecrets(err && err.stack ? err.stack : String(err), process.env.MONGO_HOST)}\n`);
      process.exit(EXIT.FAILED);
    },
  );
}

module.exports = {
  EXIT,
  PROBLEM_PATTERNS,
  BACKUP_COLLECTIONS,
  UsageError,
  parseCli,
  maskUri,
  maskSecrets,
  findProblemLines,
  findRemovalLines,
  evaluateStep,
  validatePlan,
  runNode,
  runSteps,
  writeBackup,
  readBackup,
  restoreBackup,
  acquireLock,
  releaseLock,
  parseFullName,
  createHiddenInput,
  main,
};
