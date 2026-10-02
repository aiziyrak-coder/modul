"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Order = require("#modules/4.05-residency/residencyExpulsionOrder/residencyExpulsionOrder.model");
const {
  preconditions,
  classify,
  migrate,
  revert,
} = require("../../scripts/migrate-45-expulsion-orders");

const FLAG_AT = new Date("2026-04-02T08:00:00Z");
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "p6a-migrate-"));

const seed = async (fields) => {
  const { insertedId } = await Resident.collection.insertOne({
    program: "ordinatura",
    status: "oquvda",
    active: true,
    deletedAt: null,
    expulsionOrderCreated: true,
    expulsionOrderCreatedAt: FLAG_AT,
    totalUnexcusedHours: 80,
    ...fields,
  });
  return insertedId;
};

let ids;
beforeEach(async () => {
  await Order.init();
  ids = {
    machine: await seed({ fullName: "Mashina", active: false }),
    leave: await seed({ fullName: "Tatil", status: "akademik_tatil" }),
    runtime: await seed({ fullName: "Jonli" }),
    deleted: await seed({ fullName: "Ochirilgan", deletedAt: new Date() }),
    violation: await seed({ fullName: "Buzilish", status: "chetlatilgan" }),
    hasOrder: await seed({ fullName: "Hujjatli" }),
    clean: await seed({ fullName: "Toza", expulsionOrderCreated: false }),
  };
  await Order.create({
    resident: ids.hasOrder,
    origin: "tizim",
    status: "loyiha",
    countingYear: "2026/2027",
    draftedAt: new Date(),
  });
});

afterAll(() => fs.rmSync(backupDir, { recursive: true, force: true }));

const sizes = (classes) =>
  Object.fromEntries(Object.entries(classes).map(([k, v]) => [k, v.length]));

describe("tasnif va dry-run", () => {
  test("har bayroqli rezident AYNAN bitta sinfga tushadi", async () => {
    expect(sizes(await classify())).toEqual({
      deleted: 1,
      violation: 1,
      hasOrder: 1,
      machine: 1,
      leave: 1,
      runtime: 1,
    });
  });

  test("dry-run HECH NARSA yozmaydi", async () => {
    const res = await migrate({ backupDir });
    expect(res.created).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
    expect((await Resident.collection.findOne({ _id: ids.machine })).active).toBe(false);
  });
});

describe("old shartlar — `--apply` yozishdan OLDIN to'xtaydi", () => {
  test("`status` siz rezident bor — xato, hech narsa yozilmaydi", async () => {
    await Resident.collection.updateOne({ _id: ids.runtime }, { $unset: { status: "" } });
    expect((await preconditions()).missingStatus).toBe(1);
    await expect(migrate({ apply: true, backupDir })).rejects.toThrow(/status yo'q/);
    expect(await Order.countDocuments({ origin: "meros" })).toBe(0);
  });

  test("partial-unique indeks yo'q — xato (skript indeks YARATMAYDI)", async () => {
    await Order.collection.dropIndex(Order.OPEN_INDEX_NAME);
    try {
      expect((await preconditions()).indexOk).toBe(false);
      await expect(migrate({ apply: true, backupDir })).rejects.toThrow(/indeksi yo'q/);
    } finally {
      await Order.createIndexes();
    }
  });
});

describe("`--apply`", () => {
  test("machine + leave → `meros` loyiha; machine yana `active: true`", async () => {
    const res = await migrate({ apply: true, backupDir });
    expect(res).toMatchObject({ created: 2, raced: 0, reactivated: 1 });
    expect(fs.existsSync(res.backup)).toBe(true);

    const machine = await Order.findOne({ resident: ids.machine }).lean();
    expect(machine).toMatchObject({
      origin: "meros",
      status: "loyiha",
      countingYear: "2025/2026",
      draftedAt: FLAG_AT,
      hoursAtDraft: 80,
    });
    expect(machine.history).toEqual([
      expect.objectContaining({ action: "migratsiya", source: "migration", note: "meros: active=false" }),
    ]);
    expect((await Resident.collection.findOne({ _id: ids.machine })).active).toBe(true);
    expect(await Order.countDocuments({ resident: ids.leave, origin: "meros" })).toBe(1);
  });

  test("hisobot sinflariga TEGILMAYDI (deleted, violation, runtime, hasOrder)", async () => {
    await migrate({ apply: true, backupDir });
    for (const key of ["deleted", "violation", "runtime"]) {
      expect(await Order.countDocuments({ resident: ids[key] })).toBe(0);
    }
    expect(await Order.countDocuments({ resident: ids.hasOrder })).toBe(1);
  });

  test("ikkinchi `--apply` — idempotent (yangi hujjat yo'q)", async () => {
    await migrate({ apply: true, backupDir });
    const again = await migrate({ apply: true, backupDir });
    expect(again.created).toBe(0);
    expect(sizes(again.classes)).toMatchObject({ machine: 0, leave: 0, hasOrder: 3 });
  });

  test("`active:false` + ochiq hujjat — faqat qayta faollashtiriladi, ikkinchi hujjat YO'Q", async () => {
    await Order.create({ resident: ids.machine, origin: "meros", status: "loyiha", countingYear: "2025/2026", draftedAt: FLAG_AT });
    const res = await migrate({ apply: true, backupDir });
    expect(res.plan.find((p) => p.residentId === String(ids.machine))).toMatchObject({ orderId: null, reactivate: true });
    expect(await Order.countDocuments({ resident: ids.machine })).toBe(1);
    expect((await Resident.collection.findOne({ _id: ids.machine })).active).toBe(true);

    const back = await revert({ file: res.backup });
    expect(back.untouched).toEqual([]);
    expect((await Resident.collection.findOne({ _id: ids.machine })).active).toBe(false);
    expect(await Order.countDocuments({ resident: ids.machine, status: "loyiha" })).toBe(1);
  });

  test("ta'til + imzolangan buyruq (yarim imzo) — `hasOrder`, yangi hujjat YO'Q", async () => {
    await Order.create({ resident: ids.leave, origin: "meros", status: "imzolangan", countingYear: "2025/2026", draftedAt: FLAG_AT });
    const res = await migrate({ apply: true, backupDir });
    expect(res.classes.hasOrder.map((r) => String(r._id))).toContain(String(ids.leave));
    expect(await Order.countDocuments({ resident: ids.leave })).toBe(1);
  });
});

describe("`--revert` — hech narsa O'CHIRILMAYDI", () => {
  test("tegilmagan `meros` → `bekor_qilingan`, rezident yana `active: false`", async () => {
    const { backup } = await migrate({ apply: true, backupDir });
    const res = await revert({ file: backup });
    expect(res).toMatchObject({ planned: 2, orders: 2, residents: 1, untouched: [] });
    const machine = await Order.findOne({ resident: ids.machine }).lean();
    expect(machine).toMatchObject({ status: "bekor_qilingan", closeReason: "migratsiya_qaytarildi" });
    expect(await Order.countDocuments({ origin: "meros" })).toBe(2);
    expect((await Resident.collection.findOne({ _id: ids.machine })).active).toBe(false);
  });

  test("bo'lim allaqachon tekkan hujjat QAYTARILMAYDI", async () => {
    const { backup, plan } = await migrate({ apply: true, backupDir });
    const touched = plan.find((p) => p.reactivate).orderId;
    await Order.updateOne(
      { _id: touched },
      { $push: { history: { at: new Date(), action: "bekor_qilindi", source: "cron" } } },
    );
    const res = await revert({ file: backup });
    expect(res.untouched).toEqual([touched]);
    expect(res.residents).toBe(0);
  });
});
