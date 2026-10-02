"use strict";

const mongoose = require("mongoose");
require("#modules/4.01-auth/user/user.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const {
  openDraft,
  cancelDraftBelowThreshold,
  closeDraftForDeletedResident,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  revokeExpulsionNotice,
} = require("#modules/4.05-residency/_services/expulsionReversal");
const {
  runExpulsionCheck,
} = require("#modules/4.05-residency/_services/expulsionCheck");
const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();
const T0 = new Date("2026-09-20T08:00:00Z");

const newResident = (extra = {}) =>
  Resident.create({ program: "ordinatura", fullName: "Test Rezident", courseNumber: 1, ...extra });

const absent72 = (residentId) =>
  Attendance.insertMany(
    Array.from({ length: 9 }, (_, i) => ({
      resident: residentId,
      date: new Date(`${YM}-${String(i + 1).padStart(2, "0")}`),
      status: "absent",
      hours: 8,
      active: true,
    })),
  );

const gate = (hours) => {
  let open;
  const opened = new Promise((r) => {
    open = r;
  });
  return { countHours: () => opened.then(() => hours), open };
};
const tick = () => new Promise((r) => setTimeout(r, 30));
const args = (residentId, countHours = async () => 72) => ({
  residentId,
  residentName: "Test Rezident",
  source: "cron",
  countHours,
});
const liveFlag = async (id) => Resident.collection.findOne({ _id: id });

beforeAll(async () => {
  await Order.init();
});

describe("indeks — bir rezidentda bitta ochiq loyiha", () => {
  test("`resident_open_unique` quriladi: unique + `{status: \"loyiha\"}`", async () => {
    const idx = (await Order.collection.indexes()).find((i) => i.name === "resident_open_unique");
    expect(idx).toMatchObject({
      key: { resident: 1 },
      unique: true,
      partialFilterExpression: { status: "loyiha" },
    });
  });

  test("`status_draftedAt` quriladi", async () => {
    const idx = (await Order.collection.indexes()).find((i) => i.name === "status_draftedAt");
    expect(idx).toMatchObject({ key: { status: 1, draftedAt: -1 } });
  });

  test("ikkinchi `loyiha` — E11000; yopilgan hujjat to'smaydi", async () => {
    const resident = new mongoose.Types.ObjectId();
    const base = { resident, origin: "tizim", countingYear: "2026/2027", draftedAt: new Date() };
    await Order.create({ ...base, status: "bekor_qilingan" });
    await Order.create({ ...base, status: "loyiha" });
    await expect(Order.create({ ...base, status: "loyiha" })).rejects.toMatchObject({ code: 11000 });
  });
});

describe("ochish — hujjat qulf, bayroq ko'rsatkich", () => {
  test("bayroq ochilgan hujjatning `draftedAt` iga ko'rsatadi", async () => {
    const r = await newResident();
    expect((await openDraft(args(r._id))).opened).toBe(true);
    const order = await Order.findOne({ resident: r._id }).lean();
    const live = await liveFlag(r._id);
    expect(live.expulsionOrderCreated).toBe(true);
    expect(live.expulsionOrderCreatedAt.getTime()).toBe(order.draftedAt.getTime());
  });

  test("parallel ikki ochish, biri qayta hisobda USHLANGAN — aynan BITTA `opened: true`", async () => {
    const r = await newResident();
    const slow = gate(72);
    const a = openDraft(args(r._id, slow.countHours));
    await tick();
    const b = await openDraft(args(r._id));
    slow.open();
    const results = [await a, b];
    expect(results.filter((x) => x.opened)).toHaveLength(1);
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(1);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(true);
  });

  test("ushlangan ochuvchining soati tushdi — ochiq loyiha BAYROQSIZ qolmaydi", async () => {
    const r = await newResident();
    const slow = gate(20);
    const a = openDraft(args(r._id, slow.countHours));
    await tick();
    expect((await openDraft(args(r._id))).opened).toBe(true);
    slow.open();
    expect((await a).opened).toBe(false);
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(1);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(true);
  });

  test("`status` maydoni YO'Q eski hujjat ham ochiladi", async () => {
    const r = await newResident();
    await Resident.collection.updateOne({ _id: r._id }, { $unset: { status: "" } });
    expect((await openDraft(args(r._id))).opened).toBe(true);
  });

  test.each([
    ["akademik ta'til", { status: "akademik_tatil" }],
    ["soft-delete qilingan", { deletedAt: new Date() }],
    ["active:false (migratsiyaniki)", { active: false }],
  ])("%s — ochilmaydi", async (_label, patch) => {
    const r = await newResident();
    await Resident.collection.updateOne({ _id: r._id }, { $set: patch });
    expect((await openDraft(args(r._id))).opened).toBe(false);
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
  });

  test("ochuvchi ushlangan paytda rezident o'chirildi — ochiq loyiha QOLMAYDI", async () => {
    const r = await newResident();
    const slow = gate(72);
    const a = openDraft(args(r._id, slow.countHours));
    await tick();
    await r.softDelete(null, "test");
    await closeDraftForDeletedResident(r._id, null);
    slow.open();
    expect((await a).opened).toBe(false);
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(0);
  });

  test("ochiq hujjat bor-u bayroq yo'q (uzilish) — ko'rsatkich tiklanadi, xabarsiz", async () => {
    const r = await newResident();
    await Order.create({ resident: r._id, origin: "tizim", status: "loyiha", countingYear: "2026/2027", draftedAt: T0 });
    expect(await openDraft(args(r._id))).toEqual({ opened: false, reason: "already_open" });
    const live = await liveFlag(r._id);
    expect(live.expulsionOrderCreated).toBe(true);
    expect(live.expulsionOrderCreatedAt.getTime()).toBe(T0.getTime());
  });
});

describe("yopish — ko'rsatkich bo'yicha CAS", () => {
  test("`tizim` loyihasi yopiladi, bayroq tozalanadi, tarix ikki yozuvli", async () => {
    const r = await newResident();
    await openDraft(args(r._id));
    const snapshot = await Resident.findById(r._id);
    await cancelDraftBelowThreshold(snapshot, { hours: 20, source: "application" });
    const [order] = await Order.find({ resident: r._id }).lean();
    expect(order.status).toBe("bekor_qilingan");
    expect(order.closeReason).toBe("soat_72_dan_past");
    expect(order.history.map((h) => h.action)).toEqual(["yaratildi", "bekor_qilindi"]);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(false);
  });

  test("eskirgan surat — yangi ochilgan loyiha va uning bayrog'i TEGILMAYDI", async () => {
    const r = await newResident();
    await openDraft(args(r._id));
    const stale = await Resident.findById(r._id);
    await cancelDraftBelowThreshold(stale, { hours: 20, source: "application" });
    await openDraft(args(r._id));
    await cancelDraftBelowThreshold(stale, { hours: 20, source: "cron" });
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(1);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(true);
  });

  test("`meros` loyihasi YOPILMAYDI, bayroq tegilmaydi", async () => {
    const r = await newResident({ expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    await Order.create({ resident: r._id, origin: "meros", status: "loyiha", countingYear: "2025/2026", draftedAt: T0 });
    await cancelDraftBelowThreshold(await Resident.findById(r._id), { hours: 0, source: "cron" });
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(1);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(true);
  });

  test("o'chirilgan rezident — `meros` ham yopiladi, bayroq tozalanadi", async () => {
    const r = await newResident({ expulsionOrderCreated: true });
    await Order.create({ resident: r._id, origin: "meros", status: "loyiha", countingYear: "2025/2026", draftedAt: new Date() });
    await r.softDelete(null, "test");
    await closeDraftForDeletedResident(r._id, null);
    const [order] = await Order.find({ resident: r._id }).lean();
    expect(order).toMatchObject({ status: "bekor_qilingan", closeReason: "rezident_ochirildi" });
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(false);
  });
});

describe("xabarlarni bekor qilish — ochiq loyihaniki TEGILMAYDI", () => {
  test("yopilgan loyihaniki va id'siz eskisi olinadi, OCHIQ loyihaniki qoladi", async () => {
    const r = await newResident();
    const closed = await Order.create({ resident: r._id, origin: "tizim", status: "bekor_qilingan", countingYear: "2026/2027", draftedAt: T0 });
    const open = await Order.create({ resident: r._id, origin: "tizim", status: "loyiha", countingYear: "2026/2027", draftedAt: new Date() });
    const user = new mongoose.Types.ObjectId();
    const make = (orderId) =>
      Notification.create({
        user,
        eventType: "residency_expulsion_draft_office",
        title: "t",
        active: true,
        metadata: orderId ? { residentId: String(r._id), orderId: String(orderId) } : { residentId: String(r._id) },
      });
    const [oldN, legacyN, openN] = await Promise.all([make(closed._id), make(null), make(open._id)]);
    await revokeExpulsionNotice(r._id);
    const active = async (doc) => (await Notification.findById(doc._id).lean()).active;
    expect(await active(oldN)).toBe(false);
    expect(await active(legacyN)).toBe(false);
    expect(await active(openN)).toBe(true);
  });
});

describe("to'liq zanjir — `runExpulsionCheck`", () => {
  test("72 soat → bitta loyiha; takror tekshiruv ikkinchisini ochmaydi; sabab → yopiladi", async () => {
    const r = await newResident();
    await absent72(r._id);

    await runExpulsionCheck(r._id);
    await runExpulsionCheck(r._id);
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(1);
    expect((await liveFlag(r._id)).expulsionOrderCreated).toBe(true);

    await Attendance.updateMany({ resident: r._id }, { $set: { status: "excused" } });
    await runExpulsionCheck(r._id);

    const [order] = await Order.find({ resident: r._id }).lean();
    expect(order.status).toBe("bekor_qilingan");
    expect(order.history.map((h) => h.source)).toEqual(["attendance", "attendance"]);
    const live = await liveFlag(r._id);
    expect(live.expulsionOrderCreated).toBe(false);
    expect(live.totalUnexcusedHours).toBe(0);
  });

  test("`active:false` + bayroq (migratsiya kutilmoqda) — davomat bayroqqa TEGMAYDI", async () => {
    const r = await newResident({ active: false, expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    await runExpulsionCheck(r._id);
    const live = await liveFlag(r._id);
    expect(live.expulsionOrderCreated).toBe(true);
    expect(live.active).toBe(false);
    expect(await Order.countDocuments({ resident: r._id })).toBe(0);
  });

  test("hujjatsiz eski bayroq + 72 soat — oddiy loyiha ochiladi", async () => {
    const r = await newResident({ expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    await absent72(r._id);
    await runExpulsionCheck(r._id);
    const [order] = await Order.find({ resident: r._id }).lean();
    expect(order.history.map((h) => h.action)).toEqual(["yaratildi"]);
    expect((await liveFlag(r._id)).expulsionOrderCreatedAt.getTime()).toBe(order.draftedAt.getTime());
  });
});
