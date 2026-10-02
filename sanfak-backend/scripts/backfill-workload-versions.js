"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");
const APPLIED_STATUS = "superseded";

const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : v == null ? null : String(v));

const toTime = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

function approvalTime(doc) {
  const steps = Array.isArray(doc?.approvalSteps) ? doc.approvalSteps : [];
  const last = steps[steps.length - 1];
  return toTime(last?.date) ?? toTime(doc?.verify?.issuedAt) ?? toTime(doc?.updatedAt) ?? 0;
}

const brief = (d) => ({ id: idOf(d._id), title: d.title || "", approvedAt: new Date(approvalTime(d)).toISOString() });

function planDistributions(keeper, losers, distributions) {
  const keeperId = idOf(keeper._id);
  const keeperDist = distributions.find((d) => idOf(d.workload) === keeperId && d.status === "approved");
  const loserIds = new Set(losers.map((w) => idOf(w._id)));
  const old = distributions.filter((d) => loserIds.has(idOf(d.workload)) && d.status !== "superseded");
  const rows = old.map((d) => ({ id: idOf(d._id), workload: idOf(d.workload), status: d.status }));
  return keeperDist
    ? { supersededBy: idOf(keeperDist._id), supersede: rows, waiting: [] }
    : { supersededBy: null, supersede: [], waiting: rows };
}

function planSupersede({ workloads = [], distributions = [] } = {}) {
  const byKey = new Map();
  for (const w of workloads) {
    if (w.status !== "approved") continue;
    const key = `${idOf(w.department)}|${idOf(w.academicYear)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(w);
  }
  const groups = [];
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => approvalTime(a) - approvalTime(b) || idOf(a._id).localeCompare(idOf(b._id)));
    const keeper = sorted[sorted.length - 1];
    const losers = sorted.slice(0, -1);
    const [department, academicYear] = key.split("|");
    groups.push({
      department,
      academicYear,
      keep: brief(keeper),
      supersede: losers.map(brief),
      distributions: planDistributions(keeper, losers, distributions),
    });
  }
  return {
    groups,
    workloadCount: groups.reduce((s, g) => s + g.supersede.length, 0),
    distributionCount: groups.reduce((s, g) => s + g.distributions.supersede.length, 0),
  };
}

function writeBackup(data, dbName) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `workload-versions-${dbName || "default"}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ createdAt: new Date().toISOString(), db: dbName || null, ...data }, null, 2));
  return file;
}

const pickState = (d, fields) => Object.fromEntries([["_id", idOf(d._id)], ...fields.map((f) => [f, d[f] ?? null])]);

async function applyPlan(plan, { Workload, Distribution, dbName, backup }) {
  const wlIds = plan.groups.flatMap((g) => g.supersede.map((s) => s.id));
  const dsIds = plan.groups.flatMap((g) => g.distributions.supersede.map((s) => s.id));
  const [wlDocs, dsDocs] = await Promise.all([
    Workload.find({ _id: { $in: wlIds } }).select("status supersededBy supersededAt").lean(),
    Distribution.find({ _id: { $in: dsIds } }).select("status active supersededBy supersededAt").lean(),
  ]);
  const at = new Date();
  const backupFile = backup
    ? writeBackup({
      appliedAt: at.toISOString(),
      appliedStatus: APPLIED_STATUS,
      workloads: wlDocs.map((d) => pickState(d, ["status", "supersededBy", "supersededAt"])),
      distributions: dsDocs.map((d) => pickState(d, ["status", "active", "supersededBy", "supersededAt"])),
    }, dbName)
    : null;
  let workloads = 0;
  let distributions = 0;
  for (const g of plan.groups) {
    const w = await Workload.updateMany(
      { _id: { $in: g.supersede.map((s) => s.id) }, status: "approved" },
      { $set: { status: "superseded", supersededBy: g.keep.id, supersededAt: at } },
    );
    workloads += w?.modifiedCount ?? 0;
    if (!g.distributions.supersede.length) continue;
    const d = await Distribution.updateMany(
      { _id: { $in: g.distributions.supersede.map((s) => s.id) }, status: { $ne: "superseded" } },
      { $set: { status: "superseded", active: false, supersededBy: g.distributions.supersededBy, supersededAt: at } },
    );
    distributions += d?.modifiedCount ?? 0;
  }
  return { backupFile, workloads, distributions };
}

async function backfill({ apply = false, dbName = "", backup = true } = {}) {
  const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
  const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
  const workloads = await Workload.find({ status: "approved", active: { $ne: false } })
    .select("_id title department academicYear status approvalSteps.date verify.issuedAt updatedAt")
    .lean();
  const ids = workloads.map((w) => w._id);
  const distributions = ids.length
    ? await Distribution.find({ workload: { $in: ids } }).select("_id workload status").lean()
    : [];
  const plan = planSupersede({ workloads, distributions });
  const result = { ...plan, applied: null };
  if (apply && plan.groups.length > 0) {
    result.applied = await applyPlan(plan, { Workload, Distribution, dbName, backup });
  }
  return result;
}

function planRevert(data) {
  const appliedAt = toTime(data?.appliedAt);
  if (appliedAt == null) {
    throw new Error("Zaxirada `appliedAt` yo'q — xavfsiz orqaga qaytarib bo'lmaydi (eski format)");
  }
  const status = data.appliedStatus || APPLIED_STATUS;
  const ops = [];
  let invalid = 0;
  for (const kind of ["workloads", "distributions"]) {
    for (const { _id, ...fields } of Array.isArray(data[kind]) ? data[kind] : []) {
      if (!mongoose.isValidObjectId(_id)) {
        invalid += 1;
        continue;
      }
      ops.push({ kind, _id, filter: { _id, status, supersededAt: new Date(appliedAt) }, set: fields });
    }
  }
  return { ops, invalid };
}

async function revert({ file }) {
  const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
  const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
  const models = { workloads: Workload, distributions: Distribution };
  const { ops, invalid } = planRevert(JSON.parse(fs.readFileSync(file, "utf8")));
  let changed = 0;
  const skipped = [];
  for (const op of ops) {
    const r = await models[op.kind].updateOne(op.filter, { $set: op.set });
    if ((r?.matchedCount ?? 0) === 0) skipped.push({ kind: op.kind, id: String(op._id) });
    changed += r?.modifiedCount ?? 0;
  }
  return { changed, skipped, invalid };
}

function printReport(result, apply) {
  line("═");
  log(`  BACKFILL WORKLOAD VERSIONS — ${apply ? "YOZISH (--apply)" : "DRY-RUN (yozilmadi)"}`);
  line("═");
  for (const g of result.groups) {
    log(`  Kafedra ${g.department} · yil ${g.academicYear}`);
    log(`    QOLADI      : ${g.keep.id} — ${g.keep.title} (${g.keep.approvedAt})`);
    for (const s of g.supersede) log(`    SUPERSEDED  : ${s.id} — ${s.title} (${s.approvedAt})`);
    for (const d of g.distributions.supersede) log(`    taqsimot → superseded: ${d.id} (${d.status})`);
    for (const d of g.distributions.waiting) log(`    taqsimot KUTADI (yangi taqsimot tasdiqlanmagan): ${d.id} (${d.status})`);
  }
  line();
  log(`  Guruhlar (>1 approved)   : ${result.groups.length}`);
  log(`  Superseded yuklama       : ${result.workloadCount}`);
  log(`  Superseded taqsimot      : ${result.distributionCount}`);
  if (result.applied) {
    log(`  Yozildi (yuklama/taqsimot): ${result.applied.workloads}/${result.applied.distributions}`);
    if (result.applied.backupFile) log(`  Zaxira                   : ${result.applied.backupFile}`);
  }
  line("═");
  if (!apply && result.groups.length > 0) log("  Yozish uchun: --apply bayrog'i bilan qayta yurgizing.");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));
  const revertArg = process.argv.find((a) => a.startsWith("--revert="));
  if (!process.env.MONGO_HOST) {
    console.error("MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const dbName = dbArg ? dbArg.slice("--db=".length) : "";
  const uri = dbName
    ? process.env.MONGO_HOST.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`)
    : process.env.MONGO_HOST;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    if (revertArg) {
      const r = await revert({ file: revertArg.slice("--revert=".length) });
      log(`  ORQAGA QAYTARISH: o'zgardi ${r.changed} ta hujjat; yaroqsiz id ${r.invalid}.`);
      log(`  O'TKAZIB YUBORILDI (yozuvdan beri o'zgargan): ${r.skipped.length}`);
      for (const s of r.skipped) log(`    ${s.kind}: ${s.id}`);
      return;
    }
    const result = await backfill({ apply, dbName });
    printReport(result, apply);
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

module.exports = { planSupersede, planRevert, approvalTime, backfill, revert };
