"use strict";

const H = require("./helpers/samsIngest");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsSyncState = require("#modules/4.05-residency/samsIngest/samsSyncState.model");
const { nextDayStartMs, isFinalPacket, isFinalRow } = require("#modules/4.05-residency/samsIngest/samsContract");
const { _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");

const { D, WINDOW, PIN, tenant, person, packet, ingest, mkResident, rowsOf } = H;

describe("indekslar — ularsiz ingest hech narsa yozmaydi (fail-closed)", () => {
  afterEach(() => _idle());
  it("createIndexes rad etilsa → 500, 0 qator; keyingi paket qayta quradi va yozadi", async () => {
    await mkResident(PIN.r1);
    const spy = jest.spyOn(SamsPresence, "createIndexes").mockRejectedValueOnce(new Error("indeks qurilmadi"));
    const body = packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] });
    const res = await ingest(body);
    expect([spy.mock.calls.length, res.status]).toEqual([1, 500]);
    expect(await SamsPresence.countDocuments()).toBe(0);
    expect(await SamsOrgDay.countDocuments()).toBe(0);

    const retry = await ingest(body);
    expect([spy.mock.calls.length, retry.status, retry.body.presence?.rows]).toEqual([2, 200, 7]);
    spy.mockRestore();
  });
});

describe("rezidentlar — roster kogortasi va paketdagi ambiguous", () => {
  afterEach(() => _idle());
  it("magistratura, akademik_tatil va nofaol rezident paketda bo'lsa ham `unknown`, qator yo'q (O2)", async () => {
    const r1 = await mkResident(PIN.r1);
    const outside = await Promise.all([
      mkResident(PIN.magis, { program: "magistratura" }),
      mkResident(PIN.tatil, { status: "akademik_tatil" }),
      mkResident(PIN.inactive, { active: false }),
    ]);
    const people = [PIN.r1, PIN.magis, PIN.tatil, PIN.inactive].map((p) => person(p, D(-20)));
    const res = await ingest(packet({ tenants: [tenant("clinicA", D(-10), people)] }));
    expect(res.body.residents).toEqual({ written: 1, unknown: 3, conflicts: 0 });
    expect(await SamsPresence.countDocuments({ resident: { $in: outside.map((o) => o._id) } })).toBe(0);
    expect(await rowsOf(r1)).toHaveLength(7);
  });

  it("SAMS `ambiguous` ro'yxatidagi rezident → har kun `ambiguous` qator, yozuvsiz, conflicts 0", async () => {
    const r3 = await mkResident(PIN.r3);
    const res = await ingest(packet({
      tenants: [tenant("clinicA", D(-10), [])],
      ambiguous: [{ jshshir: PIN.r3, dbnames: ["clinicA"], userCount: 2 }],
    }));
    expect(res.body.residents).toEqual({ written: 1, unknown: 0, conflicts: 0 });
    const rows = await rowsOf(r3);
    expect(rows).toHaveLength(7);
    expect(rows.every((x) => !x.measured && x.unmeasuredReason === "ambiguous" && x.dbname === null)).toBe(true);
    expect(rows.every((x) => x.recordCount === 0 && x.records.length === 0)).toBe(true);
    expect(rows[0].ambiguousDbnames).toEqual(["clinicA"]);
  });
});

describe("FINAL — yakuniy paket qayta yozmagan qisman qator (D-MODE 1-qoida)", () => {
  afterEach(() => _idle());
  const d = D(-1);
  const W = { from: d, to: d };
  const TICK = new Date(nextDayStartMs(d) - 10 * 3_600_000);
  const NIGHT = new Date(nextDayStartMs(d));
  const at = (ms) => new Date(NIGHT.getTime() + ms);
  const clinic = (dbname, ...pins) => tenant(dbname, D(-10), pins.map((p) => person(p, D(-20))), W);
  let r;
  beforeEach(async () => {
    const [r1, r2, r3] = await Promise.all([mkResident(PIN.r1), mkResident(PIN.r2), mkResident(PIN.r3)]);
    r = { r1, r2, r3 };
  });
  const rowOn = (resident) => SamsPresence.findOne({ resident: resident._id, day: d }).lean();

  it("R2 javob bermagan klinikaga o'tdi: qatori `stale`, FINAL emas; keyingi yetkazish tiklaydi", async () => {
    await ingest(packet({ window: W, emittedAt: TICK, trigger: "tick", tenants: [clinic("clinicA", PIN.r1, PIN.r2, PIN.r3)] }));
    const night = await ingest(packet({
      window: W, emittedAt: NIGHT, tenants: [clinic("clinicA", PIN.r1, PIN.r3)],
      failedTenants: [{ dbname: "clinicB", orgTitle: "Klinika clinicB" }],
    }));
    expect(night.body.presence).toEqual({ rows: 2, stale: 0, superseded: 1 });
    const org = await SamsOrgDay.findOne({ dbname: "clinicA", day: d }).lean();
    expect(isFinalPacket(org.packetAt, d)).toBe(true);

    const moved = await rowOn(r.r2);
    expect(moved).toMatchObject({ dbname: "clinicA", measured: false, unmeasuredReason: "stale", recordCount: 0 });
    expect(moved.packetAt.toISOString()).toBe(TICK.toISOString());
    expect(isFinalRow(moved, org)).toBe(false);
    expect(isFinalRow(await rowOn(r.r1), org)).toBe(true);

    const healed = await ingest(packet({ window: W, emittedAt: at(60_000), tenants: [clinic("clinicB", PIN.r2)] }));
    expect(healed.body.presence.superseded).toBe(0);
    expect(await rowOn(r.r2)).toMatchObject({ dbname: "clinicB", measured: true, unmeasuredReason: null });
  });

  it("allaqachon YAKUNIY qator tegilmaydi (kogortadan chiqqan rezident — to'liq kun dalili)", async () => {
    await ingest(packet({ window: W, emittedAt: NIGHT, tenants: [clinic("clinicA", PIN.r1, PIN.r3)] }));
    await Resident.collection.updateOne({ _id: r.r3._id }, { $set: { status: "akademik_tatil" } });
    const later = await ingest(packet({ window: W, emittedAt: at(60_000), tenants: [clinic("clinicA", PIN.r1, PIN.r3)] }));
    expect(later.body).toMatchObject({ presence: { rows: 1, superseded: 0 }, residents: { unknown: 1 } });
    const kept = await rowOn(r.r3);
    expect(kept).toMatchObject({ dbname: "clinicA", measured: true, unmeasuredReason: null });
    expect(kept.packetAt.toISOString()).toBe(NIGHT.toISOString());
  });

  it("kogortadan chiqqan rezidentning QISMAN qatori `stale` ga tushadi", async () => {
    await ingest(packet({ window: W, emittedAt: TICK, trigger: "tick", tenants: [clinic("clinicA", PIN.r1, PIN.r3)] }));
    await Resident.collection.updateOne({ _id: r.r3._id }, { $set: { active: false } });
    const night = await ingest(packet({ window: W, emittedAt: NIGHT, tenants: [clinic("clinicA", PIN.r1, PIN.r3)] }));
    expect(night.body).toMatchObject({ presence: { rows: 1, superseded: 1 }, residents: { unknown: 1 } });
    expect(await rowOn(r.r3)).toMatchObject({ measured: false, unmeasuredReason: "stale" });
  });
});

describe("resendFrom — faqat so'ralgan kunlarni yetkazgan paket tozalaydi", () => {
  afterEach(() => _idle());
  beforeEach(async () => {
    await mkResident(PIN.r1);
    const resendRequestedAt = new Date(Date.now() - 5 * 60_000);
    await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-3), resendRequestedAt });
  });
  const stored = async () => (await SamsSyncState.findOne({ key: "default" }).lean()).resendFrom;
  const clinicA = (w = WINDOW) => tenant("clinicA", D(-10), [person(PIN.r1, D(-20))], w);
  const failedTenants = [{ dbname: "clinicB", orgTitle: "Klinika clinicB" }];

  it("failedTenants li bo'lak, eski oyna va manual paket so'rovni saqlaydi; to'liq bo'lak tozalaydi", async () => {
    const failed = await ingest(packet({ trigger: "resend", tenants: [clinicA()], failedTenants }));
    expect([failed.status, failed.body.resendCleared]).toEqual([200, false]);
    expect(await stored()).toBe(D(-3));

    const oldW = { from: D(-20), to: D(-14) };
    expect((await ingest(packet({ window: oldW, trigger: "manual", tenants: [clinicA(oldW)] }))).body.resendCleared).toBe(false);
    expect((await ingest(packet({ window: oldW, trigger: "resend", tenants: [clinicA(oldW)] }))).body.resendCleared).toBe(false);
    expect((await ingest(packet({ trigger: "manual", tenants: [clinicA()] }))).body.resendCleared).toBe(false);
    expect(await stored()).toBe(D(-3));

    const full = await ingest(packet({ trigger: "resend", tenants: [clinicA()] }));
    expect(full.body.resendCleared).toBe(true);
    expect(await stored()).toBeNull();
  });
});
