"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const { Types } = mongoose;
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const {
  survey,
  snapshot,
  applyPlan,
  migrate,
  exitCodeFor,
  revert,
} = require("../../scripts/migrate-45-sams-verified");

const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "p11-migrate-"));
afterAll(() => fs.rmSync(backupDir, { recursive: true, force: true }));

const AT = new Date("2026-07-21T06:00:00Z");
const col = () => Attendance.collection;
const oid = () => new Types.ObjectId();

let day = 0;

const seed = async (fields) => {
  day += 1;
  const { insertedId } = await col().insertOne({
    date: new Date(AT.getTime() + day * 864e5),
    hours: 2,
    teacher: null,
    score: null,
    active: true,
    deletedAt: null,
    createdAt: AT,
    updatedAt: AT,
    ...fields,
  });
  return insertedId;
};
const load = async () =>
  Object.fromEntries(
    await Promise.all(Object.entries(ids).map(async ([k, id]) => [k, await col().findOne({ _id: id })])),
  );
const evidence = (d) => Boolean(d.samsVerified || d.manualVerified);

let ids;
let original;
beforeEach(async () => {
  const rO = (await Resident.collection.insertOne({ program: "ordinatura", fullName: "O" })).insertedId;
  const rM = (await Resident.collection.insertOne({ program: "magistratura", fullName: "M" })).insertedId;
  ids = {
    A: await seed({ resident: rO, status: "present", samsVerified: true, score: 8 }),
    B: await seed({
      resident: rO,
      status: "present",
      samsVerified: true,
      manualVerified: true,
      manualVerifiedBy: oid(),
      manualVerifiedAt: AT,
    }),
    C: await seed({ resident: rM, status: "present", samsVerified: true, manualVerified: false }),
    D: await seed({ resident: rO, status: "present", samsVerified: true, deletedAt: AT }),
    E: await seed({ resident: rO, status: "excused", samsVerified: true, manualVerified: false }),
    F: await seed({ resident: rO, status: "present", samsVerified: false, manualVerified: true }),
    G: await seed({ resident: rO, status: "absent", samsVerified: false, manualVerified: false }),
    H: await seed({ resident: rO, status: "present", samsVerified: true, session: oid() }),
    I: await seed({ resident: rO, status: "present", samsVerified: true, manualVerified: null }),
  };
  original = await load();
});

const MOVED = ["A", "B", "C", "D", "E", "I"];
const UNTOUCHED = ["F", "G", "H"];

describe("dry-run", () => {
  test("HECH NARSA yozmaydi va nishonni to'g'ri o'lchaydi", async () => {
    const r = await migrate({ backupDir });

    expect(await load()).toEqual(original);
    expect(r.backup).toBeNull();
    expect(r.before).toMatchObject({ samsTrue: 6, samsTrueDeleted: 1, samsTrueSession: 1, deleted: 1 });
    expect(r.before).toMatchObject({ samsTrueManualTrue: 1, samsTrueScored: 1, nonPresentWithEvidence: 1 });
    expect(r.breakdown.byStatus).toEqual({ present: 5, excused: 1 });
    expect(r.breakdown.byProgram).toEqual({ ordinatura: 5, magistratura: 1 });
    expect(r.planned).toEqual({ wasTrue: 1, wasFalse: 2, wasNull: 1, other: 2 });
  });
});

describe("--apply", () => {
  test("A–E ko'chadi, faqat ikki bayroq; F, G, H tegilmaydi; YOKI har qatorda saqlanadi", async () => {
    const r = await migrate({ apply: true, backupDir });
    const now = await load();

    for (const k of MOVED) {
      expect(now[k]).toEqual({ ...original[k], samsVerified: false, manualVerified: true });
    }
    for (const k of UNTOUCHED) expect(now[k]).toEqual(original[k]);
    for (const k of Object.keys(ids)) expect(evidence(now[k])).toBe(evidence(original[k]));

    expect(r.applied).toEqual({ planned: 6, modified: 6, modifiedWasTrue: 1, raced: 0 });
    expect(r.invariant).toEqual({ inTarget: 0, noEvidence: 0, ok: true });
    expect(r.after).toMatchObject({ samsTrue: 0, manualTrue: r.before.manualTrue + 5 });
    expect(exitCodeFor(r, true)).toBe(0);
    const backup = JSON.parse(fs.readFileSync(r.backup, "utf8"));
    expect(backup.db).toBe(mongoose.connection.db.databaseName);
    expect(backup.groups.wasNull).toEqual([String(ids.I)]);
  });

  test("idempotent: ikkinchi --apply hech narsa yozmaydi, zaxira ham yo'q", async () => {
    await migrate({ apply: true, backupDir });
    const again = await migrate({ apply: true, backupDir });
    expect(again.applied).toMatchObject({ planned: 0, modified: 0 });
    expect(again.backup).toBeNull();
    expect(again.invariantOk).toBe(true);
  });
});

describe("--revert", () => {
  test("asl holatga AYNAN qaytaradi (A da maydon yana yo'q, I da yana null)", async () => {
    const { backup } = await migrate({ apply: true, backupDir });
    const r = await revert({ file: backup });

    expect(r).toEqual({ planned: 6, restored: 6, skipped: 0 });
    expect(await load()).toEqual(original);
    expect("manualVerified" in (await col().findOne({ _id: ids.A }))).toBe(false);
    expect(await col().findOne({ _id: ids.I })).toHaveProperty("manualVerified", null);
  });

  test("ko'chirishdan keyin o'zgargan qatorga TEGMAYDI", async () => {
    const { backup } = await migrate({ apply: true, backupDir });
    await col().updateOne({ _id: ids.C }, { $set: { manualVerified: false } });

    const r = await revert({ file: backup });
    expect(r).toEqual({ planned: 6, restored: 5, skipped: 1 });
    expect(await col().findOne({ _id: ids.C })).toMatchObject({ samsVerified: false, manualVerified: false });
  });

  test("🔴 A→B→A: tasdiq olinib, inson QAYTA tasdiqlagan qatorga TEGMAYDI", async () => {
    const { backup } = await migrate({ apply: true, backupDir });
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    const human = oid();
    await Attendance.findByIdAndUpdate(ids.C, { status: "absent", manualVerified: false });
    await Attendance.findByIdAndUpdate(ids.C, {
      status: "present",
      manualVerified: true,
      manualVerifiedBy: human,
      manualVerifiedAt: new Date(),
    });

    expect(await revert({ file: backup })).toEqual({ planned: 6, restored: 5, skipped: 1 });
    const c = await col().findOne({ _id: ids.C });
    expect(c).toMatchObject({ samsVerified: false, manualVerified: true, manualVerifiedBy: human });
  });

  test("boshqa bazaning zaxirasi RAD etiladi", async () => {
    const { backup } = await migrate({ apply: true, backupDir });
    const foreign = path.join(backupDir, "foreign.json");
    fs.writeFileSync(foreign, JSON.stringify({ ...JSON.parse(fs.readFileSync(backup, "utf8")), db: "boshqa" }));
    await expect(revert({ file: foreign })).rejects.toThrow(/--allow-other-db/);
    expect(await col().countDocuments({ samsVerified: true, session: null })).toBe(0);
  });
});

const injectRace = (race) => {
  const db = mongoose.connection.db;
  const real = db.collection.bind(db);
  let fired = false;
  return jest.spyOn(db, "collection").mockImplementation((name, ...rest) => {
    const c = real(name, ...rest);
    if (name !== "attendances") return c;
    return new Proxy(c, {
      get(target, prop) {
        if (prop === "updateMany" && !fired) {
          return async (...args) => {
            fired = true;
            await race();
            return target.updateMany(...args);
          };
        }
        const v = target[prop];
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
  });
};

describe("poyga — snapshot va yozuv orasida", () => {
  test("🔴 --apply ichidagi poyga: qayta --apply + ikkala zaxira bilan revert inson tasdig'ini BUZMAYDI", async () => {
    const spy = injectRace(() => col().updateOne({ _id: ids.C }, { $set: { manualVerified: true } }));
    const r1 = await migrate({ apply: true, backupDir });
    spy.mockRestore();

    expect(r1.applied).toMatchObject({ planned: 6, modified: 5, raced: 1, pruned: 1 });
    expect(r1.invariant).toEqual({ inTarget: 1, noEvidence: 0, ok: true });
    expect(exitCodeFor(r1, true)).toBe(1);
    const b1 = JSON.parse(fs.readFileSync(r1.backup, "utf8"));
    expect(b1.raced).toEqual([String(ids.C)]);
    expect(b1.groups.wasFalse).not.toContain(String(ids.C));

    const r2 = await migrate({ apply: true, backupDir });
    expect(r2.applied).toMatchObject({ planned: 1, modified: 1, raced: 0 });

    expect(await revert({ file: r1.backup })).toEqual({ planned: 5, restored: 5, skipped: 0 });
    expect(await revert({ file: r2.backup })).toEqual({ planned: 1, restored: 1, skipped: 0 });
    expect(await col().findOne({ _id: ids.C })).toMatchObject({ samsVerified: true, manualVerified: true });
  });

  test("o'zgargan qator ko'chmaydi va `raced` da sanaladi", async () => {
    const before = await survey();
    const plan = await snapshot();
    await col().updateOne({ _id: ids.C }, { $set: { manualVerified: true } });

    const r = await applyPlan(plan);
    expect(r).toMatchObject({ planned: 6, modified: 5, raced: 1 });
    expect(await col().findOne({ _id: ids.C })).toMatchObject({ samsVerified: true, manualVerified: true });
    expect((await survey()).samsTrue).toBe(before.samsTrue - 5);
  });

  test("🔴 parallel jonli trafik (rejadan tashqari) invariantni yolg'ondan BUZMAYDI", async () => {
    const rM = (await Resident.collection.insertOne({ program: "magistratura", fullName: "M2" })).insertedId;
    const legacy = await seed({ resident: rM, status: "present", samsVerified: false, manualVerified: false });
    const spy = injectRace(async () => {
      await seed({ resident: rM, status: "present", samsVerified: false, manualVerified: true });
      await col().updateOne({ _id: legacy }, { $set: { status: "absent" } });
    });
    const r = await migrate({ apply: true, backupDir });
    spy.mockRestore();

    expect(r.applied).toMatchObject({ planned: 6, modified: 6, raced: 0 });
    expect(r.after.manualTrue).toBe(r.before.manualTrue + 5 + 1);
    expect(r.after.presentNoEvidence).toBe(r.before.presentNoEvidence - 1);
    expect(r.invariantOk).toBe(true);
    expect(exitCodeFor(r, true)).toBe(0);
  });
});
