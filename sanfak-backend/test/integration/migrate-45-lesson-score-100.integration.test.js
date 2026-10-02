"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const { RUNS, SENTINEL_ID, migrate, revert, exitCodeFor } = require("../../scripts/migrate-45-lesson-score-100");

const { Types } = mongoose;
const { Collection } = mongoose.mongo;
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "lsc-migrate-"));
afterAll(() => fs.rmSync(backupDir, { recursive: true, force: true }));
beforeAll(() => Promise.all([Attendance.init(), Roster.init()]));

const HOUR = 3600e3;
const NOW = Date.now();
const CUT = new Date(NOW - HOUR);
const BEFORE = new Date(NOW - 2 * HOUR);
const AFTER = new Date(NOW - HOUR / 2);
const AT = new Date("2026-09-20T06:00:00Z");
const oid = () => new Types.ObjectId();
const runs = () => mongoose.connection.db.collection(RUNS);
const rows = () => Attendance.collection;
const frames = () => Roster.collection;
const ATT = () => Attendance.collection.collectionName;
const ROS = () => Roster.collection.collectionName;

const seedFrame = async (fields) =>
  (await frames().insertOne({
    session: oid(), resident: oid(), day: "2026-09-20", science: oid(), lessonType: "maruza", hours: 2,
    outcome: "present", cancelledAt: null, scoredBy: oid(), createdAt: AT, updatedAt: AT, ...fields,
  })).insertedId;
const seedRow = async (fields) =>
  (await rows().insertOne({
    resident: oid(), date: AT, status: "present", hours: 2, session: null, scoreRev: null,
    active: true, deletedAt: null, createdAt: AT, updatedAt: AT, ...fields,
  })).insertedId;

let ids;
let original;
const load = async () => {
  const out = {};
  for (const [k, id] of Object.entries(ids)) {
    out[k] = await (k.startsWith("F") ? frames() : rows()).findOne({ _id: id });
  }
  return out;
};
const scores = (state) => Object.fromEntries(Object.entries(state).map(([k, d]) => [k, d.score]));

beforeEach(async () => {
  await runs().deleteMany({});
  const session = oid();
  const F1 = await seedFrame({ session, score: 9, scoredAt: BEFORE });
  ids = {
    F1,
    F2: await seedFrame({ outcome: "absent", cancelledAt: BEFORE, score: 6, scoredAt: BEFORE }),
    F3: await seedFrame({ outcome: "absent", score: 7, scoredAt: null }),
    F4: await seedFrame({ score: 8, scoredAt: AFTER }),
    F5: await seedFrame({ score: 85, scoredAt: AFTER }),
    A1: await seedRow({ session, score: 9, scoreRev: BEFORE.getTime() }),
    A2: await seedRow({ score: 7.25, status: "absent", deletedAt: AT, active: false }),
    A3: await seedRow({ score: 0 }),
    A4: await seedRow({ session: oid(), score: 8, scoreRev: AFTER.getTime() }),
    A5: await seedRow({ score: null }),
    A6: await seedRow({ score: 10 }),
  };
  await frames().updateOne({ _id: F1 }, { $set: { attendance: ids.A1 } });
  original = await load();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await runs().deleteMany({});
});

const CONVERTED = { F1: 90, F2: 60, F3: 70, A1: 90, A2: 72.5, A6: 100 };
const UNTOUCHED = ["F4", "F5", "A3", "A4", "A5"];
let tick = 0;
const apply = (extra = {}) => {
  tick += 1;
  return migrate({ apply: true, cutoff: CUT, backupDir, now: new Date(NOW + tick * 1000), ...extra });
};

function interceptBulk(onColl, before) {
  const order = [];
  const real = Collection.prototype.bulkWrite;
  let fired = false;
  jest.spyOn(Collection.prototype, "bulkWrite").mockImplementation(async function (...args) {
    order.push(this.collectionName);
    if (!fired && this.collectionName === onColl()) {
      fired = true;
      await before();
    }
    return real.apply(this, args);
  });
  return order;
}

describe("dry-run va --apply", () => {
  test("dry-run HECH NARSA yozmaydi (sentinel kolleksiyasi ham yaratilmaydi), reja va ro'yxatlar to'g'ri", async () => {
    const r = await migrate({ cutoff: CUT, backupDir });
    expect(await load()).toEqual(original);
    expect(await runs().countDocuments()).toBe(0);
    expect(r.backup).toBeNull();
    expect(r.entries.map((e) => e.coll)).toEqual(["rosters", "rosters", "rosters", "attendances", "attendances", "attendances"]);
    expect(r.stats.rosters).toMatchObject({ legacy: 3, excluded: 2, excludedLowList: [`rosters:${ids.F4}:8`], split: { cancelled: 1, notPresent: 2 } });
    expect(r.stats.attendances).toMatchObject({ legacy: 3, zero: 1, anomaly: 0, excludedLowList: [`attendances:${ids.A4}:8`], split: { deleted: 1 } });
    expect(exitCodeFor(r)).toBe(0);
  });

  test("--apply: ikkala kolleksiya ×10, qolgan maydonlar va updatedAt bir xil; kesimdan keyingisi tegilmaydi", async () => {
    const r = await apply();
    const now = await load();
    for (const [k, next] of Object.entries(CONVERTED)) expect(now[k]).toEqual({ ...original[k], score: next });
    for (const k of UNTOUCHED) expect(now[k]).toEqual(original[k]);
    expect(r.applied).toMatchObject({ planned: 6, modified: 6, atTarget: 0, gone: 0, other: [], stillLow: 0 });
    expect(exitCodeFor(r)).toBe(0);
    const sentinel = await runs().findOne({ _id: SENTINEL_ID });
    expect(sentinel).toMatchObject({ state: "done", db: r.db, backup: r.backup, counts: { modified: 6, raced: 0 } });
    const backup = JSON.parse(fs.readFileSync(r.backup, "utf8"));
    expect(backup).toMatchObject({ db: r.db, runId: sentinel.runId, cutoff: CUT.toISOString() });
    expect(backup.entries).toContainEqual({ coll: "attendances", _id: String(ids.A2), old: 7.25, next: 72.5 });
  });

  test("post-check dry-run: kesim sentineldan; qamrovdagi ≤ 10 = yangi qiymati ≤ 10 bo'lganlar (0.5 → 5)", async () => {
    ids.A8 = await seedRow({ score: 0.5 });
    const applied = await apply();
    expect(applied.applied.stillLow).toBe(1);
    expect((await load()).A8.score).toBe(5);
    const r = await migrate({ backupDir });
    expect(r.cutoffFromSentinel).toBe(true);
    expect(r.cutoff.toISOString()).toBe(CUT.toISOString());
    expect(r.stats.rosters.legacy + r.stats.attendances.legacy).toBe(1);
    expect(r.sentinel.counts.stillLow).toBe(1);
    expect(r.entries).toHaveLength(1);
  });

  test("ikkinchi --apply rad (exit 2) — ma'lumot va zaxiralar o'zgarmaydi", async () => {
    await apply({ anomalies: "keep" });
    const after = await load();
    const files = fs.readdirSync(backupDir).length;
    const r = await apply({ anomalies: "keep", now: new Date(NOW + 1) });
    expect(r.refused).toMatchObject({ code: "already_applied", exit: 2 });
    expect(exitCodeFor(r)).toBe(2);
    expect((await apply({ now: new Date(NOW + 1) })).refused).toMatchObject({ code: "already_applied", exit: 2 });
    expect(await load()).toEqual(after);
    expect(fs.readdirSync(backupDir)).toHaveLength(files);
  });

  test("sentinel poygasi: parallel --apply sentinelni oldin olgan — E11000, zaxira olib tashlanadi, hech narsa yozilmaydi", async () => {
    const real = Collection.prototype.insertOne;
    jest.spyOn(Collection.prototype, "insertOne").mockImplementation(async function (...args) {
      if (this.collectionName === RUNS) await real.call(this, { _id: SENTINEL_ID, state: "started", runId: "boshqa" });
      return real.apply(this, args);
    });
    const files = fs.readdirSync(backupDir);
    const r = await apply({ now: new Date(NOW + 2) });
    expect(r.refused).toMatchObject({ code: "already_applied", exit: 2 });
    expect(r.backup).toBeNull();
    expect(fs.readdirSync(backupDir)).toEqual(files);
    expect(await load()).toEqual(original);
  });
});

describe("poyga va anomaliya", () => {
  test("reja va yozuv orasida tahrirlangan qator — raced (exit 1), tegilmaydi; qolganlari ko'chadi", async () => {
    interceptBulk(ATT, () => rows().updateOne({ _id: ids.A6 }, { $set: { score: 5 } }));
    const r = await apply({ now: new Date(NOW + 3) });
    expect(r.applied.other).toEqual([`attendances:${ids.A6}:5`]);
    expect(exitCodeFor(r)).toBe(1);
    expect(scores(await load())).toMatchObject({ A6: 5, A1: 90, A2: 72.5, F1: 90 });
    expect(await runs().findOne({ _id: SENTINEL_ID })).toMatchObject({ state: "done", raced: [`attendances:${ids.A6}:5`] });
  });

  test("reja va yozuv orasida yangi kod XUDDI SHU qiymat bilan qayta baholadi (kesimdan keyin) — CAS yetmaydi, raced (LSC-Q7)", async () => {
    interceptBulk(ROS, async () => {
      await frames().updateOne({ _id: ids.F1 }, { $set: { score: 9, scoredAt: new Date() } });
      await rows().updateOne({ _id: ids.A1 }, { $set: { score: 9, scoreRev: Date.now() } });
    });
    const r = await apply({ now: new Date(NOW + 12) });
    expect(r.applied.other).toEqual([`rosters:${ids.F1}:9`, `attendances:${ids.A1}:9`]);
    expect(r.applied).toMatchObject({ planned: 6, modified: 4, atTarget: 0 });
    expect(exitCodeFor(r)).toBe(1);
    expect(scores(await load())).toMatchObject({ F1: 9, A1: 9, F2: 60, F3: 70, A2: 72.5, A6: 100 });
  });

  test("proyeksiya nusxasi (freymdan allaqachon ko'chirilgan 90) — converged, exit 0", async () => {
    interceptBulk(ATT, () => rows().updateOne({ _id: ids.A1 }, { $set: { score: 90 } }));
    const r = await apply({ now: new Date(NOW + 4) });
    expect(r.applied).toMatchObject({ modified: 5, atTarget: 1, other: [] });
    expect(exitCodeFor(r)).toBe(0);
    expect((await load()).A1.score).toBe(90);
  });

  test("anomaliya: bayroqsiz rad (exit 1, hech narsa yozilmaydi); --anomalies=keep — joyida qoladi", async () => {
    ids.A7 = await seedRow({ score: 12 });
    ids.F6 = await seedFrame({ score: -1, scoredAt: null });
    original = await load();
    const refused = await apply({ now: new Date(NOW + 5) });
    expect(refused.refused).toMatchObject({ code: "anomalies", exit: 1 });
    expect(refused.stats.attendances.anomalies).toEqual([`attendances:${ids.A7}:12`]);
    expect(await load()).toEqual(original);
    expect(await runs().countDocuments()).toBe(0);

    const kept = await apply({ anomalies: "keep", now: new Date(NOW + 6) });
    expect(exitCodeFor(kept)).toBe(0);
    expect(scores(await load())).toMatchObject({ A7: 12, F6: -1, A6: 100, F1: 90 });
  });
});

describe("--revert", () => {
  test("uzilgan --apply (sentinel started, freymlar ko'chgan) → --revert hammasini qaytaradi → yangi --apply; tartib freymlar → qatorlar", async () => {
    const order = interceptBulk(ATT, async () => {
      throw new Error("simulyatsiya: protsess uzildi");
    });
    await expect(apply({ now: new Date(NOW + 7) })).rejects.toThrow("uzildi");
    expect(order).toEqual([ROS(), ATT()]);
    const crashed = await runs().findOne({ _id: SENTINEL_ID });
    expect(crashed.state).toBe("started");
    expect(scores(await load())).toMatchObject({ F1: 90, F2: 60, A1: 9, A6: 10 });
    jest.restoreAllMocks();

    const revertOrder = interceptBulk(ATT, async () => {});
    const r = await revert({ file: crashed.backup });
    expect(revertOrder).toEqual([ROS(), ATT()]);
    expect(r).toMatchObject({ sentinel: "deleted", reverted: { modified: 3, atTarget: 3, other: [] } });
    expect(exitCodeFor(r)).toBe(0);
    expect(await load()).toEqual(original);
    expect(await runs().countDocuments()).toBe(0);

    jest.restoreAllMocks();
    const fresh = await apply({ now: new Date(NOW + 8) });
    expect(exitCodeFor(fresh)).toBe(0);
    expect(scores(await load())).toMatchObject(CONVERTED);
  });

  test("--apply dan keyin qayta baholangan freym tegilmaydi (exit 1, reverted-partial), qolganlari qaytadi", async () => {
    const { backup } = await apply({ now: new Date(NOW + 9) });
    await frames().updateOne({ _id: ids.F1 }, { $set: { score: 85, scoredAt: new Date() } });
    const r = await revert({ file: backup });
    expect(r.reverted.other).toEqual([`rosters:${ids.F1}:85`]);
    expect(r.sentinel).toBe("reverted-partial");
    expect(exitCodeFor(r)).toBe(1);
    expect(scores(await load())).toMatchObject({ F1: 85, F2: 6, F3: 7, A1: 9, A2: 7.25, A6: 10 });
    expect(await runs().findOne({ _id: SENTINEL_ID })).toMatchObject({ state: "reverted-partial" });
    expect((await apply({ now: new Date(NOW + 10) })).refused.code).toBe("already_applied");
  });

  test("boshqa baza yoki boshqa yugurish zaxirasi — rad (exit 2), hech narsa yozilmaydi", async () => {
    const { backup } = await apply({ now: new Date(NOW + 11) });
    const after = await load();
    const body = JSON.parse(fs.readFileSync(backup, "utf8"));
    const otherDb = path.join(backupDir, "other-db.json");
    fs.writeFileSync(otherDb, JSON.stringify({ ...body, db: "boshqa-baza" }));
    const otherRun = path.join(backupDir, "other-run.json");
    fs.writeFileSync(otherRun, JSON.stringify({ ...body, runId: "2026-01-01T00-00-00-000Z" }));

    const r1 = await revert({ file: otherDb });
    expect(r1.refused).toMatchObject({ code: "other_db", exit: 2 });
    expect(exitCodeFor(r1)).toBe(2);
    expect((await revert({ file: otherRun })).refused).toMatchObject({ code: "other_run", exit: 2 });
    expect(await load()).toEqual(after);

    expect(exitCodeFor(await revert({ file: otherDb, allowOtherDb: true }))).toBe(0);
    expect(await load()).toEqual(original);
  });
});
