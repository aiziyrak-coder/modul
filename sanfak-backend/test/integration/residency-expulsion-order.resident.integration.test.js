"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const { openDraft } = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const { changeStudyStatus } = require("#modules/4.05-residency/_services/expulsionOrderGuards");
const {
  signOrder,
  attachScan,
} = require("#modules/4.05-residency/_services/expulsionOrderDecision");
require("#modules/4.01-auth/user/user.model");
const ResidentController = require("#modules/4.05-residency/resident/resident.controller");

const gate = (hours) => {
  let open;
  const opened = new Promise((r) => {
    open = r;
  });
  return { countHours: () => opened.then(() => hours), open };
};
const tick = () => new Promise((r) => setTimeout(r, 30));
const raw = (id) => Resident.collection.findOne({ _id: id });
const newResident = (extra = {}) =>
  Resident.create({ program: "ordinatura", fullName: "Test Rezident", courseNumber: 1, ...extra });
const open72 = (residentId, countHours = async () => 72) =>
  openDraft({ residentId, residentName: "T", source: "cron", countHours });
const leave = (residentId) => changeStudyStatus({ residentId, to: "akademik_tatil" });

function holdOrderCheck() {
  let release;
  const held = new Promise((r) => {
    release = r;
  });
  const real = Order.findOne.bind(Order);
  jest.spyOn(Order, "findOne").mockImplementationOnce((...a) => ({
    select: (...s) => ({
      lean: async () => {
        const doc = await real(...a).select(...s).lean();
        await held;
        return doc;
      },
    }),
  }));
  return release;
}

beforeAll(() => Order.init());
afterEach(() => jest.restoreAllMocks());

describe("G7 — ta'til ↔ loyiha ochish (U-4=A, I9)", () => {
  test("ochiq loyiha bor — ta'til 409 `expulsion_order_open` + `orderId`", async () => {
    const r = await newResident();
    const { orderId } = await open72(r._id);
    await expect(leave(r._id)).rejects.toMatchObject({
      statusCode: 409,
      meta: { reason: "expulsion_order_open", orderId: String(orderId) },
    });
    expect((await raw(r._id)).status).toBe("oquvda");
  });

  test("buyruq tekshiruvidan keyin loyiha ochildi — ta'til CAS'i O'TMAYDI", async () => {
    const r = await newResident();
    const release = holdOrderCheck();
    const patch = leave(r._id);
    await tick();
    expect((await open72(r._id)).opened).toBe(true);
    release();
    await expect(patch).rejects.toMatchObject({ statusCode: 409, meta: { reason: "expulsion_order_open" } });
    expect((await raw(r._id)).status).toBe("oquvda");
  });

  test("ta'til ochuvchidan OLDIN yozildi — ochuvchi o'z hujjatini qaytaradi", async () => {
    const r = await newResident();
    const g = gate(72);
    const opener = open72(r._id, g.countHours);
    await tick();
    await leave(r._id);
    g.open();
    expect(await opener).toEqual({ opened: false, reason: "not_eligible" });
    expect(await Order.countDocuments({ resident: r._id, status: "loyiha" })).toBe(0);
    expect(await raw(r._id)).toMatchObject({ status: "akademik_tatil", expulsionOrderCreated: false });
  });

  test("imzolangan buyruq (yarim imzo) — ta'tilga ham 409", async () => {
    const r = await newResident();
    const { orderId } = await open72(r._id);
    await Order.updateOne({ _id: orderId }, { $set: { status: "imzolangan" } });
    await expect(leave(r._id)).rejects.toMatchObject({ meta: { reason: "expulsion_order_open" } });
  });

  test("`status` maydoni YO'Q eski rezident ham ta'tilga chiqadi (XOM CAS)", async () => {
    const { insertedId } = await Resident.collection.insertOne({
      program: "ordinatura",
      fullName: "Eski",
      active: true,
      deletedAt: null,
    });
    expect((await leave(insertedId)).changed).toBe(true);
    expect((await raw(insertedId)).status).toBe("akademik_tatil");
  });

  test("ikki parallel o'zgarish — bittasi `status_conflict`", async () => {
    const r = await newResident({ status: "akademik_tatil" });
    const results = await Promise.allSettled([
      changeStudyStatus({ residentId: r._id, to: "oquvda" }),
      changeStudyStatus({ residentId: r._id, to: "oquvda" }),
    ]);
    const rejected = results.filter((x) => x.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.meta.reason).toBe("status_conflict");
  });
});

describe("G11 — o'chirish ↔ imzo (V-3=A)", () => {
  const SHA = "c".repeat(64);
  const OFFICE = { _id: null, lastName: "Karimova", firstName: "Nodira", role: { title: "magistratura_bolim" } };
  const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
  const scanned = async (extra) => {
    const r = await newResident(extra);
    const { orderId } = await open72(r._id);
    await attachScan({
      orderId,
      scan: { storageKey: "k.pdf", fileName: "b.pdf", mimeType: "application/pdf", size: 5, sha256: SHA },
      actor: OFFICE,
    });
    return { r, orderId };
  };
  const sign = (orderId, countHours = async () => 76) =>
    signOrder({
      orderId,
      input: { paperOrderNumber: "7", paperOrderDate: today(), scanSha256: SHA },
      actor: OFFICE,
      countHours,
    });
  const del = async (id) => {
    const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
    const next = jest.fn();
    await ResidentController.deleteResident({ params: { id: String(id) }, body: {}, user: OFFICE }, res, next);
    return { res, err: next.mock.calls[0]?.[0] };
  };

  test("o'chirish S1 dan OLDIN yutdi — imzo 409, rezident chetlatilmaydi", async () => {
    const { r, orderId } = await scanned();
    const g = gate(76);
    const signer = sign(orderId, g.countHours);
    await tick();
    expect((await del(r._id)).res.status).toHaveBeenCalledWith(200);
    g.open();
    await expect(signer).rejects.toMatchObject({ statusCode: 409 });
    expect((await raw(r._id)).status).not.toBe("chetlatilgan");
    expect((await Order.findById(orderId).lean()).closeReason).toBe("rezident_ochirildi");
  });

  test("S1 o'chirishdan OLDIN yutdi — o'chirish 409, imzo yakunlanadi", async () => {
    const { r, orderId } = await scanned();
    let release;
    const held = new Promise((x) => {
      release = x;
    });
    const real = Order.findOneAndUpdate.bind(Order);
    jest.spyOn(Order, "findOneAndUpdate").mockImplementationOnce((...a) => ({
      lean: async () => {
        const doc = await real(...a).lean();
        await held;
        return doc;
      },
    }));
    const signer = sign(orderId);
    await tick();
    const { err } = await del(r._id);
    expect(err).toMatchObject({ statusCode: 409, meta: { reason: "expulsion_order_signed" } });
    expect((await raw(r._id)).deletedAt).toBeNull();
    release();
    expect((await signer).flipped).toBe(true);
  });

  test("chetlatilgan rezident — 409 `resident_expelled`", async () => {
    const r = await newResident({ status: "chetlatilgan" });
    expect((await del(r._id)).err).toMatchObject({ statusCode: 409, meta: { reason: "resident_expelled" } });
  });

  test("yaroqsiz eski hujjat — 400, loyiha OCHIQ qoladi", async () => {
    const r = await newResident();
    const { orderId } = await open72(r._id);
    await Resident.collection.updateOne({ _id: r._id }, { $set: { studyPeriod: 25 } });
    expect((await del(r._id)).err).toMatchObject({ statusCode: 400 });
    expect((await Order.findById(orderId).lean()).status).toBe("loyiha");
  });
});
