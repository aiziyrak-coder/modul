"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const log = (s = "") => console.log(s);
const line = (c = "─") => console.log(c.repeat(78));

function predictDraft(r, currentYear, open, decisions = {}) {
  const openOrigin = open?.origin;
  if (r.active !== true || decisions.signed) return null;
  const inStudy = r.status === undefined || r.status === null || r.status === "oquvda";
  const flagged = r.expulsionOrderCreated === true;
  if (currentYear >= 72) {
    if (!inStudy || openOrigin) return null;
    if (decisions.watermark) return flagged ? "cancel" : null;
    return "open";
  }
  if (r.status === "chetlatilgan" || openOrigin === "meros") return null;
  if (open) return "cancel";
  return flagged ? "cancel" : null;
}

async function loadDecisions(orders, Order) {
  const signed = new Set(
    (await orders.distinct("resident", { status: Order.ORDER_SIGNED })).map(String),
  );
  const lastReject = new Map();
  const rejected = await orders
    .find({ status: Order.ORDER_REJECTED }, { projection: { resident: 1, closedAt: 1, hoursAtClose: 1 } })
    .sort({ createdAt: -1 })
    .toArray();
  for (const o of rejected) {
    if (!lastReject.has(String(o.resident))) lastReject.set(String(o.resident), o);
  }
  return { signed, lastReject };
}

async function compare() {
  const {
    unexcusedDateFilter,
  } = require("#modules/4.05-residency/_services/unexcusedWindow");
  const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
  const dateFilter = unexcusedDateFilter();

  const residents = mongoose.connection.db.collection("residents");
  const attendances = mongoose.connection.db.collection("attendances");
  const orders = mongoose.connection.db.collection(Order.collection.collectionName);

  const docs = await residents
    .find(
      { deletedAt: null, active: true },
      {
        projection: {
          fullName: 1,
          totalUnexcusedHours: 1,
          warningIssued: 1,
          expulsionOrderCreated: 1,
          status: 1,
          active: 1,
        },
      },
    )
    .toArray();
  const openByResident = new Map(
    (
      await orders
        .find({ status: Order.ORDER_OPEN }, { projection: { resident: 1, origin: 1 } })
        .toArray()
    ).map((o) => [String(o.resident), o]),
  );
  const { signed, lastReject } = await loadDecisions(orders, Order);
  const { watermarkApplies } = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
  const now = new Date();

  const rows = [];
  const drafts = { open: [], cancel: [] };
  for (const r of docs) {
    const base = { resident: r._id, status: "absent", active: true, deletedAt: null };
    const [allRows, windowRows] = await Promise.all([
      attendances.find(base).project({ hours: 1 }).toArray(),
      attendances
        .find({ ...base, date: dateFilter })
        .project({ hours: 1 })
        .toArray(),
    ]);
    const sum = (list) => list.reduce((acc, a) => acc + (a.hours || 2), 0);
    const stored = r.totalUnexcusedHours ?? 0;
    const allHistory = sum(allRows);
    const currentYear = sum(windowRows);
    const draft = predictDraft(r, currentYear, openByResident.get(String(r._id)), {
      signed: signed.has(String(r._id)),
      watermark: watermarkApplies(lastReject.get(String(r._id)), currentYear, now),
    });
    if (draft) drafts[draft].push({ id: String(r._id), fullName: r.fullName || "(ismsiz)", currentYear });
    if (stored !== currentYear || allHistory !== currentYear) {
      rows.push({
        id: String(r._id),
        fullName: r.fullName || "(ismsiz)",
        stored,
        allHistory,
        currentYear,
        warningIssued: !!r.warningIssued,
        expulsionOrderCreated: !!r.expulsionOrderCreated,
      });
    }
  }
  return { total: docs.length, rows, drafts, window: dateFilter };
}

function printDrafts(drafts) {
  const names = (list) => list.map((d) => `${d.fullName} (${d.currentYear})`).join(", ");
  line();
  log("  CHETLATISH BUYRUG'I HUJJATLARI (apply shu ishni qiladi):");
  log(`     yangi LOYIHA ochiladi (rezident + bo'limga xabar): ${drafts.open.length}`);
  if (drafts.open.length) log(`        ${names(drafts.open)}`);
  log(`     loyiha YOPILADI / eskirgan bayroq tozalanadi:     ${drafts.cancel.length}`);
  if (drafts.cancel.length) log(`        ${names(drafts.cancel)}`);
}

function printReport({ total, rows, drafts, window }) {
  line("═");
  log("  4.5 SABABSIZ SOAT — QAYTA HISOB");
  line("═");
  log(`  Oyna: ${window.$gte.toISOString()} .. ${window.$lte.toISOString()}`);
  log(`  Tekshirilgan rezident: ${total}`);
  log(`  O'zgaradigan: ${rows.length}`);
  line();
  if (!rows.length) {
    log("  Farq yo'q — qayta hisoblash kerak emas.");
  } else {
    log("  F.I.Sh                      saqlangan  butun tarix  joriy yil  bayroq");
    for (const r of rows) {
      const flags =
        (r.warningIssued ? "W" : "-") + (r.expulsionOrderCreated ? "E" : "-");
      log(
        `  ${r.fullName.padEnd(26).slice(0, 26)}  ${String(r.stored).padStart(9)}  ${String(r.allHistory).padStart(11)}  ${String(r.currentYear).padStart(9)}  ${flags}`,
      );
    }
    line();
    const willClear = rows.filter((r) => r.warningIssued && r.currentYear < 6);
    log(`  ⚠️ Ogohlantirishi TOZALANADIGAN rezident: ${willClear.length}`);
    log("     (soat ostonadan pastga tushdi → bayroq + bildirishnoma bekor)");
    log("     Bu KUTILGAN xatti-harakat, nosozlik emas.");
  }
  printDrafts(drafts);
  line("═");
}

async function applySweep() {
  require("#modules/4.01-auth/user/user.model");
  require("#modules/4.01-auth/role/role.model");
  const {
    runExpulsionSweep,
  } = require("#modules/4.05-residency/_services/expulsionCheck");
  return runExpulsionSweep();
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dbArg = process.argv.find((a) => a.startsWith("--db="));

  if (!process.env.MONGO_HOST) {
    console.error("XATO: MONGO_HOST topilmadi (.env)");
    process.exit(1);
  }

  const dbName = dbArg ? dbArg.slice("--db=".length) : null;
  const uri = dbName
    ? process.env.MONGO_HOST.replace(/\/([^/?]+)(\?|$)/, `/${dbName}$2`)
    : process.env.MONGO_HOST;

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    if (!apply) {
      printReport(await compare());
      log("  Bajarish uchun: --apply");
      return;
    }
    log("  `runExpulsionSweep()` ishga tushdi — loglar pastda.");
    if (!(await applySweep())) {
      console.error("XATO: sweep yiqildi — yuqoridagi logga qarang. Hech narsa tasdiqlanmadi.");
      process.exitCode = 1;
      return;
    }
    log("  ✅ Yakunlandi. Tekshirish uchun skriptni bayroqsiz qayta ishlating.");
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

module.exports = { compare, predictDraft, applySweep };
