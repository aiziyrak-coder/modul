"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const Notification = require("#system/notification/notification.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const UserModel = require("#modules/4.01-auth/user/user.model");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { remindOpenDrafts, remindOne } = require("#modules/4.05-residency/_services/expulsionOfficeNotices");
const { findDueReminders } = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const { rejectOrder } = require("#modules/4.05-residency/_services/expulsionOrderDecision");
const { countUnexcusedHours, runExpulsionSweep } = require("#modules/4.05-residency/_services/expulsionCheck");
const {
  currentAcademicYearTitle,
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const OFFICE = "residency_expulsion_draft_office";
const DAY = 24 * 3600 * 1000;
const C = new Date("2031-10-01T03:00:00Z");
const at = (k) => new Date(C.getTime() + k * DAY);

let office;
beforeAll(() => Order.init());
beforeEach(async () => {
  const role = await RoleModel.create({ title: "magistratura_bolim", scopeLevel: "global", active: true });
  office = await Promise.all(
    ["A", "B"].map((n) => UserModel.create({ firstName: n, lastName: "Bolim", role: role._id, active: true })),
  );
});
afterEach(() => jest.restoreAllMocks());

async function draft({ origin = "tizim", createdAt = C, noticesSentAt = createdAt, resident = {}, order = {} } = {}) {
  const r = await Resident.create({ program: "ordinatura", fullName: "Valiyev Ali", courseNumber: 1, ...resident });
  const o = await Order.create({
    resident: r._id,
    residentName: "Valiyev (snapshot)",
    origin,
    status: "loyiha",
    countingYear: currentAcademicYearTitle(createdAt),
    draftedAt: createdAt,
    noticesSentAt,
    history: [{ at: createdAt, action: "yaratildi", source: "cron" }],
    ...order,
  });
  await Order.collection.updateOne({ _id: o._id }, { $set: { createdAt } });
  return { r, id: o._id };
}

const reminders = (id, extra = {}) =>
  Notification.find({ eventType: OFFICE, "metadata.orderId": String(id), "metadata.reminderStage": { $exists: true }, ...extra }).lean();
const stageOf = async (id) => (await Order.findById(id).select("remindedStage").lean()).remindedStage;

function holdSend() {
  let release;
  let reached;
  const gate = new Promise((res) => {
    release = res;
  });
  const arrived = new Promise((res) => {
    reached = res;
  });
  const send = async (payload) => {
    reached();
    await gate;
    return dispatch(payload);
  };
  return { send, arrived, release };
}

describe("kadans va bosqich belgisi", () => {
  test("3, 7, 14-kun — har biri bir marta; eskisi faol ro'yxatdan chiqadi, 0-kun qoladi; faqat ilova ichida", async () => {
    const { r, id } = await draft();
    const day0 = await Notification.create({
      user: office[0]._id, eventType: OFFICE, title: "0-kun", body: "x",
      metadata: { residentId: String(r._id), orderId: String(id) },
    });
    const sentAt = {};
    for (const k of [0, 1, 2, 3, 3, 4, 6, 7, 8, 13, 14]) sentAt[k] = (sentAt[k] || 0) + (await remindOpenDrafts(at(k)));
    expect(Object.entries(sentAt).filter(([, n]) => n).map(([k, n]) => [Number(k), n])).toEqual([[3, 1], [7, 1], [14, 1]]);
    const rows = await reminders(id);
    expect(rows).toHaveLength(6);
    expect(rows.filter((n) => n.active).map((n) => n.metadata.reminderStage)).toEqual([3, 3]);
    expect(await stageOf(id)).toBe(3);
    expect((await Notification.findById(day0._id).lean()).active).toBe(true);
    for (const n of rows) {
      expect(n.deliveryStatus?.telegram).toBeUndefined();
      expect(n.body).toMatch(/^Valiyev Ali — chetlatish buyrug'i loyihasi \d+ kundan beri bo'lim qarorini/);
    }
    expect(rows.map((n) => String(n.user)).sort()).toEqual(
      [...office, ...office, ...office].map((u) => String(u._id)).sort(),
    );
  });

  test("o'tkazib yuborilgan kunlar — BITTA eslatma (eng yuqori bosqich)", async () => {
    const { id } = await draft();
    await remindOpenDrafts(at(20));
    expect((await reminders(id)).map((n) => n.metadata.reminderStage)).toEqual([3, 3]);
  });

  test("`remindedStage` maydoni YO'Q eski hujjat ham band qilinadi", async () => {
    const { id } = await draft();
    await Order.collection.updateOne({ _id: id }, { $unset: { remindedStage: "" } });
    await remindOpenDrafts(at(3));
    expect(await stageOf(id)).toBe(1);
  });
});

describe("kim eslatma oladi", () => {
  test("e'lon qilinmagan `tizim` — yo'q; `meros` — e'lonsiz ham, 3-kundan", async () => {
    const t = await draft({ noticesSentAt: null });
    const m = await draft({ origin: "meros", noticesSentAt: null, order: { draftedAt: new Date("2025-03-01") } });
    await remindOpenDrafts(at(2));
    await remindOpenDrafts(at(5));
    expect(await reminders(t.id)).toHaveLength(0);
    expect((await reminders(m.id)).map((n) => n.metadata.reminderStage)).toEqual([1, 1]);
  });

  test.each([
    ["imzolangan (yarim imzo ham)", { order: { status: "imzolangan", residentAppliedAt: null } }],
    ["bekor qilingan", { order: { status: "bekor_qilingan" } }],
    ["rad etilgan", { order: { status: "rad_etilgan" } }],
    ["nofaol rezident", { resident: { active: false } }],
    ["ta'tildagi rezident (`tizim`)", { resident: { status: "akademik_tatil" } }],
    ["chetlatilgan rezident", { resident: { status: "chetlatilgan" } }],
  ])("%s — eslatma yo'q, bosqich tegilmaydi", async (_label, opts) => {
    const { id } = await draft(opts);
    await remindOpenDrafts(at(3));
    expect(await reminders(id)).toHaveLength(0);
    expect(await stageOf(id)).toBeNull();
  });

  test("ta'tildagi rezidentning `meros` loyihasi — eslatma BOR (V-1=B)", async () => {
    const { id } = await draft({ origin: "meros", noticesSentAt: null, resident: { status: "akademik_tatil" } });
    await remindOpenDrafts(at(3));
    expect(await reminders(id)).toHaveLength(2);
  });

  test("o'chirilgan rezident — eslatma yo'q", async () => {
    const { r, id } = await draft();
    await Resident.collection.updateOne({ _id: r._id }, { $set: { deletedAt: new Date() } });
    await remindOpenDrafts(at(3));
    expect(await reminders(id)).toHaveLength(0);
  });

  test("bo'lim bo'sh — band qilinmaydi; xodim paydo bo'lgach keyingi ishga tushishda ketadi", async () => {
    const { id } = await draft();
    await UserModel.updateMany({}, { $set: { active: false } });
    await remindOpenDrafts(at(3));
    expect(await stageOf(id)).toBeNull();
    await UserModel.updateMany({}, { $set: { active: true } });
    await remindOpenDrafts(at(3));
    expect(await reminders(id)).toHaveLength(2);
  });

  test("hech narsa saqlanmadi — bosqich QAYTARILADI, keyingi ishga tushish yuboradi", async () => {
    const { id } = await draft();
    await remindOpenDrafts(at(3), { send: async () => ({ notification: null }) });
    expect(await stageOf(id)).toBeNull();
    await remindOpenDrafts(at(3));
    expect(await stageOf(id)).toBe(1);
    expect(await reminders(id)).toHaveLength(2);
  });
});

describe("2-bosqichda saqlanmaslik", () => {
  const failFor = (who) => async (p) => (who(String(p.userId)) ? { notification: null } : dispatch(p));

  test("qisman: saqlangan xodimda eski bosqich chiqadi, saqlanmaganda eskisi FAOL qoladi", async () => {
    const { id } = await draft();
    await remindOpenDrafts(at(3));
    const b = String(office[1]._id);
    await remindOpenDrafts(at(7), { send: failFor((u) => u === b) });
    expect(await stageOf(id)).toBe(2);
    const active = (await reminders(id, { active: true })).map((n) => [String(n.user) === b ? "B" : "A", n.metadata.reminderStage]);
    expect(active.sort()).toEqual([["A", 2], ["B", 1]]);
  });

  test("to'liq: bosqich 1 ga qaytadi, 1-bosqich eslatmalari faol qoladi, keyingi ishga tushish yuboradi", async () => {
    const { id } = await draft();
    await remindOpenDrafts(at(3));
    await remindOpenDrafts(at(7), { send: failFor(() => true) });
    expect(await stageOf(id)).toBe(1);
    expect((await reminders(id, { active: true })).map((n) => n.metadata.reminderStage)).toEqual([1, 1]);
    await remindOpenDrafts(at(8));
    expect(await stageOf(id)).toBe(2);
  });
});

describe("to'liq sweep (haqiqiy soat)", () => {
  async function withHours(r, hours) {
    const from = new Date(currentAcademicYearWindow().from);
    await Attendance.insertMany(
      Array.from({ length: hours / 8 }, (_, i) => ({
        resident: r._id, date: new Date(from.getTime() + (20 + i) * DAY), status: "absent", hours: 8, active: true,
      })),
    );
  }

  test("muvaffaqiyatli sweep eslatadi; soati tushgan loyiha yopiladi va eslatma olmaydi", async () => {
    const three = new Date(Date.now() - 3 * DAY);
    const due = await draft({ createdAt: three });
    const low = await draft({ createdAt: three });
    await withHours(due.r, 72);
    await withHours(low.r, 16);
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect(await reminders(due.id, { active: true })).toHaveLength(2);
    expect((await Order.findById(low.id).lean()).status).toBe("bekor_qilingan");
    expect(await reminders(low.id, { active: true })).toHaveLength(0);
  });

  test("0-kun e'loni shu sweep'da ketgan loyiha — shu kuni eslatma YO'Q", async () => {
    const three = new Date(Date.now() - 3 * DAY);
    const late = await draft({ createdAt: three, noticesSentAt: null });
    await withHours(late.r, 72);
    await expect(runExpulsionSweep()).resolves.toBe(true);
    expect((await Order.findById(late.id).lean()).noticesSentAt).not.toBeNull();
    expect(await Notification.countDocuments({ eventType: OFFICE, "metadata.orderId": String(late.id) })).toBe(2);
    expect(await reminders(late.id)).toHaveLength(0);
  });

  test("sweep yiqilsa — eslatma yo'q, natija `false`", async () => {
    const due = await draft({ createdAt: new Date(Date.now() - 3 * DAY) });
    jest.spyOn(Resident, "find").mockImplementationOnce(() => ({
      populate: () => Promise.reject(new Error("Mongo down")),
    }));
    await expect(runExpulsionSweep()).resolves.toBe(false);
    expect(await reminders(due.id)).toHaveLength(0);
  });
});

describe("yopilish va poygalar", () => {
  const ACTOR = { _id: null, lastName: "Karimova", firstName: "Nodira" };

  test("rad etilgach bu loyihaning barcha eslatmalari faol ro'yxatdan chiqadi", async () => {
    const { id } = await draft();
    await remindOpenDrafts(at(3));
    await rejectOrder({ orderId: id, reason: "Sababli", actor: ACTOR, countHours: countUnexcusedHours });
    expect(await reminders(id, { active: true })).toHaveLength(0);
  });

  test("G1 — bosqichni ushlab turgan ishga tushish bor paytda ikkinchisi hech narsa yubormaydi", async () => {
    const { id } = await draft();
    const hold = holdSend();
    const a = remindOpenDrafts(at(3), { send: hold.send });
    await hold.arrived;
    await expect(remindOpenDrafts(at(3))).resolves.toBe(0);
    hold.release();
    await expect(a).resolves.toBe(1);
    expect(await reminders(id)).toHaveLength(2);
  });

  test("eskirgan o'qish: boshqa ishga tushish bosqichni oldi / loyiha yopildi — CAS yutqazadi, yuborish yo'q", async () => {
    const one = await draft();
    const two = await draft();
    const [staleOne, staleTwo] = await findDueReminders(at(3));
    const ctx = { recipients: office.map((u) => u._id) };
    await remindOpenDrafts(at(3));
    await Order.updateOne({ _id: two.id }, { $set: { status: "bekor_qilingan", remindedStage: null } });
    await expect(remindOne(staleOne, ctx)).resolves.toBe(false);
    await expect(remindOne(staleTwo, ctx)).resolves.toBe(false);
    expect(await reminders(one.id)).toHaveLength(2);
    expect(await stageOf(two.id)).toBeNull();
  });

  test("G2 — yuborish paytida rad etildi: yangi eslatmalar darhol faol ro'yxatdan chiqadi", async () => {
    const { id } = await draft();
    const hold = holdSend();
    const a = remindOpenDrafts(at(3), { send: hold.send });
    await hold.arrived;
    await rejectOrder({ orderId: id, reason: "Sababli", actor: ACTOR, countHours: countUnexcusedHours });
    hold.release();
    await a;
    expect(await reminders(id)).toHaveLength(2);
    expect(await reminders(id, { active: true })).toHaveLength(0);
  });
});
