"use strict";

const H = require("./helpers/samsIngest");
const SamsSyncState = require("#modules/4.05-residency/samsIngest/samsSyncState.model");
const SamsPacket = require("#modules/4.05-residency/samsIngest/samsPacket.model");
const { ingestPacket, getRoster } = require("#modules/4.05-residency/samsIngest/samsIngest.service");
const { deliverySnapshot } = require("#modules/4.05-residency/samsIngest/samsDelivery");
const { digestContent } = require("#modules/4.05-residency/samsIngest/samsDigest");
const { monitorConfig } = require("#modules/4.05-residency/samsIngest/samsMonitorConfig");
const { TODAY, D } = require("./helpers/samsMonitor");
const { _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");

const { PIN } = H;
const at = (hhmm, day = TODAY) => new Date(`${day}T${hhmm}:00+05:00`);
const people = { A: [H.person(PIN.r1, D(-40))], B: [H.person(PIN.r2, D(-40))] };
const block = (dbname, window) => H.tenant(dbname, D(-40), people[dbname], window);
const failed = (dbname) => ({ dbname, orgTitle: `Klinika ${dbname}` });

function send(window, time, { dbnames = ["A", "B"], tenants, failedTenants = [], trigger = "resend", emittedAt, clock } = {}) {
  const body = H.packet({
    window, emittedAt: emittedAt ?? new Date(time.getTime() - 5000), trigger, failedTenants,
    tenants: tenants ?? dbnames.map((d) => block(d, window)),
  });
  return ingestPacket(body, time, clock);
}

const storedRequest = async () => SamsSyncState.findOne({ key: "default" }).lean();
const TICK = { from: TODAY, to: TODAY };

function holdFirst(method) {
  const orig = SamsSyncState[method].bind(SamsSyncState);
  let release;
  let reached;
  const gate = new Promise((r) => { release = r; });
  const entered = new Promise((r) => { reached = r; });
  let held = false;
  jest.spyOn(SamsSyncState, method).mockImplementation((...args) => {
    if (held) return orig(...args);
    held = true;
    const run = async (exec) => {
      reached();
      await gate;
      return exec();
    };
    return method === "findOne" ? { lean: () => run(() => orig(...args).lean()) } : run(() => orig(...args));
  });
  return { entered, release: () => release() };
}

beforeAll(() => Promise.all([SamsSyncState.init(), SamsPacket.init()]));

beforeEach(async () => {
  await Promise.all([H.mkResident(PIN.r1), H.mkResident(PIN.r2)]);
  await send({ from: D(-13), to: D(-7) }, at("01:30"), { trigger: "reconcile" });
  await send({ from: D(-6), to: D(-1) }, at("01:30"), { trigger: "reconcile" });
  await send({ from: TODAY, to: TODAY }, at("09:00"), { trigger: "tick" });
});

describe("qo'lda resendFrom — allaqachon yakuniy kunlar (ma'lumot tuzatildi)", () => {
  afterEach(() => _idle());
  const NEW = { from: D(-6), to: TODAY };
  const OLD = { from: D(-10), to: D(-7) };

  it("yangi bo'lak B o'qilmadi, eski bo'lak toza → so'rov qoladi; keyingi toza o'tish tozalaydi", async () => {
    await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
    expect((await getRoster(at("09:40"))).resendFrom).toBe(D(-10));

    const first = [
      await send(NEW, at("09:45"), { dbnames: ["A"], failedTenants: [failed("B")] }),
      await send(OLD, at("09:46")),
    ];
    expect(first.map((a) => a.resendCleared)).toEqual([false, false]);
    expect((await getRoster(at("10:00"))).resendFrom).toBe(D(-10));

    const second = [await send(NEW, at("10:00")), await send(OLD, at("10:01"))];
    expect(second.map((a) => a.resendCleared)).toEqual([true, false]);
    expect((await storedRequest()).resendClearedAt).toEqual(at("10:00"));
    expect((await getRoster(at("10:15"))).resendFrom).toBeNull();
  });

  it("so'rovdan OLDINGI toza paketlar birlashmaga kirmaydi", async () => {
    await send(NEW, at("09:20"));
    await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
    expect((await send(OLD, at("09:45"))).resendCleared).toBe(false);
    expect((await getRoster(at("10:00"))).resendFrom).toBe(D(-10));
  });

  it("so'rovdan OLDIN chiqarilgan paket soat farqi oralig'ida (−5 daqiqa) qabul qilingan bo'lsa ham kirmaydi", async () => {
    await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
    await send(NEW, at("09:27"));
    expect((await send(OLD, at("09:45"))).resendCleared).toBe(false);
    expect((await getRoster(at("10:00"))).resendFrom).toBe(D(-10));
  });

  it("SAMS soati oldinda: so'rovdan OLDIN qabul qilingan paket (KEYIN chiqarilgan ko'rinsa ham) kirmaydi", async () => {
    await send(NEW, at("09:28"), { emittedAt: at("09:31") });
    await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
    const pass = [
      await send(NEW, at("09:45"), { dbnames: ["A"], failedTenants: [failed("B")], emittedAt: at("09:48") }),
      await send(OLD, at("09:46"), { emittedAt: at("09:49") }),
    ];
    expect(pass.map((a) => a.resendCleared)).toEqual([false, false]);
    expect((await getRoster(at("10:00"))).resendFrom).toBe(D(-10));
    expect((await send(NEW, at("10:00"), { emittedAt: at("10:03") })).resendCleared).toBe(true);
  });

  it("so'rov ingest davomida yozilgan (qabul 09:29 < so'rov 09:30), SAMS soati oldinda → shu paket ham kirmaydi", async () => {
    await SamsSyncState.create({ key: "default", resendFrom: D(-3), resendRequestedAt: at("09:30") });
    expect((await send(NEW, at("09:29"), { emittedAt: at("09:32") })).resendCleared).toBe(false);
    expect((await send(NEW, at("09:45"))).resendCleared).toBe(true);
  });

  it("qo'lda (`manual`) paket birlashmaga kirmaydi — keyingi toza paket tozalaydi", async () => {
    await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
    expect((await send(NEW, at("09:40"), { trigger: "manual" })).resendCleared).toBe(false);
    expect((await send(OLD, at("09:45"))).resendCleared).toBe(false);
    expect((await send(NEW, at("10:00"))).resendCleared).toBe(true);
  });

  it("vaqtsiz so'rov: birinchi paket vaqtni qo'yadi va qoplamaydi, keyingi o'tish tozalaydi", async () => {
    await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-3) });
    expect((await send(NEW, at("09:45"))).resendCleared).toBe(false);
    expect((await storedRequest()).resendRequestedAt).toEqual(at("09:45"));
    expect((await send(NEW, at("10:00"))).resendCleared).toBe(true);
  });

  const requestUntimed = (day) => SamsSyncState.collection.updateOne({ key: "default" }, { $set: { resendFrom: day } });

  describe("tozalash so'rov vaqtini ham o'chiradi", () => {
    const clearTimed = async () => {
      await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
      expect((await send(NEW, at("09:45"))).resendCleared).toBe(false);
      expect((await send(OLD, at("09:46"))).resendCleared).toBe(true);
      expect(await storedRequest()).toMatchObject({ resendFrom: null, resendRequestedAt: null, resendClearedAt: at("09:46") });
    };

    it("keyingi vaqtsiz so'rovga vaqtni yangi paket qo'yadi — eski jurnal oynalari uni tozalamaydi", async () => {
      await clearTimed();
      await requestUntimed(D(-3));
      expect((await send({ from: TODAY, to: TODAY }, at("11:15"), { trigger: "tick" })).resendCleared).toBe(false);
      expect((await storedRequest()).resendRequestedAt).toEqual(at("11:15"));
      expect((await send(NEW, at("11:30"))).resendCleared).toBe(true);
    });

    it("xuddi shu kun qayta so'raldi, eng yangi bo'lak o'qilmadi → so'rov qoladi (Q27)", async () => {
      await clearTimed();
      await requestUntimed(D(-10));
      const pass = [
        await send(NEW, at("11:15"), { dbnames: ["A"], failedTenants: [failed("B")] }),
        await send(OLD, at("11:16")),
      ];
      expect(pass.map((a) => a.resendCleared)).toEqual([false, false]);
      expect((await getRoster(at("11:30"))).resendFrom).toBe(D(-10));
    });

    it("tozalashdan OLDIN holatni o'qigan parallel ingest xuddi shu kun bilan qayta qo'yilgan so'rovni o'chirmaydi (ABA)", async () => {
      await SamsSyncState.create({ key: "default", resendFrom: D(-10), resendRequestedAt: at("09:30") });
      const stale = await storedRequest();
      await SamsSyncState.deleteOne({ key: "default" });
      await clearTimed();
      await requestUntimed(D(-10));
      const findOne = jest.spyOn(SamsSyncState, "findOne").mockReturnValueOnce({ lean: async () => stale });
      try {
        expect((await send(OLD, at("09:47"))).resendCleared).toBe(false);
      } finally {
        findOne.mockRestore();
      }
      expect(await storedRequest()).toMatchObject({ resendFrom: D(-10), resendRequestedAt: null });
    });
  });

  describe("vaqtsiz so'rovga vaqt qo'yish — ushlangan ingest bilan poyga", () => {
    afterEach(() => jest.restoreAllMocks());
    const plus = (time, ms) => new Date(time.getTime() + ms);

    it("tozalashdan OLDIN holatni o'qigan ingest xuddi shu kun bilan qayta qo'yilgan vaqtsiz so'rovga eski vaqt qo'ymaydi", async () => {
      await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-10) });
      const hold = holdFirst("updateOne");
      const a = send(TICK, at("09:40"), { trigger: "tick" }).then((r) => r);
      await hold.entered;
      expect((await send(TICK, at("09:41"), { trigger: "tick" })).resendCleared).toBe(false);
      expect((await send(NEW, at("09:45"))).resendCleared).toBe(false);
      expect((await send(OLD, at("09:46"))).resendCleared).toBe(true);
      await requestUntimed(D(-10));
      hold.release();
      expect((await a).resendCleared).toBe(false);
      expect(await storedRequest()).toMatchObject({ resendFrom: D(-10), resendRequestedAt: null });
      expect((await send(TICK, at("11:15"), { trigger: "tick" })).resendCleared).toBe(false);
      expect((await storedRequest()).resendRequestedAt).toEqual(at("11:15"));
      expect([await send(NEW, at("11:30")), await send(OLD, at("11:31"))].map((r) => r.resendCleared)).toEqual([false, true]);
    });

    it("so'rov ingest davomida yozildi — vaqt so'rov KO'RILGAN paytdan oldin tushmaydi", async () => {
      let wall = at("09:45");
      const hold = holdFirst("findOne");
      const p1 = send(NEW, at("09:45"), { clock: () => wall }).then((r) => r);
      await hold.entered;
      expect((await send(NEW, plus(at("09:45"), 500), { emittedAt: plus(at("09:45"), 200) })).resendCleared).toBe(false);
      await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-6) });
      wall = plus(at("09:45"), 2000);
      hold.release();
      expect((await p1).resendCleared).toBe(false);
      expect((await storedRequest()).resendRequestedAt).toEqual(wall);
      expect((await send(TICK, at("10:00"), { trigger: "tick" })).resendCleared).toBe(false);
      expect((await send(NEW, at("10:15"))).resendCleared).toBe(true);
    });
  });

  it("vaqtsiz so'rov, SAMS soati oldinda: vaqt qo'ygan paket jurnaldan ham birlashmaga kirmaydi", async () => {
    await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-10) });
    expect((await send(NEW, at("09:45"), { emittedAt: at("09:47") })).resendCleared).toBe(false);
    expect((await storedRequest()).resendRequestedAt).toEqual(new Date(at("09:47").getTime() + 1));
    expect((await send(OLD, at("09:50"), { emittedAt: at("09:52") })).resendCleared).toBe(false);
    expect((await send(NEW, at("10:00"), { emittedAt: at("10:02") })).resendCleared).toBe(true);
  });
});

describe("klinika oxirgi roster rezidentini yo'qotdi", () => {
  afterEach(() => _idle());
  const bothInA = (window) => H.tenant("A", D(-40), [H.person(PIN.r1, D(-40)), H.person(PIN.r2, D(-40))], window);

  it("B ning qisman kuni teshik, lekin watermark, resendFrom va yig'ma teshiklari uni ushlamaydi; F4 da qoladi", async () => {
    await send({ from: TODAY, to: TODAY }, at("09:15"), { tenants: [bothInA({ from: TODAY, to: TODAY })], trigger: "tick" });
    const night = { from: D(-5), to: D(1) };
    await send(night, at("01:30", D(1)), { tenants: [bothInA(night)], trigger: "reconcile" });

    const morning = at("06:30", D(1));
    const snap = await deliverySnapshot(morning);
    const b = snap.clinics.find((c) => c.dbname === "B");
    expect(b).toMatchObject({ live: false, gaps: [{ day: TODAY, delivery: "stale" }] });
    expect(snap.clinics.find((c) => c.dbname === "A")).toMatchObject({ live: true, deliveredThrough: TODAY });
    expect(snap.watermark).toEqual({ deliveredThrough: TODAY, resendFrom: null, gapDays: 0, oldestGap: null });
    expect(await getRoster(morning)).toMatchObject({ resendFrom: null, deliveredThrough: TODAY });
    const digest = await digestContent({ now: at("10:07", D(1)), cfg: monitorConfig(), prevKeys: new Set() });
    expect(digest.gapKeys).toEqual([]);
  });

  it("o'qilmagan klinika (failedTenants) jonli qoladi — teshigi so'raladi", async () => {
    const night = { from: D(-5), to: D(1) };
    await send(night, at("01:30", D(1)), { dbnames: ["A"], failedTenants: [failed("B")], trigger: "reconcile" });
    const snap = await deliverySnapshot(at("06:30", D(1)));
    expect(snap.clinics.find((c) => c.dbname === "B").live).toBe(true);
    expect(snap.watermark).toMatchObject({ deliveredThrough: D(-1), resendFrom: TODAY });
  });
});
