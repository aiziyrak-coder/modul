"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const mongoose = require("mongoose");

const { Types } = mongoose;
const { EJSON } = mongoose.mongo.BSON;
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
require("#modules/4.05-residency/resident/resident.model");
const { countUnexcusedHours } = require("#modules/4.05-residency/_services/expulsionCheck");
const { currentAcademicYearWindow } = require("#modules/4.05-residency/_services/unexcusedWindow");
const {
  readIndexState,
  findDuplicateGroups,
  migrate,
  revert,
  printReport,
} = require("../../scripts/migrate-45-attendance-lesson-index");
const { compare: k4Compare } = require("../../scripts/recount-45-unexcused-hours");

const NAME = "resident_lesson_unique";
const backupDir = fs.mkdtempSync(path.join(os.tmpdir(), "attendance-migrate-"));
afterAll(() => fs.rmSync(backupDir, { recursive: true, force: true }));

const col = () => Attendance.collection;
const HOUR = 3600e3;
const FROM = currentAcademicYearWindow().from.getTime();
const D = new Date(FROM + 10 * 24 * HOUR);
const T0 = new Date(FROM + 11 * 24 * HOUR);
const at = (min) => new Date(T0.getTime() + min * 60e3);
const NOW = new Date(FROM + 20 * 24 * HOUR);

const residents = {};
const ids = {};
let original;

const seed = async (resident, fields) =>
  (await col().insertOne({
    resident, date: D, status: "absent", hours: 2, active: true, deletedAt: null, createdAt: T0, ...fields,
  })).insertedId;
const doc = (id) => col().findOne({ _id: id });
const loadAll = async () =>
  Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([k, id]) => [k, await doc(id)])));
const dropLessonIndex = () => col().dropIndex(NAME).catch((e) => { if (e.code !== 27) throw e; });
const backups = () => fs.readdirSync(backupDir);

beforeAll(async () => {
  await Attendance.init();
});

beforeEach(async () => {
  await dropLessonIndex();
  for (const f of backups()) fs.rmSync(path.join(backupDir, f));
  for (const k of ["g1", "g2", "g3", "g4", "g5", "same", "clean"]) {
    residents[k] = (await mongoose.connection.db.collection("residents")
      .insertOne({ fullName: `R-${k}`, active: true, deletedAt: null, totalUnexcusedHours: 99 })).insertedId;
  }
  const r = residents;
  Object.assign(ids, {
    g1Keep: await seed(r.g1, { createdAt: at(0) }),
    g1Lose: await seed(r.g1, { createdAt: at(1) }),
    g1Deleted: await seed(r.g1, { createdAt: at(2), deletedAt: at(3), deletionReason: "boshqa" }),
    g2Lose: await seed(r.g2, { createdAt: at(0) }),
    g2Keep: await seed(r.g2, { createdAt: at(5), status: "excused" }),
    g3Keep: await seed(r.g3, { createdAt: at(5), status: "present", score: 8, manualVerified: true }),
    g3Lose: await seed(r.g3, { createdAt: at(0) }),
    g4Keep: await seed(r.g4, { createdAt: at(0), lessonType: "amaliy" }),
    g4Lose: await seed(r.g4, { createdAt: at(1), lessonType: "amaliy", science: null }),
    g5Lose: await seed(r.g5, { createdAt: at(0), status: "excused", active: false }),
    g5Keep: await seed(r.g5, { createdAt: at(1) }),
    same0900: await seed(r.same, { date: new Date(D.getTime() + 9 * HOUR) }),
    same1430: await seed(r.same, { date: new Date(D.getTime() + 14.5 * HOUR) }),
    clean1: await seed(r.clean, { lessonType: "amaliy" }),
    clean2: await seed(r.clean, { lessonType: "maruza" }),
  });
  original = await loadAll();
});

const LOSERS = { g1Lose: "g1Keep", g2Lose: "g2Keep", g3Lose: "g3Keep", g4Lose: "g4Keep", g5Lose: "g5Keep" };
const untouchedKeys = () => Object.keys(ids).filter((k) => !(k in LOSERS));

describe("dry-run", () => {
  test("HECH NARSA yozmaydi; keeper/yutqazgan, soat va bir-kunlik juftlik to'g'ri", async () => {
    const r = await migrate({ now: NOW, backupDir });

    expect(await loadAll()).toEqual(original);
    expect(r.backup).toBeNull();
    expect(r.before).toMatchObject({ exists: false, matches: false, conflictingName: null });
    expect(r.plan.groups).toHaveLength(5);
    const keeperOf = Object.fromEntries(r.plan.groups.flatMap((g) => g.losers.map((l) => [String(l._id), String(g.keeperId)])));
    for (const [lose, keep] of Object.entries(LOSERS)) expect(keeperOf[String(ids[lose])]).toBe(String(ids[keep]));
    expect(r.plan.conflictGroups).toBe(3);
    expect(Object.fromEntries(r.plan.affected)).toEqual({
      [String(residents.g1)]: 2, [String(residents.g2)]: 2, [String(residents.g3)]: 2, [String(residents.g4)]: 2,
    });
    expect(Object.fromEntries(r.k4)).toEqual({
      [String(residents.g1)]: 2,
      [String(residents.g2)]: 0,
      [String(residents.g3)]: 0,
      [String(residents.g4)]: 2,
    });
    expect(r.sameDay).toHaveLength(1);
    expect(String(r.sameDay[0]._id.resident)).toBe(String(residents.same));
    expect(backups()).toEqual([]);
  });

  test("hisobot chop etiladi (ziddiyat, ta'sirlangan, bir-kunlik)", async () => {
    const out = [];
    const spy = jest.spyOn(console, "log").mockImplementation((s) => out.push(String(s)));
    try {
      await printReport(await migrate({ now: NOW, backupDir }), false);
    } finally {
      spy.mockRestore();
    }
    const text = out.join("\n");
    expect(text).toMatch(/Dublikat guruhlari: 5 {3}ortiqcha qatorlar \(soft-delete\): 5/);
    expect(text).toContain("R-g3 · ");
    expect(text).toMatch(/qoladi present \(\w+\) ← yutqazadi: absent \[status,score,manualVerified\]/);
    expect(text).toMatch(/R-g1: −2 soat · migratsiyadan keyin joriy yil: 2/);
    expect(text).toMatch(/recount «joriy yil» \(dry-run ham, --apply ham\) = «migratsiyadan keyin»/);
    expect(text).toMatch(/turli vaqtli qatorlar .*: 1/);
    expect(text).toMatch(/DRY-RUN/);
  });
});

describe("--apply", () => {
  test("faqat yutqazganlar belgi bilan soft-delete; indeks yaratildi va tasdiqlandi; zaxira EJSON", async () => {
    const r = await migrate({ apply: true, now: NOW, backupDir });
    const now = await loadAll();

    for (const [lose, keep] of Object.entries(LOSERS)) {
      expect(now[lose]).toEqual({
        ...original[lose], deletedAt: NOW, deletedBy: null, deletionReason: `duplicate_lesson:${ids[keep]}`,
      });
    }
    for (const k of untouchedKeys()) expect(now[k]).toEqual(original[k]);
    expect(r).toMatchObject({ softDeleted: 5, skipped: 0, indexCreated: true });
    expect(r.after.matches).toBe(true);
    expect((await readIndexState()).matches).toBe(true);

    const payload = EJSON.parse(fs.readFileSync(r.backup, "utf8"), { relaxed: false });
    expect(path.basename(r.backup)).toMatch(/^attendance-lesson-index-default-.*\.json$/);
    expect(payload).toMatchObject({ script: "migrate-45-attendance-lesson-index", createsIndex: true, indexBefore: null });
    expect(payload.loserDocs).toHaveLength(5);
    expect(payload.loserDocs[0]._id).toBeInstanceOf(Types.ObjectId);
    expect(payload.loserDocs[0].createdAt).toBeInstanceOf(Date);
    expect(payload.groups[0].losers[0]._id).toBeInstanceOf(Types.ObjectId);
  });

  test("keyingi dublikat → E11000; G1 rezidentining soati yarmiga tushadi", async () => {
    expect(await countUnexcusedHours(residents.g1)).toBe(4);
    await migrate({ apply: true, now: NOW, backupDir });
    expect(await countUnexcusedHours(residents.g1)).toBe(2);
    await expect(col().insertOne({ resident: residents.g1, date: D, deletedAt: null })).rejects.toMatchObject({ code: 11000 });
  });

  test("K4 prognozi: P9 dan keyin recount compare() = countUnexcusedHours = P9 hisoboti", async () => {
    const r = await migrate({ apply: true, now: NOW, backupDir });
    const k4 = await k4Compare();
    for (const k of ["g1", "g2", "g3", "g4"]) {
      const afterP9 = r.k4.get(String(residents[k]));
      expect(k4.rows.find((x) => x.id === String(residents[k])).currentYear).toBe(afterP9);
      expect(await countUnexcusedHours(residents[k])).toBe(afterP9);
    }
  });

  test("ikkinchi --apply — idempotent: guruh 0, soft-delete 0, indeks yaratilmaydi, zaxira yo'q", async () => {
    await migrate({ apply: true, now: NOW, backupDir });
    const r = await migrate({ apply: true, now: NOW, backupDir });
    expect(r.plan.groups).toEqual([]);
    expect(r).toMatchObject({ softDeleted: 0, indexCreated: false, backup: null });
    expect(backups()).toHaveLength(1);
  });
});

describe("--apply rad etadi — HECH NARSA yozilmaydi", () => {
  const nothingWritten = async () => {
    expect(await loadAll()).toEqual(original);
    expect(backups()).toEqual([]);
  };

  test("shu nomli, boshqa partial filtrli indeks → /spetsifikatsiya/", async () => {
    await col().createIndex({ resident: 1, date: 1, science: 1, lessonType: 1 },
      { name: NAME, partialFilterExpression: { deletedAt: null, active: true } });
    await expect(migrate({ apply: true, now: NOW, backupDir })).rejects.toThrow(/spetsifikatsiya/);
    await nothingWritten();
    await col().dropIndex(NAME);
  });

  test("shu kalitli, boshqa nomli indeks → rad", async () => {
    await col().createIndex({ resident: 1, date: 1, science: 1, lessonType: 1 }, { name: "legacy_lesson" });
    await expect(migrate({ apply: true, now: NOW, backupDir })).rejects.toThrow(/legacy_lesson/);
    await nothingWritten();
    await col().dropIndex("legacy_lesson");
  });

  test("bitta darsda 2+ sessiya qatori → rad (sessiya qatori yutqazmaydi)", async () => {
    await seed(residents.clean, { lessonType: "test", session: new Types.ObjectId() });
    await seed(residents.clean, { lessonType: "test", session: new Types.ObjectId() });
    await expect(migrate({ apply: true, now: NOW, backupDir })).rejects.toThrow(/sessiya/);
    await nothingWritten();
  });
});

describe("jonli yozuv dedupe va createIndex orasida", () => {
  test("🔴 yangi dublikat → /yangi dublikat/, indeks YO'Q; qayta ishga tushirish tuzatadi", async () => {
    const insertDup = () => seed(residents.g1, { createdAt: at(30) });
    await expect(migrate({ apply: true, now: NOW, backupDir, beforeCreateIndex: insertDup }))
      .rejects.toThrow(/yangi dublikat.*\(zaxira: .*attendance-lesson-index-default-/);
    expect((await readIndexState()).exists).toBe(false);

    const again = await migrate({ apply: true, now: new Date(NOW.getTime() + 60e3), backupDir });
    expect(again).toMatchObject({ softDeleted: 1, indexCreated: true });
    expect(again.plan.groups[0].keeperId).toEqual(ids.g1Keep);
  });
});

const proxyAttendance = (override) => {
  const db = mongoose.connection.db;
  const real = db.collection.bind(db);
  return jest.spyOn(db, "collection").mockImplementation((name, ...rest) => {
    const c = real(name, ...rest);
    if (name !== Attendance.collection.collectionName) return c;
    return new Proxy(c, {
      get(target, prop) {
        const o = override(target, prop);
        if (o) return o;
        const v = target[prop];
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
  });
};

const beforeFirst = (method, race) => {
  let fired = false;
  return proxyAttendance((target, prop) =>
    prop === method && !fired
      ? async (...args) => {
        fired = true;
        await race();
        return target[method](...args);
      }
      : null);
};
const applyAfterRace = async (race) => {
  const spy = beforeFirst("findOne", race);
  try {
    return await migrate({ apply: true, now: NOW, backupDir });
  } finally {
    spy.mockRestore();
  }
};
const liveInG1Lesson = () =>
  col().countDocuments({ resident: residents.g1, date: D, science: null, lessonType: null, deletedAt: null });

describe("o'z-o'zini tekshirish (R5: indeks jimgina qurilmasligi)", () => {
  test("🔴 createIndex xatosiz qaytib, indeks qurilmasa → «getIndexes() tasdiqlamadi»", async () => {
    const spy = proxyAttendance((target, prop) => (prop === "createIndex" ? async () => NAME : null));
    try {
      await expect(migrate({ apply: true, now: NOW, backupDir })).rejects.toThrow(/getIndexes\(\) tasdiqlamadi.*zaxira: /);
    } finally {
      spy.mockRestore();
    }
    expect((await readIndexState()).exists).toBe(false);
  });
});

describe("reja va soft-delete orasida qator o'zgarsa", () => {
  test("🔴 bo'lim yutqazganni sababli qildi → u o'chirilmaydi, indeks yiqiladi; qayta ishga tushirish yangidan rejalaydi", async () => {
    await expect(applyAfterRace(() => col().updateOne({ _id: ids.g1Lose }, { $set: { status: "excused" } })))
      .rejects.toThrow(/qator o'zgardi/);
    expect(await doc(ids.g1Lose)).toMatchObject({ status: "excused", deletedAt: null });
    expect((await readIndexState()).exists).toBe(false);

    const again = await migrate({ apply: true, now: new Date(NOW.getTime() + 60e3), backupDir });
    expect(again).toMatchObject({ softDeleted: 1, indexCreated: true });
    expect((await doc(ids.g1Lose)).deletedAt).toBeNull();
    expect((await doc(ids.g1Keep)).deletionReason).toBe(`duplicate_lesson:${ids.g1Lose}`);
  });

  test.each([
    ["yutqazgan boshqa darsga ko'chdi → endi dublikat emas, o'chirilmaydi", "g1Lose", { lessonType: "maruza" }, 0],
    ["keeper boshqa darsga ko'chdi → guruh o'tkaziladi, dars qatorsiz qolmaydi", "g1Keep", { lessonType: "maruza" }, 1],
    ["keeper'ni boshqa birov o'chirdi → yutqazgan darsning yagona jonli qatori bo'lib qoladi",
      "g1Keep", { deletedAt: at(50), deletionReason: "boshqa" }, 1],
  ])("🔴 %s", async (_title, changed, change, staleKeepers) => {
    const r = await applyAfterRace(() => col().updateOne({ _id: ids[changed] }, { $set: change }));

    expect(r).toMatchObject({ softDeleted: 4, skipped: 1, staleKeepers, indexCreated: true });
    expect(await doc(ids.g1Lose)).toMatchObject({ deletedAt: null });
    expect(await liveInG1Lesson()).toBe(1);
    expect(r.after.matches).toBe(true);
  });

  test("🔴 keeper'ning holati o'zgardi → guruh o'tkaziladi, indeks yiqiladi; qayta ishga tushirish yangidan rejalaydi", async () => {
    await expect(applyAfterRace(() => col().updateOne({ _id: ids.g2Keep }, { $set: { status: "absent" } })))
      .rejects.toThrow(/qator o'zgardi/);
    expect(await doc(ids.g2Lose)).toMatchObject({ deletedAt: null });

    const again = await migrate({ apply: true, now: new Date(NOW.getTime() + 60e3), backupDir });
    expect(again).toMatchObject({ softDeleted: 1, indexCreated: true });
    expect((await doc(ids.g2Keep)).deletionReason).toBe(`duplicate_lesson:${ids.g2Lose}`);
  });

  test("🔴 yutqazganni shu orada boshqa sabab bilan o'chirishdi → belgisi ustidan yozilmaydi, --revert uni tiriltirmaydi", async () => {
    const other = { deletedAt: at(50), deletionReason: "boshqa" };
    const r = await applyAfterRace(() => col().updateOne({ _id: ids.g1Lose }, { $set: other }));

    expect(r).toMatchObject({ softDeleted: 4, skipped: 1, staleKeepers: 0, indexCreated: true });
    expect(await doc(ids.g1Lose)).toMatchObject(other);

    const back = await revert({ file: r.backup });
    expect(back.untouched).toEqual([String(ids.g1Lose)]);
    expect(await doc(ids.g1Lose)).toMatchObject(other);
  });
});

describe("uzilgan --apply dan davom etish", () => {
  test("oldindan belgilangan yutqazgan — o'sha keeper, qolganlari o'chiriladi", async () => {
    const extra = await seed(residents.g1, { createdAt: at(10) });
    const marker = `duplicate_lesson:${ids.g1Keep}`;
    await col().updateOne({ _id: ids.g1Lose }, { $set: { deletedAt: NOW, deletedBy: null, deletionReason: marker } });

    const r = await migrate({ apply: true, now: NOW, backupDir });
    expect((await doc(extra)).deletionReason).toBe(marker);
    expect((await doc(ids.g1Keep)).deletedAt).toBeNull();
    expect(r.softDeleted).toBe(5);
  });
});

describe("--revert", () => {
  test("indeks tushadi; FAQAT belgili qatorlar AYNAN asl holiga; o'zgargani tegilmaydi", async () => {
    const bare = await col().insertOne({ resident: residents.g2, date: D, status: "absent", createdAt: at(9) });
    const { backup } = await migrate({ apply: true, now: NOW, backupDir });
    await col().updateOne({ _id: ids.g3Lose }, { $set: { deletionReason: "qo'lda o'chirildi" } });

    const r = await revert({ file: backup });
    expect(r).toMatchObject({ planned: 6, restored: 5, untouched: [String(ids.g3Lose)], indexDropped: true });
    expect((await readIndexState()).exists).toBe(false);
    for (const k of ["g1Lose", "g2Lose", "g4Lose", "g5Lose"]) expect(await doc(ids[k])).toEqual(original[k]);
    const restored = await doc(bare.insertedId);
    expect(restored).not.toHaveProperty("deletedAt");
    expect(restored).not.toHaveProperty("deletionReason");
    expect((await doc(ids.g3Lose)).deletedAt).toEqual(NOW);
    expect(await findDuplicateGroups()).toHaveLength(4);
  });

  test.each([["eski → yangi"], ["yangi → eski"]])("yiqilgan + qayta --apply: ikkala zaxira ham qaytariladi (%s)", async (order) => {
    let dupId;
    const insertDup = async () => { dupId = await seed(residents.g1, { createdAt: at(30) }); };
    await expect(migrate({ apply: true, now: NOW, backupDir, beforeCreateIndex: insertDup })).rejects.toThrow(/yangi dublikat/);
    expect(await migrate({ apply: true, now: new Date(NOW.getTime() + 60e3), backupDir })).toMatchObject({ softDeleted: 1 });
    const files = backups().sort().map((f) => path.join(backupDir, f));
    expect(files).toHaveLength(2);
    if (order === "yangi → eski") files.reverse();

    const results = [];
    for (const file of files) results.push(await revert({ file }));
    expect(results.map((x) => x.indexDropped)).toEqual([true, false]);
    expect((await readIndexState()).exists).toBe(false);
    for (const k of Object.keys(LOSERS)) expect(await doc(ids[k])).toEqual(original[k]);
    expect(await doc(dupId)).toMatchObject({ deletedAt: null });
    expect(await doc(dupId)).not.toHaveProperty("deletionReason");
  });

  test("boshqa bazaning zaxirasi rad etiladi (ataylab — allowOtherDb)", async () => {
    const { backup } = await migrate({ apply: true, now: NOW, backupDir });
    const payload = EJSON.parse(fs.readFileSync(backup, "utf8"), { relaxed: false });
    const other = path.join(backupDir, "other-db.json");
    fs.writeFileSync(other, EJSON.stringify({ ...payload, dbName: "boshqa" }, undefined, 0, { relaxed: false }));
    await expect(revert({ file: other })).rejects.toThrow(/bazasining zaxirasi/);
    expect((await readIndexState()).matches).toBe(true);
    expect((await revert({ file: other, allowOtherDb: true })).restored).toBe(5);
  });
});
