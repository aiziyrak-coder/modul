"use strict";

const H = require("./helpers/samsIngest");
const request = require("supertest");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsSyncState = require("#modules/4.05-residency/samsIngest/samsSyncState.model");
const { enumerateDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { _idle } = require("#modules/4.05-residency/_services/samsPresenceSync");

const { KEY, app, today, D, WINDOW, PIN, tenant, rec, person, packet, gzipPost, ingest, roster, mkResident, rowsOf } = H;
const strip = (docs) => docs.map(({ updatedAt, receivedAt, ...d }) => d);

describe("darvoza", () => {
  afterEach(() => _idle());
  it("sarlavhasiz → 401; `X-Service-Key` (noto'g'ri nom) → 401; to'g'ri → 200", async () => {
    const none = await request(app).get("/api/residency-sams/roster");
    expect([none.status, none.body.reason]).toEqual([401, "sams_key_invalid"]);
    const wrongHeader = await request(app).get("/api/residency-sams/roster").set("X-Service-Key", KEY);
    expect(wrongHeader.status).toBe(401);
    const ok = await roster();
    expect(ok.status).toBe(200);
  });
});

describe("roster — kogorta, oyna, resendFrom", () => {
  afterEach(() => _idle());
  beforeEach(async () => {
    await mkResident(PIN.r2);
    const legacy = await mkResident(PIN.legacy);
    await Resident.collection.updateOne({ _id: legacy._id }, { $unset: { status: "" } });
    await mkResident(PIN.magis, { program: "magistratura" });
    await mkResident(PIN.tatil, { status: "akademik_tatil" });
    const deleted = await mkResident(PIN.deleted);
    await Resident.collection.updateOne({ _id: deleted._id }, { $set: { deletedAt: new Date() } });
    await mkResident(PIN.short);
    await mkResident(PIN.inactive, { active: false });
  });

  it("faqat o'qishdagi (va holatsiz eski) ordinatura, tartiblangan; oyna bugun-6..bugun; no-store", async () => {
    const res = await roster();
    expect(res.body.jshshirs).toEqual([PIN.r2, PIN.legacy]);
    expect(res.body).toMatchObject({ schemaVersion: 1, today, window: WINDOW, resendFrom: null, deliveredThrough: null });
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("qo'lda qo'yilgan resendFrom [bugun-30, bugun] ga kesilib beriladi", async () => {
    await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-45), resendRequestedAt: new Date() });
    expect((await roster()).body.resendFrom).toBe(D(-30));
    await SamsSyncState.collection.updateOne({ key: "default" }, { $set: { resendFrom: D(-4) } });
    expect((await roster()).body.resendFrom).toBe(D(-4));
  });
});

describe("gzip ingest — to'liq yo'l", () => {
  afterEach(() => _idle());
  let r1;
  let r2;
  let r3;
  beforeEach(async () => {
    [r1, r2, r3] = await Promise.all([mkResident(PIN.r1), mkResident(PIN.r2), mkResident(PIN.r3)]);
  });

  it("measured qoidalari, identifikatsiya va klinika kunlari", async () => {
    const res = await ingest(packet({
      tenants: [
        tenant("clinicA", D(-10), [
          person(PIN.r1, D(-20), [rec("a1", D(-1)), rec("a2", D(0))]),
          person(PIN.r2, D(-2)),
        ]),
        tenant("clinicB", D(-3), []),
      ],
      unresolved: [PIN.r3, PIN.x],
    }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      accepted: true, status: "ok", schemaVersion: 1, window: WINDOW, deliveredThrough: D(-1), resendCleared: false,
      presence: { rows: 21, stale: 0 }, orgDays: { rows: 14, stale: 0 },
      residents: { written: 3, unknown: 1, conflicts: 0 },
    });

    const a = await rowsOf(r1);
    expect(a).toHaveLength(7);
    expect(a.every((x) => x.measured && x.dbname === "clinicA")).toBe(true);
    expect(a.map((x) => x.recordCount)).toEqual([0, 0, 0, 0, 0, 1, 1]);
    expect(a[6].records[0]).toMatchObject({ attendId: "a2", accessTime: "08:00", deviceType: [{ device: 1, type: 1 }] });

    const b = await rowsOf(r2);
    expect(b.map((x) => x.unmeasuredReason)).toEqual([
      "before_registration", "before_registration", "before_registration", "before_registration", "before_registration", null, null,
    ]);

    const c = await rowsOf(r3);
    expect(c.every((x) => !x.measured && x.unmeasuredReason === "unresolved" && x.dbname === null)).toBe(true);

    const orgA = await SamsOrgDay.find({ dbname: "clinicA" }).lean();
    expect(orgA).toHaveLength(7);
    expect(orgA.every((x) => x.measured)).toBe(true);
    const orgB = await SamsOrgDay.find({ dbname: "clinicB" }).sort({ day: 1 }).lean();
    expect(orgB.map((x) => x.measured)).toEqual([false, false, false, false, true, true, true]);
    expect(orgB[0].unmeasuredReason).toBe("before_horizon");
  });

  it("unique indekslar qurilgan (eskirgan-yozuv himoyasi ularga tayanadi)", async () => {
    await ingest(packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] }));
    const names = async (M) => (await M.collection.indexes()).map((i) => [i.name, Boolean(i.unique)]);
    expect(await names(SamsPresence)).toContainEqual(["resident_day_unique", true]);
    expect(await names(SamsOrgDay)).toContainEqual(["dbname_day_unique", true]);
  });

  it("bir jshshir ikki tenantda → ambiguous qatorlar, conflicts 1, qolgan paket qabul qilinadi", async () => {
    const res = await ingest(packet({
      tenants: [
        tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("a1", D(0))]), person(PIN.r2, D(-20))]),
        tenant("clinicB", D(-10), [person(PIN.r1, D(-20))]),
      ],
    }));
    expect(res.body.residents).toEqual({ written: 2, unknown: 0, conflicts: 1 });
    const a = await rowsOf(r1);
    expect(a.every((x) => x.unmeasuredReason === "ambiguous" && x.recordCount === 0)).toBe(true);
    expect(a[0].ambiguousDbnames).toEqual(["clinicA", "clinicB"]);
    expect((await rowsOf(r2)).every((x) => x.measured)).toBe(true);
  });
});

describe("snapshot tartibi — replay, eskirgan paket, poyga", () => {
  afterEach(() => _idle());
  let r1;
  beforeEach(async () => {
    r1 = await mkResident(PIN.r1);
  });
  const T1 = new Date(Date.now() - 10 * 60_000);
  const T2 = new Date(Date.now() - 5 * 60_000);
  const older = () => packet({ emittedAt: T1, tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("old", D(0))])])] });
  const newer = () => packet({ emittedAt: T2, tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("new1", D(0)), rec("new2", D(-1))])])] });
  const todayRow = async () => SamsPresence.findOne({ resident: r1._id, day: D(0) }).lean();

  it("aynan o'sha paket ikki marta — bir xil hujjatlar (idempotent)", async () => {
    await ingest(newer());
    const first = strip(await SamsPresence.find().sort({ day: 1 }).lean());
    const again = await ingest(newer());
    expect(again.body.presence).toEqual({ rows: 7, stale: 0, superseded: 0 });
    const second = await SamsPresence.find().sort({ day: 1 }).lean();
    expect(strip(second)).toEqual(first);
    expect(second[0].receivedAt.getTime()).toBeGreaterThanOrEqual(first[0].createdAt.getTime());
    expect(await SamsOrgDay.countDocuments()).toBe(7);
  });

  it("eski paket yangisidan KEYIN keldi — hammasi stale, ma'lumot yangidan", async () => {
    await ingest(newer());
    const res = await ingest(older());
    expect(res.status).toBe(200);
    expect(res.body.presence).toEqual({ rows: 7, stale: 7, superseded: 0 });
    expect(res.body.orgDays).toEqual({ rows: 7, stale: 7 });
    const row = await todayRow();
    expect(row.records.map((x) => x.attendId)).toEqual(["new1"]);
    expect(row.packetAt.toISOString()).toBe(T2.toISOString());
  });

  it("poyga: eski paket bulkWrite'da ushlab turiladi, yangisi o'tadi — yangisi g'olib", async () => {
    const real = SamsPresence.bulkWrite.bind(SamsPresence);
    let release;
    const gate = new Promise((r) => { release = r; });
    let entered;
    const reached = new Promise((r) => { entered = r; });
    jest.spyOn(SamsPresence, "bulkWrite").mockImplementationOnce(async (...args) => {
      entered();
      await gate;
      return real(...args);
    });
    const heldP = ingest(older()).then((r) => r);
    await reached;
    const fresh = await ingest(newer());
    expect(fresh.body.presence.stale).toBe(0);
    release();
    const held = await heldP;
    expect(held.status).toBe(200);
    expect(held.body.presence.stale).toBeGreaterThan(0);
    expect((await todayRow()).records.map((x) => x.attendId)).toEqual(["new1"]);
    jest.restoreAllMocks();
  });
});

describe("yozish tartibi — klinika qatori OXIRIDA (FINAL belgisi)", () => {
  afterEach(() => _idle());
  beforeEach(() => mkResident(PIN.r1));

  it("klinika qatorini yozish yiqilsa: rezident qatorlari bor, klinika qatori yo'q (FINAL emas), javob 500", async () => {
    jest.spyOn(SamsOrgDay, "bulkWrite").mockRejectedValueOnce(new Error("disk to'ldi"));
    const res = await ingest(packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] }));
    expect(res.status).toBe(500);
    expect(await SamsPresence.countDocuments()).toBe(7);
    expect(await SamsOrgDay.countDocuments()).toBe(0);
    jest.restoreAllMocks();
    const healed = await ingest(packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] }));
    expect(healed.body.orgDays).toEqual({ rows: 7, stale: 0 });
  });
});

describe("bugun-only tik va resendFrom", () => {
  afterEach(() => _idle());
  let r1;
  beforeEach(async () => {
    r1 = await mkResident(PIN.r1);
  });

  it("tik faqat bugunni yozadi; eski qatorlar packetAt'ini saqlaydi; resend faqat qoplaganda tozalanadi", async () => {
    const T1 = new Date(Date.now() - 10 * 60_000);
    await ingest(packet({ emittedAt: T1, tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] }));
    const requestedAt = new Date(Date.now() - 2 * 60_000);
    await SamsSyncState.collection.insertOne({ key: "default", resendFrom: D(-3), resendRequestedAt: requestedAt });

    const tickWindow = { from: D(0), to: D(0) };
    const tick = await ingest(packet({
      window: tickWindow, tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("t1", D(0))])], tickWindow)],
    }));
    expect(tick.body).toMatchObject({ presence: { rows: 1, stale: 0 }, resendCleared: false });
    const rows = await rowsOf(r1);
    expect(rows.filter((x) => x.packetAt.getTime() === T1.getTime()).map((x) => x.day)).toEqual(enumerateDays(D(-6), D(-1)));
    expect(rows[6].recordCount).toBe(1);
    expect((await SamsSyncState.findOne({ key: "default" }).lean()).resendFrom).toBe(D(-3));

    const late = await ingest(packet({ emittedAt: T1, tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] }));
    expect(late.body.resendCleared).toBe(false);

    const nightly = await ingest(packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("t1", D(0))])])] }));
    expect(nightly.body.resendCleared).toBe(true);
    expect((await SamsSyncState.findOne({ key: "default" }).lean()).resendFrom).toBeNull();
    const again = await ingest(packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20), [rec("t1", D(0))])])] }));
    expect(again.body.resendCleared).toBe(false);
  });
});

describe("shartnoma xatolari — hech narsa yozilmaydi", () => {
  afterEach(() => _idle());
  beforeEach(() => mkResident(PIN.r1));
  const valid = () => packet({ tenants: [tenant("clinicA", D(-10), [person(PIN.r1, D(-20))])] });

  const futureWindow = () => {
    const w = { from: D(2), to: D(2) };
    return packet({ window: w, tenants: [tenant("clinicA", D(-10), [], w)] });
  };
  const missingDay = () => {
    const p = valid();
    p.tenants[0].days.pop();
    return p;
  };
  const shortPin = () => {
    const p = valid();
    p.tenants[0].people[0].jshshir = "3010199000001";
    return p;
  };

  it.each([
    ["schemaVersion 2", "unsupported_schema_version", () => ({ ...valid(), schemaVersion: 2 })],
    ["oyna kelajakda (bugun+2)", "window_in_future", futureWindow],
    ["tenantda bir kun yo'q", "tenant_days_mismatch", missingDay],
    ["jshshir 13 raqam", "contract", shortPin],
  ])("%s → 400 %s", async (_l, reason, build) => {
    const res = await ingest(build());
    expect([res.status, res.body.reason]).toEqual([400, reason]);
    expect(await SamsPresence.countDocuments()).toBe(0);
    expect(await SamsOrgDay.countDocuments()).toBe(0);
  });

  it("buzuq gzip → 400 (body-parser), servisga yetmaydi", async () => {
    const res = await gzipPost(Buffer.from("bu gzip emas"));
    expect(res.status).toBe(400);
    expect(await SamsPresence.countDocuments()).toBe(0);
  });
});
