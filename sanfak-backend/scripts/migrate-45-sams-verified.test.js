"use strict";

const mockCollection = {
  countDocuments: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
  updateMany: jest.fn(),
};

jest.mock("mongoose", () => ({
  connection: { db: { collection: jest.fn(() => mockCollection), databaseName: "demo" } },
  Types: { ObjectId: jest.fn((id) => ({ oid: id })) },
  connect: jest.fn(),
  disconnect: jest.fn(),
}));

const fs = require("fs");
const mongoose = require("mongoose");
const {
  COLLECTION,
  CHUNK_SIZE,
  survey,
  snapshot,
  applyPlan,
  migrate,
  exitCodeFor,
  revert,
} = require("./migrate-45-sams-verified");

const TARGET_JSON = JSON.stringify({ samsVerified: true, session: null });
const OTHER_CAS = { $nin: [true, false], $not: { $type: "null" } };
const state = { samsTrue: 0, manualTrue: 0, presentNoEvidence: 0, inTarget: 0, noEvidence: 0 };

const armFind = (docs) =>
  mockCollection.find.mockReturnValue({ toArray: jest.fn().mockResolvedValue(docs) });
const ids = (n, prefix = "id") => Array.from({ length: n }, (_, i) => `${prefix}${i}`);
const filters = () => mockCollection.updateMany.mock.calls.map((c) => c[0]);
const updates = () => mockCollection.updateMany.mock.calls.map((c) => c[1]);

const countFor = (q) => {
  if (q._id) return q.samsVerified === true ? state.inTarget : state.noEvidence;
  const json = JSON.stringify(q);
  if (json === TARGET_JSON) return state.samsTrue;
  if (json === JSON.stringify({ manualVerified: true })) return state.manualTrue;
  if (q.status === "present" && q.samsVerified) return state.presentNoEvidence;
  return 0;
};

let write;
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  Object.assign(state, { samsTrue: 0, manualTrue: 0, presentNoEvidence: 0, inTarget: 0, noEvidence: 0 });
  mockCollection.countDocuments.mockImplementation(async (q) => countFor(q));
  mockCollection.aggregate.mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) });
  mockCollection.updateMany.mockImplementation(async (filter) => {
    const n = filter._id.$in.length;
    state.samsTrue -= n;
    if (filter.manualVerified !== true) state.manualTrue += n;
    return { modifiedCount: n };
  });
  armFind([]);
  jest.spyOn(fs, "mkdirSync").mockImplementation(() => {});
  write = jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
});

describe("konstantalar, survey, snapshot", () => {
  test("kolleksiya va bo'lak hajmi", () => {
    expect(COLLECTION).toBe("attendances");
    expect(CHUNK_SIZE).toBe(1000);
  });

  test("native kolleksiyadan o'qiydi (soft-delete hook'i chetlab o'tiladi)", async () => {
    await survey();
    expect(mongoose.connection.db.collection).toHaveBeenCalledWith("attendances");
  });

  test("o'chirilganlarni, sessiya qatorlarini va dalilsiz present'ni SANAYDI", async () => {
    await survey();
    const qs = mockCollection.countDocuments.mock.calls.map((c) => c[0]);
    expect(qs).toEqual(
      expect.arrayContaining([
        { deletedAt: { $ne: null } },
        { samsVerified: true, session: null, deletedAt: { $ne: null } },
        { samsVerified: true, session: { $ne: null } },
        { status: "present", samsVerified: { $ne: true }, manualVerified: { $ne: true } },
      ]),
    );
  });

  test("🔴 guruhlar: true / false / null / yo'q — null alohida (aniq qaytarish)", async () => {
    armFind([
      { _id: "a", manualVerified: true },
      { _id: "b", manualVerified: false },
      { _id: "c" },
      { _id: "d", manualVerified: null },
    ]);
    expect(await snapshot()).toEqual({ wasTrue: ["a"], wasFalse: ["b"], wasNull: ["d"], other: ["c"] });
    expect(mockCollection.find).toHaveBeenCalledWith(
      { samsVerified: true, session: null },
      { projection: { _id: 1, manualVerified: 1 } },
    );
  });

  test("dry-run HECH NARSA yozmaydi (baza ham, fayl ham)", async () => {
    armFind([{ _id: "a" }]);
    const r = await migrate({});
    expect(mockCollection.updateMany).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(r.applied).toBeNull();
    expect(r.planned).toEqual({ wasTrue: 0, wasFalse: 0, wasNull: 0, other: 1 });
  });
});

describe("migrate — --apply: zaxira va CAS", () => {
  test("🔴 zaxira BIRINCHI updateMany dan OLDIN yoziladi", async () => {
    armFind([{ _id: "a", manualVerified: false }]);
    await migrate({ apply: true, backupDir: "/tmp/x" });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.invocationCallOrder[0]).toBeLessThan(
      mockCollection.updateMany.mock.invocationCallOrder[0],
    );
  });

  test("🔴 zaxira shakli: ulangan baza, vaqt, guruhlar, `wx` (ustidan yozmaydi)", async () => {
    armFind([{ _id: "a", manualVerified: true }, { _id: "b" }, { _id: "n", manualVerified: null }]);
    const r = await migrate({ apply: true, backupDir: "/tmp/x" });
    const [file, body, opts] = write.mock.calls[0];
    expect(file).toContain("sams-verified-demo-");
    expect(r.backup).toBe(file);
    expect(opts).toEqual({ flag: "wx" });
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({ collection: "attendances", script: "migrate-45-sams-verified", db: "demo" });
    expect(Date.parse(payload.createdAt)).not.toBeNaN();
    expect(payload.groups).toEqual({ wasTrue: ["a"], wasFalse: [], wasNull: ["n"], other: ["b"] });
  });

  test("🔴 har guruh o'z CAS sharti bilan; `$set` aynan ikki bayroq", async () => {
    armFind([
      { _id: "a", manualVerified: true },
      { _id: "b", manualVerified: false },
      { _id: "n", manualVerified: null },
      { _id: "c" },
    ]);
    await migrate({ apply: true });
    const base = { samsVerified: true, session: null };
    expect(filters()).toEqual([
      { _id: { $in: ["a"] }, ...base, manualVerified: true },
      { _id: { $in: ["b"] }, ...base, manualVerified: false },
      { _id: { $in: ["n"] }, ...base, manualVerified: { $type: "null" } },
      { _id: { $in: ["c"] }, ...base, manualVerified: OTHER_CAS },
    ]);
    for (const u of updates()) {
      expect(u).toEqual({ $set: { samsVerified: false, manualVerified: true } });
    }
  });

  test("ko'chiriladigan nishon yo'q — zaxira ham, yozuv ham yo'q", async () => {
    const r = await migrate({ apply: true });
    expect(write).not.toHaveBeenCalled();
    expect(mockCollection.updateMany).not.toHaveBeenCalled();
    expect(r.applied).toMatchObject({ planned: 0, modified: 0, raced: 0 });
    expect(r.invariantOk).toBe(true);
  });
});

describe("migrate — poyga: zaxiradan chiqarish", () => {
  const T0 = "2026-09-27T10:00:00.000Z";
  beforeEach(() => jest.useFakeTimers({ now: new Date(T0), doNotFake: ["nextTick", "queueMicrotask", "setImmediate"] }));
  afterEach(() => jest.useRealTimers());

  test("🔴 ko'chmagan qator zaxiradan chiqariladi (atomik, ASL createdAt saqlanadi)", async () => {
    const rename = jest.spyOn(fs, "renameSync").mockImplementation(() => {});
    const docs = [{ _id: "a", manualVerified: true }, { _id: "b", manualVerified: false }];
    const later = () => {
      jest.setSystemTime(new Date("2026-09-27T10:05:00.000Z"));
      return { toArray: jest.fn().mockResolvedValue([{ _id: "b" }]) };
    };
    mockCollection.find
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue(docs) })
      .mockImplementationOnce(later);
    mockCollection.updateMany
      .mockResolvedValueOnce({ modifiedCount: 1 })
      .mockResolvedValueOnce({ modifiedCount: 0 });

    const r = await migrate({ apply: true, backupDir: "/tmp/x" });

    expect(r.applied).toMatchObject({ raced: 1, pruned: 1 });
    expect(JSON.parse(write.mock.calls[1][1]).createdAt).toBe(T0);
    expect(mockCollection.find).toHaveBeenLastCalledWith(
      { _id: { $in: ["a", "b"] }, samsVerified: true, session: null },
      { projection: { _id: 1 } },
    );
    const [tmp, body] = write.mock.calls[1];
    expect(tmp).toBe(`${r.backup}.tmp`);
    const first = JSON.parse(write.mock.calls[0][1]);
    expect(JSON.parse(body)).toEqual({
      ...first,
      groups: { wasTrue: ["a"], wasFalse: [], wasNull: [], other: [] },
      raced: ["b"],
    });
    expect(rename).toHaveBeenCalledWith(`${r.backup}.tmp`, r.backup);
  });
});

describe("invariant — REJADAGI id'lar ustida", () => {
  const plan3 = () =>
    armFind([{ _id: "a", manualVerified: true }, { _id: "b" }, { _id: "c", manualVerified: false }]);

  test("toza ko'chirish → OK; global sonlar hisobotda", async () => {
    Object.assign(state, { samsTrue: 3, manualTrue: 5 });
    plan3();
    const r = await migrate({ apply: true });
    expect(r.after).toMatchObject({ samsTrue: 0, manualTrue: 7 });
    expect(r.invariant).toEqual({ inTarget: 0, noEvidence: 0, ok: true });
    expect(r.invariantOk).toBe(true);
  });

  test("so'rov rejadagi id'lar bilan cheklangan", async () => {
    plan3();
    await migrate({ apply: true });
    const qs = mockCollection.countDocuments.mock.calls.map((c) => c[0]).filter((q) => q._id);
    expect(qs).toEqual([
      { _id: { $in: ["a", "c", "b"] }, samsVerified: true, session: null },
      { _id: { $in: ["a", "c", "b"] }, samsVerified: { $ne: true }, manualVerified: { $ne: true } },
    ]);
  });

  test("🔴 parallel trafik global sonlarni o'zgartirsa ham OK (yolg'on exit 1 yo'q)", async () => {
    plan3();
    mockCollection.updateMany.mockImplementation(async (f) => {
      state.manualTrue += 2;
      state.presentNoEvidence += 1;
      return { modifiedCount: f._id.$in.length };
    });
    const r = await migrate({ apply: true });
    expect(r.invariantOk).toBe(true);
    expect(exitCodeFor(r, true)).toBe(0);
  });

  test("🔴 rejadagi qator nishonda qolgan (raced emas) → false", async () => {
    plan3();
    state.inTarget = 1;
    expect((await migrate({ apply: true })).invariantOk).toBe(false);
  });

  test("🔴 rejadagi qator dalilsiz qolgan → false", async () => {
    plan3();
    state.noEvidence = 1;
    expect((await migrate({ apply: true })).invariantOk).toBe(false);
  });
});

describe("exitCodeFor", () => {
  const ok = { applied: { raced: 0 }, invariantOk: true, after: { samsTrue: 0 } };

  test("toza --apply → 0; dry-run har doim 0", () => {
    expect(exitCodeFor(ok, true)).toBe(0);
    expect(exitCodeFor({ applied: null, invariantOk: null, after: null }, false)).toBe(0);
  });

  test.each([
    ["raced > 0", { applied: { raced: 1 } }],
    ["invariant buzilgan", { invariantOk: false }],
    ["nishonda yangi qator (qamrov to'liq emas)", { after: { samsTrue: 2 } }],
  ])("🔴 %s → 1", (_, over) => {
    expect(exitCodeFor({ ...ok, ...over }, true)).toBe(1);
  });
});

describe("applyPlan — bo'laklar va raced", () => {
  test("2500 id bitta guruhda → 3 so'rov (1000 · 1000 · 500)", async () => {
    await applyPlan({ wasTrue: [], wasFalse: ids(2500), wasNull: [], other: [] });
    const sizes = filters().map((f) => f._id.$in.length);
    expect(sizes).toEqual([1000, 1000, 500]);
    expect(filters()[1]._id.$in[0]).toBe("id1000");
  });

  test("aynan 1000 → bitta so'rov (bo'sh bo'lak yo'q)", async () => {
    await applyPlan({ wasTrue: ids(1000), wasFalse: [], wasNull: [], other: [] });
    expect(mockCollection.updateMany).toHaveBeenCalledTimes(1);
  });

  test("raced = rejada − yozilgan; modifiedWasTrue alohida", async () => {
    mockCollection.updateMany
      .mockResolvedValueOnce({ modifiedCount: 2 })
      .mockResolvedValueOnce({ modifiedCount: 0 })
      .mockResolvedValueOnce({ modifiedCount: 1 });
    const r = await applyPlan({ wasTrue: ids(2), wasFalse: ["x"], wasNull: [], other: ["y", "z"] });
    expect(r).toEqual({ planned: 5, modified: 3, modifiedWasTrue: 2, raced: 2 });
  });
});

describe("revert — faqat hali ko'chirilgan, keyin tahrirlanmagan qatorlar", () => {
  const CREATED = "2026-09-27T10:00:00.000Z";
  const arm = (groups, extra = {}) =>
    jest.spyOn(fs, "readFileSync").mockReturnValue(
      JSON.stringify({
        collection: "attendances",
        script: "migrate-45-sams-verified",
        db: "demo",
        createdAt: CREATED,
        groups,
        ...extra,
      }),
    );

  test("🔴 CAS filtri (+ updatedAt) va guruhma-guruh qaytarish (null → null, yo'q → $unset)", async () => {
    arm({ wasTrue: ["a"], wasFalse: ["b"], wasNull: ["n"], other: ["c"] });
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
    const r = await revert({ file: "z.json" });

    const cas = {
      samsVerified: false,
      manualVerified: true,
      session: null,
      updatedAt: { $not: { $gte: new Date(CREATED) } },
    };
    expect(filters()).toEqual(["a", "b", "n", "c"].map((id) => ({ _id: { $in: [{ oid: id }] }, ...cas })));
    expect(updates()).toEqual([
      { $set: { samsVerified: true } },
      { $set: { samsVerified: true, manualVerified: false } },
      { $set: { samsVerified: true, manualVerified: null } },
      { $set: { samsVerified: true }, $unset: { manualVerified: "" } },
    ]);
    expect(r).toEqual({ planned: 4, restored: 4, skipped: 0 });
  });

  test("keyin o'zgargan qatorlar `skipped` da sanaladi", async () => {
    arm({ wasTrue: [], wasFalse: ["b", "c"], other: [] });
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
    expect(await revert({ file: "z.json" })).toEqual({ planned: 2, restored: 1, skipped: 1 });
  });

  test.each([
    ["boshqa skriptning zaxirasi", { script: "migrate-45-resident-status" }, /zaxirasi emas/],
    ["🔴 boshqa bazaning zaxirasi", { db: "institute-prod" }, /--allow-other-db/],
    ["baza nomi yo'q (eski zaxira)", { db: undefined }, /--allow-other-db/],
    ["createdAt yo'q", { createdAt: undefined }, /createdAt/],
  ])("%s → RAD, hech narsa yozilmaydi", async (_, extra, msg) => {
    arm({ wasTrue: ["a"] }, extra);
    await expect(revert({ file: "z.json" })).rejects.toThrow(msg);
    expect(mockCollection.updateMany).not.toHaveBeenCalled();
  });

  test("--allow-other-db — boshqa baza zaxirasi ataylab qabul qilinadi", async () => {
    arm({ wasTrue: ["a"] }, { db: "institute-prod" });
    mockCollection.updateMany.mockResolvedValue({ modifiedCount: 1 });
    expect(await revert({ file: "z.json", allowOtherDb: true })).toMatchObject({ restored: 1 });
  });
});
