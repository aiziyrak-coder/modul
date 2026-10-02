"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  openDraft,
  cancelDraftBelowThreshold,
  reconcileDrafts,
} = require("#modules/4.05-residency/_services/expulsionOrderLifecycle");
const {
  signOrder,
  rejectOrder,
  attachScan,
} = require("#modules/4.05-residency/_services/expulsionOrderDecision");

const SHA = "a".repeat(64);
const SHA_B = "b".repeat(64);
const ACTOR = { _id: null, lastName: "Karimova", firstName: "Nodira" };

const gate = (hours) => {
  let open;
  const opened = new Promise((r) => {
    open = r;
  });
  return { countHours: () => opened.then(() => hours), open };
};
const tick = () => new Promise((r) => setTimeout(r, 30));
const hoursOf = (h) => async () => h;
const raw = (id) => Resident.collection.findOne({ _id: id });
const today = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const input = (sha = SHA) => ({ paperOrderNumber: "12-ch", paperOrderDate: today(), scanSha256: sha });
const scanMeta = (sha) => ({ storageKey: `k/${sha.slice(0, 4)}.pdf`, fileName: "b.pdf", mimeType: "application/pdf", size: 5, sha256: sha });

const sign = (orderId, countHours = hoursOf(76), sha = SHA) =>
  signOrder({ orderId, input: input(sha), actor: ACTOR, countHours });

async function scannedDraft(extra = {}) {
  const r = await Resident.create({ program: "ordinatura", fullName: "Test Rezident", courseNumber: 1, ...extra });
  const res = await openDraft({ residentId: r._id, residentName: "Test", source: "cron", countHours: hoursOf(76) });
  await attachScan({ orderId: res.orderId, scan: scanMeta(SHA), actor: ACTOR });
  return { r, orderId: res.orderId, order: await Order.findById(res.orderId).lean() };
}

function holdAfterS1() {
  let release;
  const held = new Promise((r) => {
    release = r;
  });
  const real = Order.findOneAndUpdate.bind(Order);
  jest.spyOn(Order, "findOneAndUpdate").mockImplementationOnce((...a) => ({
    lean: async () => {
      const doc = await real(...a).lean();
      await held;
      return doc;
    },
  }));
  return release;
}

beforeAll(() => Order.init());
afterEach(() => jest.restoreAllMocks());

describe("G1 — imzo ↔ tizim bekor qilishi (ariza tasdig'i)", () => {
  test("S1 dan keyin kelgan bekor qilish bayroqqa TEGMAYDI; S2 yakunlaydi", async () => {
    const { r, orderId, order } = await scannedDraft();
    const release = holdAfterS1();
    const signer = sign(orderId);
    await tick();
    const snapshot = { _id: r._id, expulsionOrderCreated: true, expulsionOrderCreatedAt: order.draftedAt };
    await cancelDraftBelowThreshold(snapshot, { hours: 20, source: "application", awaitRevoke: true });
    expect((await raw(r._id)).expulsionOrderCreated).toBe(true);
    release();
    expect((await signer).flipped).toBe(true);
    const live = await raw(r._id);
    expect(live).toMatchObject({ status: "chetlatilgan", expulsionOrderCreated: false });
    expect((await Order.findById(orderId).lean()).status).toBe("imzolangan");
  });

  test("bekor qilish S1 dan OLDIN yutdi — imzo 409, rezident o'qishda qoladi", async () => {
    const { r, orderId, order } = await scannedDraft();
    const g = gate(76);
    const signer = sign(orderId, g.countHours);
    await tick();
    const snapshot = { _id: r._id, expulsionOrderCreated: true, expulsionOrderCreatedAt: order.draftedAt };
    await cancelDraftBelowThreshold(snapshot, { hours: 20, source: "application", awaitRevoke: true });
    g.open();
    await expect(signer).rejects.toMatchObject({ statusCode: 409, meta: { reason: "order_not_open" } });
    expect(await raw(r._id)).toMatchObject({ status: "oquvda", expulsionOrderCreated: false });
  });
});

describe("G2/G3 — bir hujjat, ikki qaror", () => {
  test("imzo ↔ rad etish: rad etish yutdi — imzo 409, yon ta'sir yo'q", async () => {
    const { r, orderId } = await scannedDraft();
    const g = gate(76);
    const signer = sign(orderId, g.countHours);
    await tick();
    await rejectOrder({ orderId, reason: "Sababli", actor: ACTOR, countHours: hoursOf(76) });
    g.open();
    await expect(signer).rejects.toMatchObject({ statusCode: 409 });
    expect((await raw(r._id)).status).toBe("oquvda");
    expect((await Order.findById(orderId).lean()).status).toBe("rad_etilgan");
  });

  test("ikki imzo (ikki marta bosish): bitta `imzolandi`, bitta `flipped`", async () => {
    const { orderId } = await scannedDraft();
    const g1 = gate(76);
    const g2 = gate(76);
    const a = sign(orderId, g1.countHours);
    const b = sign(orderId, g2.countHours);
    await tick();
    g1.open();
    g2.open();
    const results = await Promise.allSettled([a, b]);
    expect(results.filter((x) => x.status === "fulfilled" && x.value.flipped)).toHaveLength(1);
    const doc = await Order.findById(orderId).lean();
    expect(doc.history.filter((h) => h.action === "imzolandi")).toHaveLength(1);
  });

  test("G3b — yarim imzodan ikki parallel yakunlash: bitta `flipped`", async () => {
    const { orderId } = await scannedDraft();
    const release = holdAfterS1();
    const first = sign(orderId);
    await tick();
    const [x, y] = await Promise.all([sign(orderId), sign(orderId)]);
    release();
    const all = [x, y, await first];
    expect(all.filter((res) => res.flipped)).toHaveLength(1);
  });
});

describe("G5 — YARIM imzo (S1 bor, S2 yo'q) xavfsiz tomonda qoladi", () => {
  test("ochish, bekor qilish, yarashtirish — bayroq turadi; aynan o'sha so'rov yakunlaydi", async () => {
    const { r, orderId, order } = await scannedDraft();
    await Order.updateOne(
      { _id: orderId },
      { $set: { status: "imzolangan", paperOrderNumber: "12-ch", paperOrderDate: today(), signedAt: new Date(Date.now() - 3600e3) } },
    );
    expect((await openDraft({ residentId: r._id, residentName: "T", source: "cron", countHours: hoursOf(90) })).reason).toBe("signed_order");
    const snapshot = { _id: r._id, expulsionOrderCreated: true, expulsionOrderCreatedAt: order.draftedAt };
    await cancelDraftBelowThreshold(snapshot, { hours: 60, source: "cron", awaitRevoke: true });
    await reconcileDrafts();
    expect(await raw(r._id)).toMatchObject({ status: "oquvda", expulsionOrderCreated: true });
    expect(await Order.countDocuments({ resident: r._id })).toBe(1);

    await expect(
      signOrder({ orderId, input: { ...input(), paperOrderNumber: "99" }, actor: ACTOR, countHours: hoursOf(76) }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await sign(orderId)).flipped).toBe(true);
    expect(await raw(r._id)).toMatchObject({ status: "chetlatilgan", expulsionOrderCreated: false });
    expect((await Order.findById(orderId).lean()).residentAppliedAt).toBeInstanceOf(Date);
  });
});

describe("G8 va imzo paytidagi tekshiruvlar", () => {
  test("imzo ushlangan paytda skan almashtirildi — 409 `scan_changed`", async () => {
    const { r, orderId } = await scannedDraft();
    const g = gate(76);
    const signer = sign(orderId, g.countHours);
    await tick();
    await attachScan({ orderId, scan: scanMeta(SHA_B), actor: ACTOR });
    g.open();
    await expect(signer).rejects.toMatchObject({ statusCode: 409, meta: { reason: "scan_changed" } });
    expect((await raw(r._id)).status).toBe("oquvda");
  });

  test("`tizim` imzo paytida 72 dan past — loyiha tizim yo'li bilan bekor, bayroq tozalanadi", async () => {
    const { r, orderId } = await scannedDraft();
    await expect(sign(orderId, hoursOf(60))).rejects.toMatchObject({ meta: { reason: "hours_below_threshold" } });
    const doc = await Order.findById(orderId).lean();
    expect(doc).toMatchObject({ status: "bekor_qilingan", closeReason: "soat_72_dan_past", hoursAtClose: 60 });
    expect(doc.history.at(-1).source).toBe("office");
    expect((await raw(r._id)).expulsionOrderCreated).toBe(false);
  });

  test("V-1=B: ta'tildagi rezidentning `meros` loyihasi imzolanadi", async () => {
    const r = await Resident.create({ program: "ordinatura", fullName: "T", courseNumber: 1, status: "akademik_tatil" });
    const o = await Order.create({ resident: r._id, origin: "meros", status: "loyiha", countingYear: "2025/2026", draftedAt: new Date("2026-03-01") });
    await attachScan({ orderId: o._id, scan: scanMeta(SHA), actor: ACTOR });
    expect((await sign(o._id, hoursOf(10))).flipped).toBe(true);
    expect((await raw(r._id)).status).toBe("chetlatilgan");
  });
});
