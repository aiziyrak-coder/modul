"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  currentAcademicYearTitle,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

const BACKUP_DIR = path.join(__dirname, "backups");
const RESIDENTS = "residents";
const DUPLICATE_KEY = 11000;

const rawResidents = () => mongoose.connection.db.collection(RESIDENTS);

const PROJECTION = {
  _id: 1,
  fullName: 1,
  status: 1,
  active: 1,
  deletedAt: 1,
  totalUnexcusedHours: 1,
  expulsionOrderCreatedAt: 1,
  updatedAt: 1,
};

async function preconditions() {
  let indexOk = false;
  let indexError = null;
  try {
    const idx = (await Order.collection.indexes()).find(
      (i) => i.name === Order.OPEN_INDEX_NAME,
    );
    indexOk = Boolean(
      idx?.unique && idx.partialFilterExpression?.status === Order.ORDER_OPEN,
    );
  } catch (err) {
    indexError = err.message;
  }
  const missingStatus = await rawResidents().countDocuments({
    status: { $exists: false },
  });
  return { indexOk, indexError, missingStatus };
}

async function classify() {
  const flagged = await rawResidents()
    .find({ expulsionOrderCreated: true }, { projection: PROJECTION })
    .toArray();
  const open = new Set(
    (
      await Order.distinct("resident", {
        status: { $in: [Order.ORDER_OPEN, Order.ORDER_SIGNED] },
        resident: { $in: flagged.map((r) => r._id) },
      })
    ).map(String),
  );
  const classes = { deleted: [], violation: [], hasOrder: [], machine: [], leave: [], runtime: [] };
  for (const r of flagged) {
    const hasOpen = open.has(String(r._id));
    if (r.deletedAt) classes.deleted.push(r);
    else if (r.status === "chetlatilgan") classes.violation.push(r);
    else if (r.active === false) classes.machine.push({ ...r, hasOpen });
    else if (hasOpen) classes.hasOrder.push(r);
    else if (r.status === "akademik_tatil") classes.leave.push(r);
    else classes.runtime.push(r);
  }
  return classes;
}

function saveBackup(plan, dbName, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(
    backupDir,
    `expulsion-orders-${dbName || "default"}-${stamp}.json`,
  );
  fs.writeFileSync(file, JSON.stringify({ plan }, null, 2));
  return file;
}

function merosOrder(r, orderId, now) {
  const draftedAt = r.expulsionOrderCreatedAt || r.updatedAt || now;
  const hours = r.totalUnexcusedHours ?? null;
  return {
    _id: orderId,
    resident: r._id,
    residentName: r.fullName || null,
    origin: "meros",
    status: Order.ORDER_OPEN,
    countingYear: currentAcademicYearTitle(draftedAt),
    draftedAt,
    hoursAtDraft: hours,
    history: [
      {
        at: now,
        action: "migratsiya",
        source: "migration",
        hours,
        note: r.active === false ? "meros: active=false" : "meros: akademik_tatil",
      },
    ],
  };
}

async function migrate({
  apply = false,
  dbName = null,
  now = new Date(),
  backupDir = BACKUP_DIR,
} = {}) {
  const pre = await preconditions();
  const classes = await classify();
  const result = { pre, classes, plan: [], created: 0, raced: 0, reactivated: 0, backup: null };
  if (!apply) return result;

  if (!pre.indexOk) {
    throw new Error(
      `${Order.OPEN_INDEX_NAME} indeksi yo'q — avval kod deploy qilinib, getIndexes() bilan tekshirilsin`,
    );
  }
  if (pre.missingStatus > 0) {
    throw new Error(
      `${pre.missingStatus} ta rezidentda status yo'q — avval scripts/migrate-45-resident-status.js --apply`,
    );
  }

  const targets = [...classes.machine, ...classes.leave];
  result.plan = targets.map((r) => ({
    orderId: r.hasOpen ? null : String(new mongoose.Types.ObjectId()),
    residentId: String(r._id),
    reactivate: r.active === false,
  }));
  if (!targets.length) return result;
  result.backup = saveBackup(result.plan, dbName, backupDir);

  for (const [i, r] of targets.entries()) {
    const step = result.plan[i];
    try {
      if (step.orderId) {
        await Order.create(merosOrder(r, new mongoose.Types.ObjectId(step.orderId), now));
        result.created += 1;
      }
    } catch (err) {
      if (err?.code !== DUPLICATE_KEY) throw err;
      result.raced += 1;
    }
    if (step.reactivate) {
      const res = await rawResidents().updateOne(
        { _id: r._id, active: false },
        { $set: { active: true } },
      );
      result.reactivated += res.modifiedCount ?? 0;
    }
  }
  return result;
}

async function revert({ file, now = new Date() }) {
  const { plan = [] } = JSON.parse(fs.readFileSync(file, "utf8"));
  let orders = 0;
  let residents = 0;
  const untouched = [];
  for (const step of plan) {
    if (!step.orderId) {
      residents += await deactivate(step);
      continue;
    }
    const res = await Order.updateOne(
      { _id: step.orderId, status: Order.ORDER_OPEN, "history.1": { $exists: false } },
      {
        $set: {
          status: "bekor_qilingan",
          closedAt: now,
          closedBy: null,
          closedByName: null,
          closeReason: "migratsiya_qaytarildi",
          hoursAtClose: null,
        },
        $push: {
          history: {
            at: now,
            action: "bekor_qilindi",
            source: "migration",
            note: "migratsiya_qaytarildi",
          },
        },
      },
    );
    if (!res.modifiedCount) {
      untouched.push(step.orderId);
      continue;
    }
    orders += 1;
    residents += await deactivate(step);
  }
  return { planned: plan.length, orders, residents, untouched };
}

async function deactivate(step) {
  if (!step.reactivate) return 0;
  const r = await rawResidents().updateOne(
    { _id: new mongoose.Types.ObjectId(step.residentId), active: true },
    { $set: { active: false } },
  );
  return r.modifiedCount ?? 0;
}

const names = (list) =>
  list.map((r) => `${r.fullName || "—"} (${r._id})`).join(", ") || "—";

function printReport(result, apply) {
  const { pre, classes: c } = result;
  line("═");
  log("  4.5 CHETLATISH BUYRUQLARI — ESKI BAYROQLAR MIGRATSIYASI");
  line("═");
  log(`  Indeks ${Order.OPEN_INDEX_NAME}:        ${pre.indexOk ? "✅ bor" : "🔴 YO'Q"}`);
  if (pre.indexError) log(`     (${pre.indexError})`);
  log(`  status'siz rezident (status backfill):  ${pre.missingStatus}`);
  line();
  log(`  machine  (active:false → active:true [+ meros]): ${c.machine.length}`);
  log(`  leave    (akademik_tatil → meros):              ${c.leave.length}`);
  log(`  hasOrder (ochiq hujjat bor, tegilmaydi):        ${c.hasOrder.length}`);
  log(`  runtime  (sweep hal qiladi, tegilmaydi):        ${c.runtime.length}`);
  log(`  deleted  (o'chirilgan, faqat hisobot):          ${c.deleted.length}`);
  log(`  🔴 violation (chetlatilgan + bayroq):           ${c.violation.length}`);
  if (c.machine.length) log(`     machine: ${names(c.machine)}`);
  if (c.leave.length) log(`     leave:   ${names(c.leave)}`);
  if (c.violation.length) log(`     violation: ${names(c.violation)}`);
  line();
  if (apply) {
    log(`  ✅ YOZILDI: ${result.created} ta meros loyiha, ${result.reactivated} ta rezident active:true`);
    if (result.raced) log(`  ℹ️ ${result.raced} ta rezidentda shu orada ochiq hujjat paydo bo'lgan`);
    if (result.backup) log(`  Zaxira: ${result.backup}`);
  } else {
    log(`  DRY-RUN — hech narsa yozilmadi. Yozish uchun: --apply`);
  }
  line("═");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));
  const revertArg = process.argv.find((a) => a.startsWith("--revert="));
  if (!process.env.MONGO_HOST) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }
  const dbName = dbArg ? dbArg.slice("--db=".length) : null;
  const uri = dbName
    ? process.env.MONGO_HOST.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`)
    : process.env.MONGO_HOST;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, autoIndex: false });
  try {
    if (revertArg) {
      const r = await revert({ file: revertArg.slice("--revert=".length) });
      log(`  QAYTARISH: rejada ${r.planned}, bekor qilindi ${r.orders}, active:false ${r.residents}.`);
      if (r.untouched.length) {
        log(`  ⚠️ Tegilmadi (bo'lim allaqachon qaror qilgan yoki yo'q): ${r.untouched.join(", ")}`);
      }
      return;
    }
    printReport(await migrate({ apply, dbName }), apply);
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

module.exports = { preconditions, classify, migrate, revert, merosOrder };
