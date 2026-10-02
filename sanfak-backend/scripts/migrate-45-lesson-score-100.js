"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");
const SCRIPT = "migrate-45-lesson-score-100";
const SENTINEL_ID = SCRIPT;
const RUNS = "migrationruns";
const LEGACY_MAX = 10;
const CHUNK_SIZE = 1000;
const SAMPLE = 20;

const TARGETS = Object.freeze([
  Object.freeze({
    key: "rosters",
    model: Roster,
    revField: "scoredAt",
    revBound: (cutoff) => cutoff,
    flags: { cancelled: (d) => d.cancelledAt != null, notPresent: (d) => d.outcome !== "present" },
  }),
  Object.freeze({
    key: "attendances",
    model: Attendance,
    revField: "scoreRev",
    revBound: (cutoff) => cutoff.getTime(),
    flags: { deleted: (d) => d.deletedAt != null, notPresent: (d) => d.status !== "present" },
    touched: (d, cutoff) => d.session == null && revOf(d.updatedAt) >= cutoff.getTime(),
  }),
]);
const KEYS = TARGETS.map((t) => t.key);
const PROJECTION = Object.freeze({
  score: 1, scoredAt: 1, scoreRev: 1, deletedAt: 1, cancelledAt: 1,
  outcome: 1, status: 1, session: 1, createdAt: 1, updatedAt: 1,
});

const raw = (name) => mongoose.connection.db.collection(name);
const runs = () => raw(RUNS);
const nameOf = (target) => target.model.collection.collectionName;
const currentDb = () => mongoose.connection.db.databaseName;

function* chunks(list, size = CHUNK_SIZE) {
  for (let i = 0; i < list.length; i += size) yield list.slice(i, i + size);
}

const toHundredScale = (v) => Math.round(v * 1000) / 100;

function classify(score) {
  if (typeof score !== "number") return "skip";
  if (!Number.isFinite(score) || score < 0 || score > LEGACY_MAX) return "anomaly";
  return score === 0 ? "zero" : "legacy";
}

function revOf(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  return typeof v === "string" ? Date.parse(v) : NaN;
}

function inScope(doc, revField, cutoff) {
  if (!cutoff) return true;
  const rev = revOf(doc[revField]);
  return rev === null || rev < cutoff.getTime();
}

const sampleOf = (key, d) => `${key}:${d._id}:${d.score}`;
const pushSample = (list, value) => {
  if (list.length < SAMPLE) list.push(value);
};
const widen = (range, v) => {
  if (v == null) return;
  if (range.min == null || v < range.min) range.min = v;
  if (range.max == null || v > range.max) range.max = v;
};

const emptyStats = (target) => ({
  scored: 0, legacy: 0, zero: 0, anomaly: 0, anomalies: [],
  excluded: 0, excludedLow: 0, excludedLowList: [], touched: 0, touchedList: [],
  split: Object.fromEntries(Object.keys(target.flags).map((f) => [f, 0])),
  score: {}, createdAt: {}, updatedAt: {},
});

function tallyLegacy(stats, target, doc, cutoff) {
  for (const [flag, test] of Object.entries(target.flags)) if (test(doc)) stats.split[flag] += 1;
  if (cutoff && target.touched?.(doc, cutoff)) {
    stats.touched += 1;
    pushSample(stats.touchedList, sampleOf(target.key, doc));
  }
}

function tally(stats, target, doc, cutoff, entries) {
  const kind = classify(doc.score);
  if (kind === "skip") return;
  stats.scored += 1;
  widen(stats.score, doc.score);
  widen(stats.createdAt, revOf(doc.createdAt));
  widen(stats.updatedAt, revOf(doc.updatedAt));
  if (!inScope(doc, target.revField, cutoff)) {
    stats.excluded += 1;
    if (doc.score <= LEGACY_MAX) {
      stats.excludedLow += 1;
      pushSample(stats.excludedLowList, sampleOf(target.key, doc));
    }
    return;
  }
  stats[kind] += 1;
  if (kind === "anomaly") pushSample(stats.anomalies, sampleOf(target.key, doc));
  if (kind !== "legacy") return;
  entries.push({ coll: target.key, _id: doc._id, old: doc.score, next: toHundredScale(doc.score) });
  tallyLegacy(stats, target, doc, cutoff);
}

function buildPlan(docsByKey, cutoff = null) {
  const entries = [];
  const stats = {};
  for (const target of TARGETS) {
    stats[target.key] = emptyStats(target);
    for (const doc of docsByKey[target.key] || []) tally(stats[target.key], target, doc, cutoff, entries);
  }
  return { entries, stats };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const FLAGS = ["--apply", "--allow-other-db"];
const VALUED = ["--db", "--revert", "--graded-before", "--anomalies"];

function parseCutoff(value, now) {
  if (value == null) return { cutoff: null };
  if (!ISO_RE.test(value) || Number.isNaN(Date.parse(value))) {
    return { error: `--graded-before ISO vaqt bo'lsin, vaqt zonasi bilan (masalan 2026-10-05T04:12:00Z): "${value}"` };
  }
  const cutoff = new Date(value);
  if (cutoff > now) return { error: "--graded-before kelajakda — yangi kodni yuklagan reload BOSHLANGAN vaqtini bering" };
  return { cutoff };
}

function usageError(args) {
  if (args.apply && args.revertFile) return "--apply va --revert birga bo'lmaydi";
  if (args.apply && !args.cutoff) return "--apply uchun --graded-before=<yangi kodni yuklagan reload BOSHLANGAN vaqti, ISO> MAJBURIY";
  if (args.anomaliesRaw != null && args.anomaliesRaw !== "keep") return "--anomalies faqat =keep";
  return null;
}

function parseArgs(argv, now = new Date()) {
  const value = (flag) => {
    const a = argv.find((x) => x.startsWith(`${flag}=`));
    return a ? a.slice(flag.length + 1) : null;
  };
  const unknown = argv.find((a) => !FLAGS.includes(a) && !VALUED.some((f) => a.startsWith(`${f}=`)));
  const anomaliesRaw = value("--anomalies");
  const parsed = parseCutoff(value("--graded-before"), now);
  const args = {
    apply: argv.includes("--apply"),
    allowOtherDb: argv.includes("--allow-other-db"),
    dbName: value("--db"),
    revertFile: value("--revert"),
    cutoff: parsed.cutoff ?? null,
    anomaliesRaw,
    anomalies: anomaliesRaw === "keep" ? "keep" : "refuse",
  };
  args.error = unknown ? `noma'lum bayroq: ${unknown}` : parsed.error || usageError(args);
  return args;
}

const refusal = (code, message) => ({ code, message, exit: code === "anomalies" ? 1 : 2 });

function exitCodeFor(result) {
  if (result.refused) return result.refused.exit;
  if (result.applied?.other.length) return 1;
  if (result.reverted?.other.length) return 1;
  return 0;
}

async function loadScored(target) {
  return raw(nameOf(target))
    .find({ score: { $type: "number" } }, { projection: PROJECTION })
    .toArray();
}

async function frameRowMismatch() {
  const frames = await raw(nameOf(TARGETS[0]))
    .find({ outcome: "present", cancelledAt: null, attendance: { $ne: null } }, { projection: { score: 1, attendance: 1 } })
    .toArray();
  let n = 0;
  for (const chunk of chunks(frames)) {
    const rows = await raw(nameOf(TARGETS[1]))
      .find({ _id: { $in: chunk.map((f) => f.attendance) } }, { projection: { score: 1 } })
      .toArray();
    const byId = new Map(rows.map((r) => [String(r._id), r.score ?? null]));
    for (const f of chunk) {
      const id = String(f.attendance);
      if (byId.has(id) && byId.get(id) !== (f.score ?? null)) n += 1;
    }
  }
  return n;
}

const nonNumeric = (target) =>
  raw(nameOf(target)).countDocuments({ score: { $nin: [null], $not: { $type: "number" } } });

async function survey(cutoff) {
  const docsByKey = {};
  for (const target of TARGETS) docsByKey[target.key] = await loadScored(target);
  const plan = buildPlan(docsByKey, cutoff);
  const counts = await Promise.all(TARGETS.map(nonNumeric));
  return {
    ...plan,
    info: {
      nonNumeric: Object.fromEntries(KEYS.map((k, i) => [k, counts[i]])),
      frameRowMismatch: await frameRowMismatch(),
    },
  };
}

const scopeGuard = (target, cutoff) => ({
  $or: [{ [target.revField]: null }, { [target.revField]: { $lt: target.revBound(cutoff) } }],
});

async function casChunk(name, chunk, from, to, out, guard = null) {
  const ops = chunk.map((e) => ({
    updateOne: { filter: { _id: e._id, score: e[from], ...guard }, update: { $set: { score: e[to] } } },
  }));
  const res = await raw(name).bulkWrite(ops, { ordered: false });
  const modified = res.modifiedCount ?? 0;
  out.modified += modified;
  if (modified === chunk.length) return;
  const docs = await raw(name)
    .find({ _id: { $in: chunk.map((e) => e._id) } }, { projection: { score: 1 } })
    .toArray();
  const byId = new Map(docs.map((d) => [String(d._id), d.score]));
  let atTarget = 0;
  for (const e of chunk) {
    const id = String(e._id);
    if (!byId.has(id)) out.gone += 1;
    else if (byId.get(id) === e[to]) atTarget += 1;
    else out.other.push(`${e.coll}:${id}:${byId.get(id)}`);
  }
  out.atTarget += Math.max(0, atTarget - modified);
}

async function casAll(entries, from, to, cutoff = null) {
  const out = { planned: entries.length, modified: 0, atTarget: 0, gone: 0, other: [] };
  for (const target of TARGETS) {
    const list = entries.filter((e) => e.coll === target.key);
    const guard = cutoff ? scopeGuard(target, cutoff) : null;
    for (const chunk of chunks(list)) await casChunk(nameOf(target), chunk, from, to, out, guard);
  }
  return out;
}

const backupBody = (entries, meta) => ({
  script: SCRIPT,
  db: meta.db,
  runId: meta.runId,
  createdAt: meta.createdAt.toISOString(),
  cutoff: meta.cutoff.toISOString(),
  anomalies: meta.anomalies,
  collections: Object.fromEntries(TARGETS.map((t) => [t.key, nameOf(t)])),
  entries: entries.map((e) => ({ coll: e.coll, _id: String(e._id), old: e.old, next: e.next })),
});

function saveBackup(entries, meta, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const file = path.join(backupDir, `lesson-score-100-${meta.db}-${meta.runId}.json`);
  fs.writeFileSync(file, JSON.stringify(backupBody(entries, meta), null, 2), { flag: "wx" });
  return file;
}

const sumOf = (stats, field) => KEYS.reduce((n, k) => n + stats[k][field], 0);

async function claimSentinel(result, meta) {
  try {
    await runs().insertOne({
      _id: SENTINEL_ID, db: meta.db, runId: meta.runId, state: "started", backup: result.backup,
      cutoff: meta.cutoff, anomalies: meta.anomalies, planned: result.entries.length, startedAt: new Date(),
    });
    return true;
  } catch (err) {
    if (err?.code !== 11000) throw err;
    fs.rmSync(result.backup, { force: true });
    result.backup = null;
    result.refused = refusal("already_applied", "sentinel bor — bu bazada --apply allaqachon bajarilgan");
    return false;
  }
}

async function applyPlan(result, meta, backupDir) {
  result.backup = saveBackup(result.entries, meta, backupDir);
  if (!(await claimSentinel(result, meta))) return result;
  result.applied = await casAll(result.entries, "old", "next", meta.cutoff);
  result.applied.stillLow = result.entries.filter((e) => e.next <= LEGACY_MAX).length;
  const { other, ...counts } = result.applied;
  await runs().updateOne(
    { _id: SENTINEL_ID, runId: meta.runId },
    { $set: { state: "done", finishedAt: new Date(), counts: { ...counts, raced: other.length }, raced: other } },
  );
  return result;
}

async function migrate({ apply = false, cutoff = null, anomalies = "refuse", backupDir = BACKUP_DIR, now = new Date() } = {}) {
  const sentinel = await runs().findOne({ _id: SENTINEL_ID });
  const effective = cutoff ?? (!apply && sentinel?.cutoff ? new Date(sentinel.cutoff) : null);
  const result = { db: currentDb(), cutoff: effective, cutoffFromSentinel: !cutoff && !!effective, sentinel };
  Object.assign(result, await survey(effective), { refused: null, backup: null, applied: null });
  if (!apply) return result;
  if (!cutoff) {
    result.refused = refusal("usage", "--apply uchun --graded-before MAJBURIY");
    return result;
  }
  if (sentinel) {
    result.refused = refusal("already_applied", `sentinel bor (holati: ${sentinel.state}) — --apply qayta bajarilmaydi`);
    return result;
  }
  const anomalyCount = sumOf(result.stats, "anomaly");
  if (anomalyCount > 0 && anomalies !== "keep") {
    result.refused = refusal("anomalies", `${anomalyCount} ta anomaliya — qo'lda ko'rib chiqing yoki --anomalies=keep`);
    return result;
  }
  const meta = { db: result.db, runId: now.toISOString().replace(/[:.]/g, "-"), createdAt: now, cutoff, anomalies };
  return applyPlan(result, meta, backupDir);
}

const toId = (s) => (/^[0-9a-f]{24}$/i.test(s) ? new mongoose.Types.ObjectId(s) : s);

function readBackup(file, allowOtherDb) {
  let backup;
  try {
    backup = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    return { refused: refusal("bad_backup", `${file} — o'qib bo'lmadi: ${err.message}`) };
  }
  const shapeOk = backup?.script === SCRIPT && typeof backup.runId === "string" && Array.isArray(backup.entries) &&
    backup.entries.every((e) => KEYS.includes(e.coll) && typeof e.old === "number" && typeof e.next === "number");
  if (!shapeOk) return { refused: refusal("bad_backup", `${file} — bu skriptning zaxirasi emas yoki buzuq`) };
  if (backup.db !== currentDb() && !allowOtherDb) {
    return {
      refused: refusal("other_db", `${file} — "${backup.db}" bazasining zaxirasi, ulangan baza "${currentDb()}". Ataylab bo'lsa: --allow-other-db`),
    };
  }
  return { backup };
}

async function revert({ file, allowOtherDb = false }) {
  const { backup, refused } = readBackup(file, allowOtherDb);
  if (refused) return { refused };
  const sentinel = await runs().findOne({ _id: SENTINEL_ID });
  if (sentinel && sentinel.runId !== backup.runId) {
    return { refused: refusal("other_run", `sentinel boshqa yugurishniki (runId ${sentinel.runId}) — bu zaxira (${backup.runId}) emas`) };
  }
  const entries = backup.entries.map((e) => ({ ...e, _id: toId(e._id) }));
  const reverted = await casAll(entries, "next", "old");
  if (reverted.other.length === 0) {
    if (sentinel) await runs().deleteOne({ _id: SENTINEL_ID, runId: backup.runId });
    return { refused: null, reverted, sentinel: sentinel ? "deleted" : "none" };
  }
  await runs().updateOne(
    { _id: SENTINEL_ID },
    {
      $set: { state: "reverted-partial", revertedAt: new Date(), skipped: reverted.other },
      $setOnInsert: { db: backup.db, runId: backup.runId, backup: file },
    },
    { upsert: true },
  );
  return { refused: null, reverted, sentinel: "reverted-partial" };
}

const iso = (ms) => (ms == null ? "—" : new Date(ms).toISOString());
const list = (items) => (items.length ? items.join(", ") : "—");

function printStats(key, s, info, sentinel) {
  log(`  [${key}] ball qo'yilgan: ${s.scored}  (min ${s.score.min ?? "—"}, max ${s.score.max ?? "—"};` +
    ` raqam bo'lmagan ball: ${info.nonNumeric[key]})`);
  log(`     eski (0 < s ≤ 10) — rejada: ${s.legacy}  · nol: ${s.zero}` +
    `  · bo'linma: ${Object.entries(s.split).map(([f, n]) => `${f} ${n}`).join(", ")}`);
  log(`     ${sentinel ? "> 10 (sentinel bor — 100 ballik, anomaliya EMAS)" : "🔴 anomaliya (< 0, > 10)"}: ${s.anomaly}` +
    (sentinel ? "" : `  ${list(s.anomalies)}`));
  log(`     kesimdan chetda: ${s.excluded}; shundan ≤ 10: ${s.excludedLow}  ${list(s.excludedLowList)}`);
  if (s.touched) log(`     ⚠️ kesimdan keyin tegilgan qo'lda qator (scoreRev yo'q): ${s.touched}  ${list(s.touchedList)}`);
  log(`     createdAt: ${iso(s.createdAt.min)} .. ${iso(s.createdAt.max)} · updatedAt: ${iso(s.updatedAt.min)} .. ${iso(s.updatedAt.max)}`);
}

function printSentinel(r) {
  const s = r.sentinel;
  if (!s) return log("  Sentinel: yo'q (bu bazada --apply bajarilmagan)");
  log(`  Sentinel: ${s.state} · runId ${s.runId} · kesim ${iso(revOf(s.cutoff))} · zaxira ${s.backup ?? "—"}`);
  if (s.state === "started") log("  🔴 oldingi --apply uzilgan: --revert=<shu zaxira>, so'ng yangi --apply");
  if (s.state === "reverted-partial") log(`  🔴 qisman qaytarilgan — tegilmagan: ${list(s.skipped || [])}`);
  if (s.state !== "done") return;
  const legacy = sumOf(r.stats, "legacy");
  const expected = s.counts?.stillLow ?? 0;
  log(`  Post-check: qamrovdagi ≤ 10: ${legacy}, kutilgan ${expected} (yangi qiymati ≤ 10 bo'lgan reja yozuvlari)` +
    (legacy === expected ? " ✅" : " 🔴 farq — tekshiring"));
}

function printApplied(r) {
  const x = r.applied;
  log(`  ✅ KO'CHIRILDI: ${x.modified} / ${x.planned}  (converged ${x.atTarget}, gone ${x.gone}; yangi qiymati ≤ 10: ${x.stillLow})`);
  if (x.other.length) log(`  🔴 RACED ${x.other.length} — rejadan keyin o'zgargan, tegilmadi: ${list(x.other)}`);
  log(`  Zaxira: ${r.backup}  ← bu yo'lni saqlang (qaytarish uchun kerak)`);
}

function printReport(r, apply) {
  line("═");
  log("  4.5 — dars bali 0..10 → 0..100 (×10)");
  log(`  Baza: ${r.db} · kesim (--graded-before): ${r.cutoff ? r.cutoff.toISOString() : "berilmagan — hamma qamrovda"}` +
    (r.cutoffFromSentinel ? " (sentineldan)" : ""));
  line("═");
  for (const key of KEYS) printStats(key, r.stats[key], r.info, r.sentinel);
  log(`  Ma'lumot: present freym bahosi qatordagidan farqli: ${r.info.frameRowMismatch}`);
  printSentinel(r);
  line();
  if (r.refused) log(`  ⛔ RAD (exit ${r.refused.exit}): ${r.refused.message}`);
  else if (apply) printApplied(r);
  else log(`  DRY-RUN — hech narsa yozilmadi. Rejada ${r.entries.length}. Yozish: --graded-before=<…> --apply`);
  line("═");
}

function printRevert(r, dbName) {
  log(`  Baza: ${dbName}`);
  if (r.refused) return log(`  ⛔ RAD (exit ${r.refused.exit}): ${r.refused.message}`);
  const x = r.reverted;
  log(`  QAYTARISH: zaxirada ${x.planned}, qaytarildi ${x.modified}, already-old ${x.atTarget}, gone ${x.gone}`);
  if (x.other.length) log(`  ⚠️ tegilmadi (zaxiradan keyin tahrirlangan) ${x.other.length}: ${list(x.other)}`);
  log(`  Sentinel: ${r.sentinel}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`XATO: ${args.error}`);
    process.exit(2);
  }
  if (!process.env.MONGO_HOST) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(2);
  }
  const opts = { serverSelectionTimeoutMS: 5000, autoIndex: false, autoCreate: false };
  if (args.dbName) opts.dbName = args.dbName;
  await mongoose.connect(process.env.MONGO_HOST, opts);
  try {
    if (args.revertFile) {
      const r = await revert({ file: args.revertFile, allowOtherDb: args.allowOtherDb });
      printRevert(r, currentDb());
      process.exitCode = exitCodeFor(r);
      return;
    }
    const result = await migrate({ apply: args.apply, cutoff: args.cutoff, anomalies: args.anomalies });
    printReport(result, args.apply);
    process.exitCode = exitCodeFor(result);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("XATO:", err.message);
    mongoose.disconnect().finally(() => process.exit(1));
  });
}

module.exports = {
  SCRIPT,
  SENTINEL_ID,
  RUNS,
  CHUNK_SIZE,
  TARGETS,
  classify,
  inScope,
  buildPlan,
  parseArgs,
  exitCodeFor,
  toHundredScale,
  casAll,
  migrate,
  revert,
};
