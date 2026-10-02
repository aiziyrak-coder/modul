"use strict";

const mongoose = require("mongoose");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  openDraft,
  reconcileDrafts,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  currentAcademicYearWindow,
} = require("#modules/4.05-residency/_services/unexcusedWindow");

const newResident = (extra = {}) =>
  Resident.create({ program: "ordinatura", fullName: "Test Rezident", courseNumber: 1, ...extra });

const gate = (hours) => {
  let open;
  const opened = new Promise((r) => {
    open = r;
  });
  return { countHours: () => opened.then(() => hours), open };
};
const tick = () => new Promise((r) => setTimeout(r, 30));
const args = (residentId, countHours) => ({
  residentId,
  residentName: "Test Rezident",
  source: "cron",
  countHours,
});
const hoursOf = (h) => async () => h;
const raw = (id) => Resident.collection.findOne({ _id: id });
const ordersOf = (resident) => Order.find({ resident }).sort({ createdAt: 1 }).lean();

const materialiseSigned = (orderId, signedAt = new Date()) =>
  Order.updateOne({ _id: orderId, status: "loyiha" }, { $set: { status: "imzolangan", signedAt } });

const materialiseRejected = (orderId, hoursAtClose, closedAt = new Date()) =>
  Order.updateOne(
    { _id: orderId, status: "loyiha" },
    { $set: { status: "rad_etilgan", closedAt, hoursAtClose, closeReason: null } },
  );

async function withOpenDraft(hours = 72) {
  const r = await newResident();
  const res = await openDraft(args(r._id, hoursOf(hours)));
  expect(res.opened).toBe(true);
  const order = await Order.findById(res.orderId).lean();
  return { r, order };
}

beforeAll(() => Order.init());

describe("G4 — ochuvchi ushlangan paytda imzolandi", () => {
  test("`create` o'tadi (S1 o'rinni bo'shatdi), keyin o'zini QAYTARADI — ikkinchi loyiha va ko'rsatkich yo'q", async () => {
    const { r, order: a } = await withOpenDraft();
    const g = gate(80);
    const opener = openDraft(args(r._id, g.countHours));
    await tick();
    await materialiseSigned(a._id);
    g.open();
    expect(await opener).toEqual({ opened: false, reason: "signed_order" });

    const orders = await ordersOf(r._id);
    expect(orders.map((o) => o.status)).toEqual(["imzolangan"]);
    const live = await raw(r._id);
    expect(live.expulsionOrderCreated).toBe(true);
    expect(live.expulsionOrderCreatedAt).toEqual(a.draftedAt);
  });

  test("imzodan keyin kelgan ochuvchi — oldingi tekshiruvda to'xtaydi", async () => {
    const { r, order: a } = await withOpenDraft();
    await materialiseSigned(a._id);
    expect(await openDraft(args(r._id, hoursOf(90)))).toEqual({ opened: false, reason: "signed_order" });
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);
  });
});

describe("G4b — adashgan loyiha paytidagi uchinchi ochuvchi", () => {
  test("E11000 ta'miri imzolangan buyruq bor paytda bayroqqa TEGMAYDI", async () => {
    const { r, order: a } = await withOpenDraft();
    const g = gate(80);
    const third = openDraft(args(r._id, g.countHours));
    await tick();
    await materialiseSigned(a._id);
    const stray = await Order.create({
      resident: r._id,
      origin: "tizim",
      status: "loyiha",
      countingYear: a.countingYear,
      draftedAt: new Date(),
    });
    g.open();
    expect(await third).toEqual({ opened: false, reason: "already_open" });
    expect((await raw(r._id)).expulsionOrderCreatedAt).toEqual(a.draftedAt);

    await Order.deleteOne({ _id: stray._id, status: "loyiha" });
    await Resident.updateOne(
      { _id: r._id, expulsionOrderCreated: true, expulsionOrderCreatedAt: stray.draftedAt },
      { $set: { expulsionOrderCreated: false, expulsionOrderCreatedAt: null } },
    );
    expect((await raw(r._id)).expulsionOrderCreated).toBe(true);
  });
});

describe("G6 — rad etish belgi chizig'i (U-3)", () => {
  test("74 da rad etildi: 74 — ochilmaydi, 75 — ochiladi", async () => {
    const { r, order: a } = await withOpenDraft(74);
    await materialiseRejected(a._id, 74);
    expect(await openDraft(args(r._id, hoursOf(74)))).toEqual({ opened: false, reason: "reject_watermark" });
    expect((await openDraft(args(r._id, hoursOf(75)))).opened).toBe(true);
  });

  test("rad etish O'TGAN o'quv yilida — joriy yilda 72 bilan ochiladi", async () => {
    const { r, order: a } = await withOpenDraft(90);
    const lastYear = new Date(currentAcademicYearWindow().from.getTime() - 24 * 3600 * 1000);
    await materialiseRejected(a._id, 90, lastYear);
    expect((await openDraft(args(r._id, hoursOf(72)))).opened).toBe(true);
  });

  test("eskirgan bayroq (rad etish uzilgan) — ochilmaydi, bayroq TOZALANADI", async () => {
    const { r, order: a } = await withOpenDraft(74);
    await materialiseRejected(a._id, 74);
    expect((await raw(r._id)).expulsionOrderCreated).toBe(true);
    expect((await openDraft(args(r._id, hoursOf(74)))).reason).toBe("reject_watermark");
    expect((await raw(r._id)).expulsionOrderCreated).toBe(false);
  });

  test("ochuvchi ushlangan paytda rad etildi — `create` dan keyin o'zini QAYTARADI", async () => {
    const { r, order: a } = await withOpenDraft(76);
    const g = gate(76);
    const opener = openDraft(args(r._id, g.countHours));
    await tick();
    await materialiseRejected(a._id, 76);
    g.open();
    expect(await opener).toEqual({ opened: false, reason: "reject_watermark" });
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(0);
  });
});

describe("G10 — yarashtirish", () => {
  test("imzolangan buyrug'i bor rezidentning adashgan loyihasi yopiladi, bayroq tegilmaydi", async () => {
    const { r, order: a } = await withOpenDraft();
    await materialiseSigned(a._id, new Date(Date.now() - 3600 * 1000));
    const stray = await Order.create({
      resident: r._id,
      origin: "tizim",
      status: "loyiha",
      countingYear: a.countingYear,
      draftedAt: new Date(),
    });
    await reconcileDrafts();
    const closed = await Order.findById(stray._id).lean();
    expect(closed).toMatchObject({ status: "bekor_qilingan", closeReason: "imzolangan_buyruq_bor" });
    expect(closed.history.at(-1)).toMatchObject({ action: "bekor_qilindi", source: "cron" });
    const live = await raw(r._id);
    expect(live.expulsionOrderCreatedAt).toEqual(a.draftedAt);
    expect(live.status).toBe("oquvda");
    expect((await Order.findById(a._id).lean()).residentAppliedAt).toBeNull();
  });

  test("S2 bajarilgan-u belgi qolib ketgan — belgi qo'yiladi (o'chirilgan rezident ham)", async () => {
    const { r, order: a } = await withOpenDraft();
    await materialiseSigned(a._id, new Date(Date.now() - 3600 * 1000));
    await Resident.collection.updateOne(
      { _id: r._id },
      { $set: { status: "chetlatilgan", deletedAt: new Date() } },
    );
    await reconcileDrafts();
    expect((await Order.findById(a._id).lean()).residentAppliedAt).toBeInstanceOf(Date);
  });

  test("yangi imzo (oyna ichida) — tegilmaydi", async () => {
    const { r, order: a } = await withOpenDraft();
    await materialiseSigned(a._id);
    await Resident.collection.updateOne({ _id: r._id }, { $set: { status: "chetlatilgan" } });
    await reconcileDrafts();
    expect((await Order.findById(a._id).lean()).residentAppliedAt).toBeNull();
  });
});

test("imzolangan hujjat indeks qulfini band QILMAYDI (qulf — kod darajasida)", async () => {
  const resident = new mongoose.Types.ObjectId();
  const base = { resident, origin: "tizim", countingYear: "2026/2027", draftedAt: new Date() };
  await Order.create({ ...base, status: "imzolangan" });
  await expect(Order.create({ ...base, status: "loyiha" })).resolves.toBeDefined();
});

describe("ko'rik (P6a-2) — belgi chizig'i va yarim imzo chekkalari", () => {
  const HOUR = 3600 * 1000;

  test("eskirgan soat: create'dan keyingi JONLI hisob belgi chizig'ini ko'radi", async () => {
    const { r, order: a } = await withOpenDraft(80);
    let release;
    const held = new Promise((x) => {
      release = x;
    });
    let calls = 0;
    const countHours = async () => {
      calls += 1;
      if (calls === 1) {
        await held;
        return 80;
      }
      return 76;
    };
    const opener = openDraft(args(r._id, countHours));
    await tick();
    await materialiseRejected(a._id, 76);
    release();
    expect(await opener).toEqual({ opened: false, reason: "reject_watermark" });
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(0);
  });

  test("ikki rad etish — oxirgisi (80) to'sadi", async () => {
    const { r, order: a } = await withOpenDraft(74);
    await materialiseRejected(a._id, 74);
    const b = await openDraft(args(r._id, hoursOf(80)));
    expect(b.opened).toBe(true);
    await materialiseRejected(b.orderId, 80);
    expect((await openDraft(args(r._id, hoursOf(78)))).reason).toBe("reject_watermark");
  });

  test("yarim imzo bayroqsiz — yarashtirish bayroqni tiklaydi, `chetlatilgan` yozmaydi", async () => {
    const r = await newResident();
    const o = await Order.create({
      resident: r._id,
      origin: "tizim",
      status: "imzolangan",
      countingYear: "2026/2027",
      draftedAt: new Date(Date.now() - 2 * HOUR),
      signedAt: new Date(Date.now() - HOUR),
    });
    await reconcileDrafts();
    const live = await raw(r._id);
    expect(live).toMatchObject({ status: "oquvda", expulsionOrderCreated: true });
    expect(live.expulsionOrderCreatedAt).toEqual(o.draftedAt);
  });

  describe("uzilishdan qolgan, ochuvchi o'zi rad etgan loyiha", () => {
    const stray = (resident, extra = {}) =>
      Order.create({
        resident,
        origin: "tizim",
        status: "loyiha",
        countingYear: "2026/2027",
        draftedAt: new Date(Date.now() - HOUR),
        hoursAtDraft: 76,
        ...extra,
      });

    test("ta'tildagi rezident (I9) — `yaroqsiz_loyiha` bilan yopiladi, bayroq yo'naltirilmaydi", async () => {
      const r = await newResident({ status: "akademik_tatil" });
      const o = await stray(r._id);
      await reconcileDrafts();
      expect(await Order.findById(o._id).lean()).toMatchObject({ status: "bekor_qilingan", closeReason: "yaroqsiz_loyiha" });
      expect((await raw(r._id)).expulsionOrderCreated).toBe(false);
    });

    test("belgi chizig'i to'sgan (I7) — yopiladi, e'lonsiz", async () => {
      const r = await newResident();
      await Order.create({
        resident: r._id,
        origin: "tizim",
        status: "rad_etilgan",
        countingYear: "2026/2027",
        draftedAt: new Date(Date.now() - 3 * HOUR),
        closedAt: new Date(Date.now() - 2 * HOUR),
        hoursAtClose: 76,
      });
      const o = await stray(r._id);
      await reconcileDrafts();
      expect((await Order.findById(o._id).lean()).closeReason).toBe("yaroqsiz_loyiha");
      expect((await raw(r._id)).expulsionOrderCreated).toBe(false);
    });

    test("e'lon qilingan loyiha va oynadagi yangisi — TEGILMAYDI (ko'rsatkich tiklanadi)", async () => {
      const r = await newResident({ status: "akademik_tatil" });
      const announced = await stray(r._id, { noticesSentAt: new Date() });
      await reconcileDrafts();
      expect((await Order.findById(announced._id).lean()).status).toBe("loyiha");
      const fresh = await newResident({ status: "akademik_tatil" });
      const inFlight = await stray(fresh._id, { draftedAt: new Date() });
      await reconcileDrafts();
      expect((await Order.findById(inFlight._id).lean()).status).toBe("loyiha");
    });
  });
});

test("rad etilgan, qaytarishi uzilgan loyiha — yarashtirish jonli soat bilan yopadi", async () => {
  const { r, order: a } = await withOpenDraft(80);
  let release;
  const held = new Promise((x) => {
    release = x;
  });
  let calls = 0;
  const countHours = async () => {
    calls += 1;
    if (calls === 1) {
      await held;
      return 80;
    }
    return 76;
  };
  const opener = openDraft(args(r._id, countHours));
  await tick();
  await materialiseRejected(a._id, 76);
  const spy = jest.spyOn(Order, "deleteOne").mockRejectedValue(new Error("Mongo down"));
  release();
  await expect(opener).rejects.toThrow("Mongo down");
  spy.mockRestore();
  const stray = await Order.findOne({ resident: r._id, status: "loyiha" }).lean();
  expect(stray.hoursAtDraft).toBe(76);
  await reconcileDrafts(new Date(Date.now() + 11 * 60 * 1000));
  expect((await Order.findById(stray._id).lean()).closeReason).toBe("yaroqsiz_loyiha");
});
