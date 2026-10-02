"use strict";

const path = require("path");
const fs = require("fs");
const util = require("util");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const {
  unexcusedDateFilter,
  sumUnexcusedHours,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const { EJSON } = mongoose.mongo.BSON;
const { LESSON_UNIQUE_INDEX_NAME, lessonUniqueIndex } = Attendance;

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");
const SCRIPT = "migrate-45-attendance-lesson-index";
const LESSON_MARKER_PREFIX = "duplicate_lesson:";
const CHUNK_SIZE = 1000;

const STATUS_RANK = Object.freeze({ excused: 0, present: 1, absent: 2 });
const OTHER_STATUS_RANK = 3;
const CONFLICT_FIELDS = Object.freeze([
  "status", "active", "hours", "score", "application", "checkInTime",
  "checkOutTime", "late", "lateMinutes", "samsVerified", "manualVerified", "excuseReason",
]);
const SOFT_DELETE_FIELDS = Object.freeze(["deletedAt", "deletedBy", "deletionReason"]);
const RANK_FIELDS = Object.freeze(["session", "active", "status"]);

const raw = () => mongoose.connection.db.collection(Attendance.collection.collectionName);
const currentDb = () => mongoose.connection.db.databaseName;

function* chunks(list, size = CHUNK_SIZE) {
  for (let i = 0; i < list.length; i += size) yield list.slice(i, i + size);
}

const keyString = (key) => JSON.stringify(Object.entries(key || {}));
const isSessionRow = (r) => r.session !== null && r.session !== undefined;
const createdMs = (r) => {
  if (r.createdAt) return new Date(r.createdAt).getTime();
  return typeof r._id?.getTimestamp === "function" ? r._id.getTimestamp().getTime() : Number.MAX_SAFE_INTEGER;
};

const rankRow = (r) => [
  isSessionRow(r) ? 0 : 1,
  r.active === false ? 1 : 0,
  STATUS_RANK[r.status] ?? OTHER_STATUS_RANK,
  createdMs(r),
  String(r._id),
];

function compareRank(a, b) {
  const ra = rankRow(a);
  const rb = rankRow(b);
  for (let i = 0; i < ra.length; i += 1) {
    if (ra[i] < rb[i]) return -1;
    if (ra[i] > rb[i]) return 1;
  }
  return 0;
}

function pickKeeper(rows) {
  const sorted = [...rows].sort(compareRank);
  return { keeper: sorted[0], losers: sorted.slice(1) };
}

const norm = (v) => (v === null || v === undefined ? null : String(v));
const diffFields = (keeper, loser) => CONFLICT_FIELDS.filter((f) => norm(keeper[f]) !== norm(loser[f]));

const countedAsUnexcused = (loser, date, window) =>
  loser.status === "absent" &&
  loser.active === true &&
  (!window || (date >= window.$gte && date <= window.$lte));

function planGroup(group, plan, window) {
  const { keeper, losers } = pickKeeper(group.rows);
  const keeperId = keeper._id;
  const planned = losers.map((l) => ({
    _id: l._id,
    resident: l.resident,
    session: l.session,
    status: l.status,
    active: l.active,
    hours: l.hours,
    reason: `${LESSON_MARKER_PREFIX}${String(keeperId)}`,
    conflicts: diffFields(keeper, l),
  }));
  if (planned.some((l) => l.conflicts.length)) plan.conflictGroups += 1;
  plan.extraRows += planned.length;
  for (const l of planned) {
    if (!countedAsUnexcused(l, group._id.date, window)) continue;
    const id = String(l.resident);
    plan.affected.set(id, (plan.affected.get(id) || 0) + sumUnexcusedHours([l]));
  }
  plan.groups.push({
    key: group._id,
    keeperId,
    keeperStatus: keeper.status,
    keeper: { _id: keeperId, ...Object.fromEntries(RANK_FIELDS.map((f) => [f, keeper[f]])) },
    losers: planned,
  });
}

function planDedupe(groups, { window = null } = {}) {
  const plan = { groups: [], blocked: [], extraRows: 0, conflictGroups: 0, affected: new Map() };
  for (const group of groups) {
    if (group.rows.filter(isSessionRow).length > 1) {
      plan.blocked.push({ key: group._id, rowIds: group.rows.map((r) => r._id) });
      continue;
    }
    planGroup(group, plan, window);
  }
  return plan;
}

function indexMatches(idx) {
  if (!idx) return false;
  const want = lessonUniqueIndex();
  return (
    keyString(idx.key) === keyString(want.key) &&
    idx.unique === true &&
    util.isDeepStrictEqual(idx.partialFilterExpression, want.options.partialFilterExpression)
  );
}

async function listIndexes(coll) {
  try {
    return await coll.indexes();
  } catch (err) {
    if (err?.code === 26) return [];
    throw err;
  }
}

async function readIndexState(coll = raw()) {
  const indexes = await listIndexes(coll);
  const spec = indexes.find((i) => i.name === LESSON_UNIQUE_INDEX_NAME) || null;
  const wantKey = keyString(lessonUniqueIndex().key);
  const other = indexes.find((i) => i.name !== LESSON_UNIQUE_INDEX_NAME && keyString(i.key) === wantKey);
  return { exists: Boolean(spec), matches: indexMatches(spec), conflictingName: other?.name ?? null, spec };
}

const LESSON_GROUP_KEY = {
  resident: "$resident",
  date: "$date",
  science: { $ifNull: ["$science", null] },
  lessonType: { $ifNull: ["$lessonType", null] },
};
const ROW_FIELDS = [
  "_id", "resident", "session", "status", "active", "createdAt", "hours", "score", "application",
  "checkInTime", "checkOutTime", "late", "lateMinutes", "samsVerified", "manualVerified", "excuseReason",
];

function findDuplicateGroups(coll = raw()) {
  const row = Object.fromEntries(ROW_FIELDS.map((f) => [f, `$${f}`]));
  return coll
    .aggregate(
      [
        { $match: { deletedAt: null } },
        { $group: { _id: LESSON_GROUP_KEY, n: { $sum: 1 }, rows: { $push: row } } },
        { $match: { n: { $gt: 1 } } },
        { $sort: { "_id.resident": 1, "_id.date": 1 } },
      ],
      { allowDiskUse: true },
    )
    .toArray();
}

function findSameDayGroups(coll = raw()) {
  const { date, ...rest } = LESSON_GROUP_KEY;
  return coll
    .aggregate(
      [
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: { ...rest, day: { $dateToString: { date, format: "%Y-%m-%d" } } },
            dates: { $addToSet: "$date" },
            n: { $sum: 1 },
          },
        },
        { $match: { "dates.1": { $exists: true } } },
        { $sort: { "_id.resident": 1, "_id.day": 1 } },
      ],
      { allowDiskUse: true },
    )
    .toArray();
}

async function forecastK4(coll, plan, window) {
  const rawIds = new Map(plan.groups.map((g) => [String(g.key.resident), g.key.resident]));
  const ids = [...plan.affected.keys()].map((id) => rawIds.get(id));
  const forecast = new Map();
  if (!ids.length) return forecast;
  const rows = [];
  for (const chunk of chunks(ids)) {
    rows.push(...(await coll
      .find(
        { resident: { $in: chunk }, status: "absent", active: true, deletedAt: null, date: window },
        { projection: { resident: 1, hours: 1 } },
      )
      .toArray()));
  }
  for (const [id, removed] of plan.affected) {
    forecast.set(id, sumUnexcusedHours(rows.filter((r) => String(r.resident) === id)) - removed);
  }
  return forecast;
}

function assertSane(before, plan) {
  if (before.exists && !before.matches) {
    throw new Error(`${LESSON_UNIQUE_INDEX_NAME} boshqa spetsifikatsiya bilan mavjud — qo'lda tekshiring`);
  }
  if (before.conflictingName) {
    throw new Error(`shu kalitli boshqa indeks bor: ${before.conflictingName} — qo'lda tekshiring`);
  }
  if (plan.blocked.length) {
    throw new Error(`${plan.blocked.length} ta darsda 2+ sessiya qatori — avtomatik hal qilinmaydi, qo'lda tekshiring`);
  }
}

async function loadLoserDocs(coll, ids) {
  const docs = [];
  for (const chunk of chunks(ids)) docs.push(...(await coll.find({ _id: { $in: chunk } }).toArray()));
  return docs;
}

async function writeBackup(coll, { plan, before, now, backupDir, dbLabel }) {
  const payload = {
    script: SCRIPT,
    dbName: currentDb(),
    createdAt: now,
    indexBefore: before.spec,
    createsIndex: !before.matches,
    groups: plan.groups.map((g) => ({
      key: g.key,
      keeperId: g.keeperId,
      losers: g.losers.map((l) => ({ _id: l._id, reason: l.reason })),
    })),
    loserDocs: await loadLoserDocs(coll, plan.groups.flatMap((g) => g.losers.map((l) => l._id))),
  };
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const file = path.join(backupDir, `attendance-lesson-index-${dbLabel || "default"}-${stamp}.json`);
  fs.writeFileSync(file, EJSON.stringify(payload, undefined, 2, { relaxed: false }), { flag: "wx" });
  return file;
}

const planSnapshotFilter = (key, row) => ({
  _id: row._id,
  deletedAt: null,
  resident: key.resident ?? null,
  date: key.date ?? null,
  science: key.science ?? null,
  lessonType: key.lessonType ?? null,
  ...Object.fromEntries(RANK_FIELDS.map((f) => [f, row[f] ?? null])),
});

async function softDeleteLosers(coll, plan, now) {
  const out = { softDeleted: 0, skipped: 0, staleKeepers: 0 };
  for (const group of plan.groups) {
    const keeper = await coll.findOne(planSnapshotFilter(group.key, group.keeper), { projection: { _id: 1 } });
    if (!keeper) {
      out.staleKeepers += 1;
      out.skipped += group.losers.length;
      continue;
    }
    for (const loser of group.losers) {
      const res = await coll.updateOne(planSnapshotFilter(group.key, loser), {
        $set: { deletedAt: now, deletedBy: null, deletionReason: loser.reason },
      });
      if (res.modifiedCount) out.softDeleted += 1;
      else out.skipped += 1;
    }
  }
  return out;
}

async function createLessonIndex(coll) {
  const { key, options } = lessonUniqueIndex();
  try {
    await coll.createIndex(key, options);
  } catch (err) {
    if (err?.code === 11000) {
      throw new Error(
        "indeks yaratilmadi: shu orada yangi dublikat paydo bo'ldi yoki rejadagi qator o'zgardi — skriptni qayta ishga tushiring",
      );
    }
    if (err?.code === 85 || err?.code === 86) {
      throw new Error(`indeks yaratilmadi: spetsifikatsiya to'qnashuvi (${err.codeName}) — qo'lda tekshiring`);
    }
    throw err;
  }
}

async function applyWrites(coll, result, { now, beforeCreateIndex }) {
  Object.assign(result, await softDeleteLosers(coll, result.plan, now));
  if (beforeCreateIndex) await beforeCreateIndex();
  if (!result.before.matches) {
    await createLessonIndex(coll);
    result.indexCreated = true;
  }
  result.after = await readIndexState(coll);
  if (!result.after.matches) throw new Error(`${LESSON_UNIQUE_INDEX_NAME}: getIndexes() tasdiqlamadi`);
}

async function migrate({ apply = false, now = new Date(), backupDir = BACKUP_DIR, dbLabel = null, beforeCreateIndex } = {}) {
  const coll = raw();
  const before = await readIndexState(coll);
  const window = unexcusedDateFilter(now);
  const plan = planDedupe(await findDuplicateGroups(coll), { window });
  const result = {
    dbName: currentDb(),
    before,
    plan,
    k4: await forecastK4(coll, plan, window),
    sameDay: await findSameDayGroups(coll),
    backup: null,
    softDeleted: 0,
    skipped: 0,
    staleKeepers: 0,
    indexCreated: false,
    after: null,
  };
  if (!apply) return result;

  assertSane(before, plan);
  if (plan.groups.length || !before.matches) {
    result.backup = await writeBackup(coll, { plan, before, now, backupDir, dbLabel });
  }
  try {
    await applyWrites(coll, result, { now, beforeCreateIndex });
  } catch (err) {
    if (result.backup) err.message = `${err.message} (zaxira: ${result.backup})`;
    throw err;
  }
  return result;
}

function readBackup(file, allowOtherDb) {
  const payload = EJSON.parse(fs.readFileSync(file, "utf8"), { relaxed: false });
  if (payload.script !== SCRIPT || !Array.isArray(payload.groups)) {
    throw new Error(`${file} — bu skriptning zaxirasi emas`);
  }
  if (payload.dbName !== currentDb() && !allowOtherDb) {
    throw new Error(`${file} — "${payload.dbName}" bazasining zaxirasi, ulangan baza "${currentDb()}". Ataylab bo'lsa: --allow-other-db`);
  }
  return payload;
}

function restoreUpdate(doc) {
  const update = { $set: {}, $unset: {} };
  for (const f of SOFT_DELETE_FIELDS) {
    if (doc && f in doc) update.$set[f] = doc[f];
    else update.$unset[f] = "";
  }
  if (!Object.keys(update.$unset).length) delete update.$unset;
  return update;
}

async function revert({ file, allowOtherDb = false }) {
  const payload = readBackup(file, allowOtherDb);
  const coll = raw();
  const losers = payload.groups.flatMap((g) => g.losers);
  const docs = new Map((payload.loserDocs || []).map((d) => [String(d._id), d]));
  const state = await readIndexState(coll);
  let indexDropped = false;
  if (state.matches && (payload.createsIndex || losers.length)) {
    await coll.dropIndex(LESSON_UNIQUE_INDEX_NAME);
    indexDropped = true;
  }
  const out = { planned: losers.length, restored: 0, untouched: [], indexDropped };
  for (const loser of losers) {
    const res = await coll.updateOne(
      { _id: loser._id, deletionReason: loser.reason, deletedAt: { $ne: null } },
      restoreUpdate(docs.get(String(loser._id))),
    );
    if (res.modifiedCount) out.restored += 1;
    else out.untouched.push(String(loser._id));
  }
  return out;
}

const iso = (d) => (d ? new Date(d).toISOString() : "—");
const idxLine = (s) => {
  if (!s.exists) return "YO'Q";
  return s.matches ? "BOR, spetsifikatsiya to'g'ri" : "BOR, 🔴 spetsifikatsiya BOSHQA";
};

async function residentNames(ids) {
  if (!ids.length) return new Map();
  const docs = await mongoose.connection.db
    .collection(Resident.collection.collectionName)
    .find({ _id: { $in: ids } }, { projection: { fullName: 1 } })
    .toArray();
  return new Map(docs.map((d) => [String(d._id), d.fullName || "—"]));
}

const lessonLabel = (k, names) =>
  `${names.get(String(k.resident)) || String(k.resident)} · ${k.date ? iso(k.date) : k.day} · fan ${k.science ?? "—"} · ${k.lessonType ?? "—"}`;

function printGroups(plan, names) {
  log(`  Dublikat guruhlari: ${plan.groups.length}   ortiqcha qatorlar (soft-delete): ${plan.extraRows}`);
  log(`  Ziddiyatli guruhlar (maydonlari farq qiladi): ${plan.conflictGroups} — egasi ko'rib chiqadi`);
  for (const g of plan.groups.filter((x) => x.losers.some((l) => l.conflicts.length))) {
    log(`   · ${lessonLabel(g.key, names)}`);
    log(`       qoladi ${g.keeperStatus} (${g.keeperId}) ← yutqazadi: ${g.losers
      .map((l) => `${l.status}${l.active === false ? "/nofaol" : ""} [${l.conflicts.join(",") || "—"}]`)
      .join("; ")}`);
  }
  for (const b of plan.blocked) log(`   🔴 2+ sessiya qatori: ${lessonLabel(b.key, names)} — ${b.rowIds.join(", ")}`);
}

function printAffected(plan, k4, names) {
  log(`  Ta'sirlangan rezidentlar (joriy o'quv yili sababsiz soati kamayadi): ${plan.affected.size}`);
  for (const [id, hours] of plan.affected) {
    log(`   · ${names.get(id) || id}: −${hours} soat · migratsiyadan keyin joriy yil: ${k4.get(id)}`);
  }
  if (!plan.affected.size) return;
  log("    saqlangan son: recount-45-unexcused-hours.js --apply yoki 08:00 sweep yangilaydi —");
  log("    recount «joriy yil» (dry-run ham, --apply ham) = «migratsiyadan keyin»");
}

async function printReport(result, apply) {
  const { plan } = result;
  const ids = [...new Set([...plan.groups.map((g) => g.key.resident), ...result.sameDay.map((s) => s._id.resident)])];
  const names = await residentNames(ids);
  line("═");
  log(`  4.5 — DAVOMAT: bir dars = bitta jonli yozuv (${LESSON_UNIQUE_INDEX_NAME})`);
  log(`  Baza: ${result.dbName}`);
  line("═");
  log(`  Indeks (oldin): ${idxLine(result.before)}${result.before.conflictingName ? ` · 🔴 shu kalitli boshqa indeks: ${result.before.conflictingName}` : ""}`);
  printGroups(plan, names);
  printAffected(plan, result.k4, names);
  log(`  Bir kunda turli vaqtli qatorlar (FAQAT hisobot, tegilmaydi): ${result.sameDay.length}`);
  for (const s of result.sameDay) log(`   · ${lessonLabel(s._id, names)} — ${s.dates.map(iso).join(", ")}`);
  line();
  if (!apply) {
    log("  DRY-RUN — hech narsa yozilmadi. Yozish: --apply");
  } else {
    log(
      `  ✅ soft-delete: ${result.softDeleted} (rejadan keyin o'zgargani uchun o'tkazildi: ${result.skipped};` +
        ` shundan keeper'i o'zgargan guruhlar: ${result.staleKeepers})`,
    );
    log(`  Indeks: ${result.indexCreated ? "YARATILDI" : "allaqachon bor edi"} → tekshiruv: ${idxLine(result.after)}`);
    if (result.backup) log(`  Zaxira: ${result.backup}  ← bu yo'lni saqlang (qaytarish uchun kerak)`);
  }
  line("═");
}

function parseArgs(argv) {
  const value = (flag) => {
    const a = argv.find((x) => x.startsWith(`${flag}=`));
    return a ? a.slice(flag.length + 1) : null;
  };
  const args = {
    apply: argv.includes("--apply"),
    dry: argv.includes("--dry"),
    allowOtherDb: argv.includes("--allow-other-db"),
    dbName: value("--db"),
    revertFile: value("--revert"),
  };
  if (args.dry && (args.apply || args.revertFile)) throw new Error("--dry ni --apply/--revert bilan birga bermang");
  if (args.apply && args.revertFile) throw new Error("--apply va --revert birga emas");
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!process.env.MONGO_HOST) throw new Error("MONGO_HOST topilmadi (.env)");
  const opts = { serverSelectionTimeoutMS: 5000, autoIndex: false, autoCreate: false };
  if (args.dbName) opts.dbName = args.dbName;
  await mongoose.connect(process.env.MONGO_HOST, opts);
  try {
    if (args.revertFile) {
      const r = await revert({ file: args.revertFile, allowOtherDb: args.allowOtherDb });
      log(`  Baza: ${currentDb()}`);
      log(`  QAYTARISH: indeks ${r.indexDropped ? "TUSHIRILDI" : "tegilmadi"}; zaxirada ${r.planned}, tiklandi ${r.restored}.`);
      if (r.untouched.length) log(`  ⚠️ Tegilmadi (keyin o'zgargan yoki tiklangan): ${r.untouched.join(", ")}`);
      return;
    }
    await printReport(await migrate({ apply: args.apply, dbLabel: args.dbName }), args.apply);
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
  LESSON_MARKER_PREFIX,
  STATUS_RANK,
  rankRow,
  pickKeeper,
  diffFields,
  planDedupe,
  indexMatches,
  readIndexState,
  findDuplicateGroups,
  findSameDayGroups,
  migrate,
  revert,
  parseArgs,
  printReport,
};
