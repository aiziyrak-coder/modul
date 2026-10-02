"use strict";

const H = require("./helpers/samsIngest");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsPacket = require("#modules/4.05-residency/samsIngest/samsPacket.model");
const { markStaleDays } = require("#modules/4.05-residency/samsIngest/samsFreshness");
const { upsertNewer } = require("#modules/4.05-residency/samsIngest/samsBulk");
const { ingestPacket } = require("#modules/4.05-residency/samsIngest/samsIngest.service");
const M = require("./helpers/samsMonitor");
const { _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");

const { NOW, TODAY, D, ago, finalAt, partialAt, orgDay, presence, mkResident, gate } = M;
const at = (minutes) => ({ packetAt: ago(minutes), receivedAt: ago(minutes - 0.1) });
const state = async (Model, filter) => (await Model.findOne(filter).lean());
const measuredOf = async (Model, filter) => (await Model.find(filter).lean()).map((d) => [d.measured, d.unmeasuredReason]);

beforeAll(() => Promise.all([SamsOrgDay.init(), SamsPresence.init(), SamsPacket.init()]));
afterEach(() => jest.restoreAllMocks());

describe("I6 — tanlash", () => {
  afterEach(() => _idle());
  it("bugun 2 tik jim: klinika va rezident qatorlari stale; yangi, yakuniy va aniqroq sabablar tegilmaydi", async () => {
    const [r1, r2, r3] = await Promise.all([mkResident(), mkResident(), mkResident()]);
    await orgDay("A", TODAY, at(31));
    await presence(r1, "A", TODAY, at(31));
    await presence(r2, "A", TODAY, at(31), { measured: false, unmeasuredReason: "no_schedule" });
    await orgDay("B", TODAY, at(10));
    await presence(r3, "B", TODAY, at(10));
    await orgDay("A", D(-2), { packetAt: finalAt(D(-2)), receivedAt: finalAt(D(-2)) });
    await presence(r1, "A", D(-2), { packetAt: finalAt(D(-2)), receivedAt: finalAt(D(-2)) });

    await expect(markStaleDays(NOW)).resolves.toEqual({ orgDays: 1, presence: 1, todayOrgDays: 1, lost: 0 });
    expect(await measuredOf(SamsOrgDay, { dbname: "A", day: TODAY })).toEqual([[false, "stale"]]);
    expect(await measuredOf(SamsPresence, { dbname: "A", day: TODAY, resident: r1._id })).toEqual([[false, "stale"]]);
    expect(await measuredOf(SamsPresence, { resident: r2._id })).toEqual([[false, "no_schedule"]]);
    expect(await measuredOf(SamsOrgDay, { dbname: "B" })).toEqual([[true, null]]);
    expect(await measuredOf(SamsPresence, { day: D(-2) })).toEqual([[true, null]]);
    const org = await state(SamsOrgDay, { dbname: "A", day: TODAY });
    expect(org.packetAt).toEqual(ago(31));
  });

  it("o'tgan kun yakuniy bo'lmasa — faqat ertasi 06:00 UZ dan keyin", async () => {
    const r = await mkResident();
    const stamp = { packetAt: partialAt(D(-1)), receivedAt: partialAt(D(-1)) };
    await orgDay("A", D(-1), stamp);
    await presence(r, "A", D(-1), stamp);
    await markStaleDays(new Date("2026-09-27T00:59:59Z"));
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[true, null]]);
    await markStaleDays(new Date("2026-09-27T01:00:00Z"));
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[false, "stale"]]);
    expect(await measuredOf(SamsPresence, {})).toEqual([[false, "stale"]]);
  });
});

async function newerPacket(resident) {
  const stamp = { packetAt: ago(1), receivedAt: ago(0.5) };
  await upsertNewer(SamsPresence, [{ resident: resident._id, day: TODAY, dbname: "A", measured: true, unmeasuredReason: null, records: [], recordCount: 0, ...stamp }], ["resident", "day"]);
  await upsertNewer(SamsOrgDay, [{ dbname: "A", day: TODAY, orgTitle: "Klinika A", measured: true, unmeasuredReason: null, horizon: "2026-01-01", ...stamp }], ["dbname", "day"]);
}

describe("I6 — poygalar va yaqinlashish", () => {
  afterEach(() => _idle());
  let r;
  beforeEach(async () => {
    r = await mkResident();
    await orgDay("A", TODAY, at(40));
    await presence(r, "A", TODAY, at(40));
  });

  it("A: rezident updateMany ushlab turilganda yangi paket keldi — yangi qatorlar o'lchangan qoladi, CAS 0", async () => {
    const g = gate(SamsPresence, "updateMany");
    const run = markStaleDays(NOW);
    await g.reached;
    await newerPacket(r);
    g.release();
    await expect(run).resolves.toMatchObject({ orgDays: 0, presence: 0, lost: 1 });
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[true, null]]);
    expect(await measuredOf(SamsPresence, {})).toEqual([[true, null]]);
  });

  it("B: klinika CAS ushlab turilganda yangi paket keldi — CAS yutqazadi, paket tiklagan qatorlar qoladi", async () => {
    const g = gate(SamsOrgDay, "updateOne");
    const run = markStaleDays(NOW);
    await g.reached;
    expect(await measuredOf(SamsPresence, {})).toEqual([[false, "stale"]]);
    await newerPacket(r);
    g.release();
    await expect(run).resolves.toMatchObject({ orgDays: 0, lost: 1 });
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[true, null]]);
    expect(await measuredOf(SamsPresence, {})).toEqual([[true, null]]);
  });

  it("uzilish: klinika yozuvi bir marta yiqildi — keyingi ishga tushish yaqinlashadi", async () => {
    jest.spyOn(SamsOrgDay, "updateOne").mockRejectedValueOnce(new Error("socket closed"));
    await expect(markStaleDays(NOW)).rejects.toThrow("socket closed");
    expect(await measuredOf(SamsPresence, {})).toEqual([[false, "stale"]]);
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[true, null]]);
    await expect(markStaleDays(NOW)).resolves.toEqual({ orgDays: 1, presence: 0, todayOrgDays: 1, lost: 0 });
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[false, "stale"]]);
  });

  it("tiklash: keyingi qabul qilingan paket `stale` ni o'zi tozalaydi", async () => {
    await markStaleDays(NOW);
    await newerPacket(r);
    expect(await measuredOf(SamsOrgDay, {})).toEqual([[true, null]]);
    expect(await measuredOf(SamsPresence, {})).toEqual([[true, null]]);
    await expect(markStaleDays(NOW)).resolves.toMatchObject({ orgDays: 0 });
  });
});

const tickPacket = (day, emittedAt, horizonDay, sinceDay) =>
  H.packet({ window: { from: day, to: day }, emittedAt, trigger: "tick",
    tenants: [H.tenant("clinicA", horizonDay, [H.person(H.PIN.r1, sinceDay)], { from: day, to: day })] });

describe("C3 — haqiqiy ingest bilan uchdan-uchga", () => {
  afterEach(() => _idle());
  const NOON = new Date(`${TODAY}T12:00:00+05:00`);
  const after = (minutes) => new Date(NOON.getTime() + minutes * 60_000);
  const tick = (emittedAt, now) => ingestPacket(tickPacket(TODAY, emittedAt, D(-10), D(-20)), now);

  it("tik → +31 daqiqa watchdog stale → keyingi paket tiklaydi; paket jurnali", async () => {
    const r1 = await H.mkResident(H.PIN.r1);
    const first = await tick(after(-1), NOON);
    expect(first.deliveredThrough).toBe(D(-1));
    await markStaleDays(after(31));
    expect(await measuredOf(SamsOrgDay, { dbname: "clinicA" })).toEqual([[false, "stale"]]);
    expect(await measuredOf(SamsPresence, { resident: r1._id })).toEqual([[false, "stale"]]);
    await tick(after(32), after(33));
    expect(await measuredOf(SamsOrgDay, { dbname: "clinicA" })).toEqual([[true, null]]);
    expect(await measuredOf(SamsPresence, { resident: r1._id })).toEqual([[true, null]]);
    const log = await SamsPacket.find().sort({ receivedAt: 1 }).lean();
    expect(log.map((p) => [p.trigger, p.tenantCount, p.peopleCount, p.serverUtcOffsetMinutes, p.receivedAt]))
      .toEqual([["tick", 1, 1, 300, NOON], ["tick", 1, 1, 300, after(33)]]);
  });

  it("HTTP: ack'da deliveredThrough, paket jurnaliga yoziladi", async () => {
    await H.mkResident(H.PIN.r1);
    const res = await H.ingest(tickPacket(H.today, new Date(Date.now() - 60_000), H.D(-10), H.D(-20)));
    expect(res.status).toBe(200);
    expect(res.body.deliveredThrough).toBe(H.D(-1));
    const log = await SamsPacket.find().lean();
    expect(log.map((p) => [p.trigger, p.tenantCount, p.peopleCount, p.serverUtcOffsetMinutes])).toEqual([["tick", 1, 1, 300]]);
  });
});
