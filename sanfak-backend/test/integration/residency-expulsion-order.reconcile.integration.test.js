"use strict";

const mongoose = require("mongoose");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const {
  openDraft,
  settleDraftNotices,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  revokeNoticesWithoutOpenDraft,
} = require("#modules/4.05-residency/_services/expulsionReversal");
const {
  runExpulsionSweep,
} = require("#modules/4.05-residency/_services/expulsionCheck");

const T0 = new Date("2026-09-20T08:00:00Z");
const newResident = (extra = {}) =>
  Resident.create({ program: "ordinatura", fullName: "Test Rezident", courseNumber: 1, ...extra });
const order = (resident, extra = {}) =>
  Order.create({ resident, origin: "tizim", status: "loyiha", countingYear: "2026/2027", draftedAt: T0, ...extra });
const notice = (residentId, orderId) =>
  Notification.create({
    user: new mongoose.Types.ObjectId(),
    eventType: "residency_expulsion_draft_office",
    title: "t",
    active: true,
    metadata: orderId
      ? { residentId: String(residentId), orderId: String(orderId) }
      : { residentId: String(residentId) },
  });
const isActive = async (doc) => (await Notification.findById(doc._id).lean()).active;
const raw = (id) => Resident.collection.findOne({ _id: id });

beforeAll(() => Order.init());

describe("kech saqlangan xabar", () => {
  test("loyiha yopilgach saqlangan xabar — `settleDraftNotices` uni oladi", async () => {
    const r = await newResident();
    const o = await order(r._id, { status: "bekor_qilingan" });
    const late = await notice(r._id, o._id);
    await settleDraftNotices(r._id, o._id);
    expect(await isActive(late)).toBe(false);
  });

  test("loyiha hali ochiq — `settle` xabarga TEGMAYDI", async () => {
    const r = await newResident();
    const o = await order(r._id);
    const n = await notice(r._id, o._id);
    await settleDraftNotices(r._id, o._id);
    expect(await isActive(n)).toBe(true);
  });
});

describe("eskirgan xabarlarni kunlik tozalash", () => {
  test("ochiq loyihasi yo'q rezidentniki olinadi; ochiq loyihalisi va yangisi QOLADI", async () => {
    const stale = await newResident();
    const live = await newResident();
    const staleN = await notice(stale._id, new mongoose.Types.ObjectId());
    const legacyN = await notice(stale._id, null);
    const o = await order(live._id);
    const liveN = await notice(live._id, o._id);

    const startedAt = new Date(Date.now() + 1);
    const fresh = await Notification.create({
      user: new mongoose.Types.ObjectId(),
      eventType: "residency_expulsion",
      title: "t",
      active: true,
      metadata: { residentId: String(stale._id) },
      createdAt: new Date(startedAt.getTime() + 60000),
    });

    await revokeNoticesWithoutOpenDraft(startedAt);
    expect(await isActive(staleN)).toBe(false);
    expect(await isActive(legacyN)).toBe(false);
    expect(await isActive(liveN)).toBe(true);
    expect(await isActive(fresh)).toBe(true);
  });
});

describe("sweep boshidagi yarashtirish", () => {
  test("bayroqsiz ochiq loyiha (uzilish) + soat 0 — shu sweep'da YOPILADI", async () => {
    const r = await newResident();
    await order(r._id);
    await runExpulsionSweep();
    const [o] = await Order.find({ resident: r._id }).lean();
    expect(o.status).toBe("bekor_qilingan");
    expect((await raw(r._id)).expulsionOrderCreated).toBe(false);
  });

  test("o'chirilgan rezidentning ochiq loyihasi — sweep YOPADI", async () => {
    const r = await newResident({ expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    await order(r._id);
    await r.softDelete(null, "test");
    await runExpulsionSweep();
    const [o] = await Order.find({ resident: r._id }).lean();
    expect(o).toMatchObject({ status: "bekor_qilingan", closeReason: "rezident_ochirildi" });
  });

  test("sweep qaytganda bekor qilingan loyiha xabari ALLAQACHON faol emas", async () => {
    const r = await newResident({ expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    const o = await order(r._id);
    const n = await notice(r._id, o._id);
    await runExpulsionSweep();
    expect(await isActive(n)).toBe(false);
  });
});

describe("shartli ko'rsatkich yozuvi", () => {
  test("rezident hujjat yozilgach o'chirilsa — bayroq QO'YILMAYDI, loyiha qolmaydi", async () => {
    const r = await newResident();
    let release;
    const gate = new Promise((res) => {
      release = res;
    });
    const running = openDraft({
      residentId: r._id,
      residentName: "Test",
      source: "cron",
      countHours: async () => {
        await gate;
        return 72;
      },
    });
    await new Promise((res) => setTimeout(res, 30));
    await Resident.collection.updateOne({ _id: r._id }, { $set: { deletedAt: new Date() } });
    release();
    expect((await running).opened).toBe(false);
    expect((await raw(r._id)).expulsionOrderCreated).not.toBe(true);
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(0);
  });
});

const YM = (() => {
  const d = new Date(currentAcademicYearWindow().from);
  d.setUTCMonth(d.getUTCMonth() + 2);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
})();
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
const officeUser = async () => {
  const role = await RoleModel.create({
    title: "magistratura_bolim",
    desc: "test",
    permissions: [],
    scopeLevel: "global",
    active: true,
  });
  return UserModel.create({ firstName: "Nodira", lastName: "Karimova", role: role._id, active: true });
};
const officeNotices = (orderId) =>
  Notification.find({ eventType: "residency_expulsion_draft_office", "metadata.orderId": String(orderId) }).lean();

describe("3-tur — e'lon qilinmay qolgan loyiha", () => {
  test("10 daqiqadan eski e'lonsiz `tizim` loyiha — sweep E'LON QILADI", async () => {
    await officeUser();
    const r = await newResident();
    await absent72(r._id);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const o = await order(r._id, { draftedAt: old });
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: old } },
    );

    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(1);
    expect((await Order.findById(o._id).lean()).noticesSentAt).toBeInstanceOf(Date);

    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(1);
  });

  test("hali oynadagi (yangi) e'lonsiz loyiha — ochuvchining o'zi yuboradi, sweep TEGMAYDI", async () => {
    await officeUser();
    const r = await newResident();
    await absent72(r._id);
    const now = new Date();
    const o = await order(r._id, { draftedAt: now });
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: now } },
    );
    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(0);
  });

  test("`meros` loyiha — ATAYLAB xabarsiz, sweep e'lon qilmaydi", async () => {
    await officeUser();
    const r = await newResident({ expulsionOrderCreated: true, expulsionOrderCreatedAt: T0 });
    const o = await order(r._id, { origin: "meros" });
    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(0);
  });
});

describe("3-tur — ochiq loyihasi bor rezidentdagi eski xabar", () => {
  test("yopilgan loyihaning id'li xabari olinadi; ochiqniki va id'siz eskisi QOLADI", async () => {
    const r = await newResident();
    const closed = await order(r._id, { status: "bekor_qilingan" });
    const open = await order(r._id, { draftedAt: new Date() });
    const oldN = await notice(r._id, closed._id);
    const openN = await notice(r._id, open._id);
    const legacyN = await notice(r._id, null);
    await revokeNoticesWithoutOpenDraft(new Date(Date.now() + 1000));
    expect(await isActive(oldN)).toBe(false);
    expect(await isActive(openN)).toBe(true);
    expect(await isActive(legacyN)).toBe(true);
  });
});

describe("4-tur — e'lon tartibi va belgisi", () => {
  test("soati tushgan e'lonsiz loyiha — yopiladi, bo'limga xabar KETMAYDI", async () => {
    await officeUser();
    const r = await newResident();
    const o = await order(r._id, { draftedAt: new Date(Date.now() - 60 * 60 * 1000) });
    await runExpulsionSweep();
    expect((await Order.findById(o._id).lean()).status).toBe("bekor_qilingan");
    expect(await officeNotices(o._id)).toHaveLength(0);
  });

  test("yetkazib bo'lmadi (qabul qiluvchi yo'q) — belgi QO'YILMAYDI, keyingi sweep e'lon qiladi", async () => {
    const r = await newResident();
    await absent72(r._id);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const o = await order(r._id, { draftedAt: old });
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: old } },
    );
    await runExpulsionSweep();
    expect((await Order.findById(o._id).lean()).noticesSentAt).toBeNull();

    await officeUser();
    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(1);
    expect((await Order.findById(o._id).lean()).noticesSentAt).toBeInstanceOf(Date);
  });

  test("boshqa (eski) buyruqning xabari hisobga OLINMAYDI — yangi loyiha e'lon qilinadi", async () => {
    await officeUser();
    const r = await newResident();
    await absent72(r._id);
    const oldOrder = await order(r._id, { status: "bekor_qilingan" });
    const oldN = await notice(r._id, oldOrder._id);
    await Notification.updateOne({ _id: oldN._id }, { $set: { active: false } });
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const o = await order(r._id, { draftedAt: old });
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: old } },
    );
    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(1);
  });

  test("xabarining bir qismi saqlangan loyiha — TAKRORLANMAYDI, faqat belgilanadi", async () => {
    await officeUser();
    const r = await newResident();
    await absent72(r._id);
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const o = await order(r._id, { draftedAt: old });
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { expulsionOrderCreated: true, expulsionOrderCreatedAt: old } },
    );
    await notice(r._id, o._id);
    await runExpulsionSweep();
    expect(await officeNotices(o._id)).toHaveLength(1);
    expect((await Order.findById(o._id).lean()).noticesSentAt).toBeInstanceOf(Date);
  });
});
