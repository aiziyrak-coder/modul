"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const { runSteps, EXIT } = require("../../scripts/setup-seed");
const { STEPS } = require("../../seed/_deploy-plan");

const REPO_ROOT = path.join(__dirname, "../..");
const RUNNER = path.join(REPO_ROOT, "scripts/setup-seed.js");
const RAW_COLLECTIONS = ["roles", "permissions", "permissiongroups", "users", "setupseedlocks"];
const RUN_TIMEOUT = 300000;

const coll = (name) => mongoose.connection.db.collection(name);

function sharedMongoUri() {
  const { host, port, name } = mongoose.connection;
  return `mongodb://${host}:${port}/${name}`;
}

function run(args, env = {}) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(process.execPath, [RUNNER, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, MONGO_HOST: sharedMongoUri(), NODE_ENV: "production", ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => chunks.push(d));
    child.stderr.on("data", (d) => chunks.push(d));
    child.on("close", (code) => resolve({ code, out: Buffer.concat(chunks).toString("utf8") }));
  });
}

async function wipe() {
  for (const name of RAW_COLLECTIONS) await coll(name).deleteMany({});
}

async function rolesState() {
  const roles = await coll("roles").find({}).toArray();
  return roles
    .map((r) => ({
      title: r.title,
      active: r.active,
      scopeLevel: r.scopeLevel,
      permissions: (r.permissions || [])
        .map((p) => `${p.section}:${[...(p.actionKeys || [])].sort().join(",")}`)
        .sort(),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

async function catalogState() {
  const docs = await coll("permissions").find({}).toArray();
  return docs
    .map((p) => ({ section: p.section, active: p.active, actionKeys: [...(p.actionKeys || [])].sort(), title: p.title }))
    .sort((a, b) => a.section.localeCompare(b.section));
}

async function documentHash() {
  const parts = [];
  for (const name of ["roles", "permissions", "permissiongroups", "users"]) {
    parts.push(JSON.stringify(await coll(name).find({}).sort({ _id: 1 }).toArray()));
  }
  return parts.join("|");
}

let outDir;

beforeAll(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-seed-it-"));
});

afterAll(() => {
  fs.rmSync(outDir, { recursive: true, force: true });
});

describe("Integration — yarn setup:seed (bola-process)", () => {
  beforeAll(wipe);

  test("toza baza: barcha qadamlar, drift yo'q, admin roli yo'q, foydalanuvchi yaratilmaydi", async () => {
    const r = await run(["--yes", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain(`Seedlar: ${STEPS.length}/${STEPS.length} bajarildi`);
    expect(r.out).toContain("Ruxsatlar katalogi drifti: drift yo'q");
    expect(r.out).toContain("Birinchi administrator: yaratilmagan");
    expect(await coll("permissiongroups").countDocuments()).toBeGreaterThan(0);
    expect(await coll("permissions").countDocuments()).toBeGreaterThan(100);
    expect(await coll("roles").findOne({ title: "super_admin" })).not.toBeNull();
    expect(await coll("roles").findOne({ title: "admin" })).toBeNull();
    expect(await coll("users").countDocuments()).toBe(0);
    expect(await coll("setupseedlocks").countDocuments()).toBe(0);
    const indexes = await coll("users").indexes();
    expect(indexes.map((i) => i.name)).toContain("oneIdPin_unique_partial");
    const files = fs.readdirSync(outDir);
    expect(files.some((f) => /^setup-seed-.*\.json$/.test(f))).toBe(true);
    expect(files.some((f) => /^setup-seed-.*\.log$/.test(f))).toBe(true);
  }, RUN_TIMEOUT);

  test("katalogda route'lar talab qiladigan amallar bor (drift tuzatishi)", async () => {
    const actions = async (section) => (await coll("permissions").findOne({ section })).actionKeys;
    expect(await actions("councilTask")).toEqual(expect.arrayContaining(["approve", "reject", "changeStatus"]));
    expect(await actions("votingSession")).toEqual(expect.arrayContaining(["changeStatus"]));
    expect(await actions("residentAttendance")).toEqual(expect.arrayContaining(["approve"]));
    expect(await actions("eqAnnouncement")).toEqual(expect.arrayContaining(["readAll", "update"]));
  });

  test("qayta ishga tushirish idempotent: rollar va katalog o'zgarmaydi", async () => {
    const roles = await rolesState();
    const catalog = await catalogState();
    const r = await run(["--yes", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.OK);
    expect(await rolesState()).toEqual(roles);
    expect(await catalogState()).toEqual(catalog);
  }, RUN_TIMEOUT);

  test("--dry: hech narsa yozmaydi va olib tashlanadigan huquqlarni ko'rsatadi", async () => {
    await coll("roles").updateOne(
      { title: "rektor", "permissions.section": "taskCategory" },
      { $addToSet: { "permissions.$.actionKeys": "delete" } },
    );
    const before = await documentHash();
    const r = await run(["--dry", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("bazaga hech narsa yozilmadi");
    expect(r.out).toContain("Olib tashlanadigan yoki almashtiriladigan huquqlar");
    expect(r.out).toMatch(/\[rektor\] taskCategory-\[delete\]/);
    expect(await documentHash()).toBe(before);
    expect(await coll("setupseedlocks").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("zaxiradan qaytarish: buzilgan rol oldingi holatiga qaytadi", async () => {
    const r1 = await run(["--yes", "--out-dir", outDir]);
    expect(r1.code).toBe(EXIT.OK);
    const expected = await rolesState();
    const backup = r1.out.match(/Zaxira: (.+\.json)/)[1].trim();
    const r2 = await run(["--yes", "--out-dir", outDir]);
    expect(r2.code).toBe(EXIT.OK);
    const latestBackup = r2.out.match(/Zaxira: (.+\.json)/)[1].trim();
    expect(latestBackup).not.toBe(backup);
    await coll("roles").updateOne({ title: "rektor" }, { $set: { permissions: [] } });
    await coll("roles").insertOne({ title: "ortiqcha_rol", permissions: [] });
    const indexNames = async (name) => (await coll(name).indexes()).map((i) => i.name).sort();
    const indexesBefore = { roles: await indexNames("roles"), permissions: await indexNames("permissions") };
    const restore = await run(["--restore", latestBackup, "--yes", "--out-dir", outDir]);
    expect(restore.code).toBe(EXIT.OK);
    expect(restore.out).toContain("Qaytarildi:");
    expect(await rolesState()).toEqual(expected);
    expect(fs.readdirSync(outDir).some((f) => f.startsWith("setup-seed-before-restore-"))).toBe(true);
    expect({ roles: await indexNames("roles"), permissions: await indexNames("permissions") }).toEqual(indexesBefore);
    const names = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(names.filter((n) => n.includes("__setup_seed_restore"))).toEqual([]);
  }, RUN_TIMEOUT * 2);

  test("buzilgan zaxira qaytarilmaydi — joriy kolleksiyalarga tegilmaydi", async () => {
    const file = fs.readdirSync(outDir).filter((f) => /^setup-seed-(?!before)[^/]*\.json$/.test(f)).sort().pop();
    const payload = JSON.parse(fs.readFileSync(path.join(outDir, file), "utf8"));
    const roles = payload.collections.roles;
    expect(roles.length).toBeGreaterThan(1);
    roles[1] = { ...roles[1], _id: { $oid: "0123456789abcdef01234567" }, title: roles[0].title };
    const broken = path.join(outDir, "broken.json");
    fs.writeFileSync(broken, JSON.stringify(payload));
    const before = await documentHash();
    const r = await run(["--restore", broken, "--yes", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.FAILED);
    expect(r.out).toContain("Joriy kolleksiyalarga tegilmadi");
    expect(await documentHash()).toBe(before);
    const names = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    expect(names.filter((n) => n.includes("__setup_seed_restore"))).toEqual([]);
  }, RUN_TIMEOUT);

  test("boshqa bazadan olingan zaxira --allow-other-db siz qaytarilmaydi", async () => {
    const file = fs.readdirSync(outDir).find((f) => /^setup-seed-.*\.json$/.test(f) && !f.includes("before-restore"));
    const src = fs.readFileSync(path.join(outDir, file), "utf8");
    const foreign = path.join(outDir, "foreign.json");
    const replaced = src.replace(/"db":\s*"[^"]+"/, '"db": "boshqa_baza"');
    expect(replaced).not.toBe(src);
    fs.writeFileSync(foreign, replaced);
    const before = await documentHash();
    const r = await run(["--restore", foreign, "--yes", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.USAGE);
    expect(r.out).toContain("--allow-other-db");
    expect(await documentHash()).toBe(before);
  }, RUN_TIMEOUT);
});

describe("Integration — yarn setup:seed xavfsizlik qo'riqchilari", () => {
  beforeEach(wipe);

  test("NODE_ENV production emas — to'xtaydi, hech narsa yozmaydi", async () => {
    const r = await run(["--yes", "--out-dir", outDir], { NODE_ENV: "development" });
    expect(r.code).toBe(EXIT.USAGE);
    expect(r.out).toContain("NODE_ENV \"production\" emas");
    expect(await coll("permissiongroups").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("terminal yo'q va --yes berilmagan — tasdiqsiz yozmaydi", async () => {
    const r = await run(["--out-dir", outDir]);
    expect(r.code).toBe(EXIT.USAGE);
    expect(r.out).toContain("--yes");
    expect(await coll("permissiongroups").countDocuments()).toBe(0);
    expect(await coll("setupseedlocks").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("qulf band — ikkinchi jarayon to'xtaydi; --force-unlock bilan davom etadi", async () => {
    await coll("setupseedlocks").insertOne({ _id: "setup-seed", token: "x", pid: 1, host: "boshqa-server", startedAt: new Date() });
    const blocked = await run(["--yes", "--out-dir", outDir]);
    expect(blocked.code).toBe(EXIT.USAGE);
    expect(blocked.out).toContain("boshqa-server");
    expect(await coll("permissiongroups").countDocuments()).toBe(0);
    const forced = await run(["--yes", "--force-unlock", "--out-dir", outDir]);
    expect(forced.code).toBe(EXIT.OK);
    expect(forced.out).toContain("Qulf olib tashlandi (--force-unlock)");
    expect(await coll("setupseedlocks").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("shu serverdagi, jarayoni tugagan qulf eskirgan deb olib tashlanadi", async () => {
    await coll("setupseedlocks").insertOne({ _id: "setup-seed", token: "y", pid: 2147483600, host: os.hostname(), startedAt: new Date() });
    const r = await run(["--yes", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("oldingi jarayon endi mavjud emas");
    expect(await coll("setupseedlocks").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("bo'sh bazada --dry — seedlarni ishga tushirmaydi", async () => {
    const r = await run(["--dry", "--out-dir", outDir]);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toContain("Baza bo'sh");
    expect(await coll("permissiongroups").countDocuments()).toBe(0);
  }, RUN_TIMEOUT);

  test("MongoDB'ga ulanib bo'lmasa — exit 2, parol ekranga chiqmaydi", async () => {
    const r = await run(["--yes", "--out-dir", outDir], { MONGO_HOST: "mongodb://user:TopSecret9@127.0.0.1:1/x?serverSelectionTimeoutMS=500" });
    expect(r.code).toBe(EXIT.USAGE);
    expect(r.out).toContain("MongoDB'ga ulanib bo'lmadi");
    expect(r.out).not.toContain("TopSecret9");
  }, RUN_TIMEOUT);
});

describe("Integration — runSteps: birinchi xatoda to'xtaydi", () => {
  let dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "setup-seed-steps-"));
  });
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  const script = (name, body) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, body);
    return file;
  };
  const step = (id, file) => ({ id, phase: "roles", file, script: null, args: [], dryArgs: null, title: id });
  const quietLog = () => {
    const lines = [];
    return { lines, say: (t) => lines.push(t), raw: () => undefined, file: null };
  };

  test("exit 0 + [SKIP] — qadam xato, keyingisi ishga tushmaydi", async () => {
    const marker = path.join(dir, "marker-1");
    const steps = [
      step("ok", script("ok.js", "console.log('hammasi joyida');")),
      step("skip", script("skip.js", "console.warn('  [SKIP] rol topilmadi: \"moderator\"');")),
      step("next", script("next.js", `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x');`)),
    ];
    const log = quietLog();
    const results = await runSteps(steps, { dry: false, env: process.env, log, timeoutMs: 20000 });
    expect(results.map((r) => [r.step.id, r.ok])).toEqual([["ok", true], ["skip", false]]);
    expect(fs.existsSync(marker)).toBe(false);
  }, 60000);

  test("nol bo'lmagan exit — to'xtaydi va chiqish oxiri ko'rsatiladi", async () => {
    const steps = [step("fail", script("fail.js", "console.error('XATO: ulanish'); process.exit(3);")), step("never", script("never.js", ""))];
    const log = quietLog();
    const results = await runSteps(steps, { dry: false, env: process.env, log, timeoutMs: 20000 });
    expect(results).toHaveLength(1);
    expect(results[0].reason).toBe("exit 3");
    expect(log.lines.join("\n")).toContain("XATO: ulanish");
  }, 60000);

  test("osilib qolgan qadam vaqt tugagach to'xtatiladi", async () => {
    const steps = [step("hang", script("hang.js", "setInterval(() => {}, 1000);"))];
    const results = await runSteps(steps, { dry: false, env: process.env, log: quietLog(), timeoutMs: 1500 });
    expect(results[0].ok).toBe(false);
    expect(results[0].reason).toMatch(/vaqt tugadi/);
  }, 60000);
});
