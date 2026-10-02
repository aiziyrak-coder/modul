"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const mongoose = require("mongoose");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const { residentFilter } = require("#modules/4.05-residency/residencyTest/residencyTest.service");
const R = require("./sessionRoster");

const SESSION = {
  _id: "s1",
  status: "announced",
  day: "2026-09-28",
  group: "g1",
  science: "sc1",
  lessonType: "amaliy",
  hours: 3,
  announcedBy: "u1",
  rosterScope: "group",
};
const chain = (rows) => ({ select: () => ({ lean: () => Promise.resolve(rows) }) });
const dup = (index, name) => ({ index, err: { index, code: 11000, errmsg: `E11000 duplicate key error index: ${name} dup key` } });
const bulkError = (writeErrors, extra = {}) => Object.assign(new Error("bulk"), { writeErrors, ...extra });
let dbSession;

beforeEach(() => {
  dbSession = SESSION;
  jest.spyOn(Session, "findById").mockImplementation(() => ({ lean: () => Promise.resolve(dbSession) }));
  jest.spyOn(Resident, "distinct").mockResolvedValue(["r1", "r2", "r3"]);
  jest.spyOn(Roster, "find").mockReturnValue(chain([]));
  jest.spyOn(Roster, "insertMany").mockResolvedValue([]);
  jest.spyOn(Roster, "updateMany").mockResolvedValue({ modifiedCount: 0 });
  jest.spyOn(Roster, "countDocuments").mockResolvedValue(3);
  jest.spyOn(Session, "exists").mockResolvedValue({ _id: "s1" });
  jest.spyOn(Session, "distinct").mockResolvedValue([]);
  jest.spyOn(Session, "updateOne").mockResolvedValue({ modifiedCount: 1 });
});
afterEach(() => jest.restoreAllMocks());

describe("kesim — D-SCOPE, P5 oq ro'yxat, R-1=B", () => {
  test("PARITET: residencyTest.residentFilter bilan bir xil darvoza", () => {
    const cut = R.studyCutFilter();
    const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
    expect(pick(cut, ["active", "status", "expulsionOrderCreated"])).toEqual(residentFilter({}));
    expect(cut).toMatchObject({ program: "ordinatura", deletedAt: null });
    expect(Resident.RESIDENT_PROGRAMS).toContain(cut.program);
  });

  test("group doirasi — butun guruh; supervised — e'lonchining rezidentlari", () => {
    expect(R.eligibleFilter(SESSION)).toEqual({ ...R.studyCutFilter(), group: "g1" });
    expect(R.eligibleFilter({ ...SESSION, rosterScope: "supervised" })).toEqual({
      ...R.studyCutFilter(),
      group: "g1",
      supervisor: "u1",
    });
  });

  test("selectSessionRoster — distinct `_id` (o'chirilganlar filtrda chiqadi)", async () => {
    await expect(R.selectSessionRoster(SESSION)).resolves.toEqual(["r1", "r2", "r3"]);
    expect(Resident.distinct).toHaveBeenCalledWith("_id", R.eligibleFilter(SESSION));
  });

  test("previewRoster — boshqa sessiya freymi `taken`, o'ziniki `ownFramed`", async () => {
    Roster.find.mockReturnValue(chain([{ resident: "r1", session: "s9" }, { resident: "r2", session: "s1" }]));
    const out = await R.previewRoster(SESSION);
    expect(out).toEqual({ eligible: ["r1", "r2", "r3"], taken: [{ resident: "r1", session: "s9" }], ownFramed: ["r2"] });
    expect(Roster.find).toHaveBeenCalledWith(
      expect.objectContaining({ resident: { $in: ["r1", "r2", "r3"] }, day: "2026-09-28", cancelledAt: null }),
    );
    const { _id, ...draft } = SESSION;
    expect(_id).toBe("s1");
    expect((await R.previewRoster(draft)).taken).toHaveLength(2);
  });

  test("bekor sessiyaning qolib ketgan freymi rezidentni band qilmaydi — supuriladi (I4 tiklash)", async () => {
    Roster.find.mockReturnValue(chain([{ resident: "r1", session: "s-dead" }, { resident: "r2", session: "s9" }]));
    Session.distinct.mockResolvedValue(["s-dead"]);
    const out = await R.previewRoster(SESSION);
    expect(Session.distinct).toHaveBeenCalledWith("_id", { _id: { $in: ["s-dead", "s9"] }, status: { $ne: "announced" } });
    expect(Roster.updateMany).toHaveBeenCalledWith(
      { session: { $in: ["s-dead"] }, cancelledAt: null },
      { $set: { cancelledAt: expect.any(Date) } },
    );
    expect(out.taken).toEqual([{ resident: "r2", session: "s9" }]);
  });

  test("band freym yo'q — sessiya holati so'ralmaydi, yozuv yo'q", async () => {
    await R.previewRoster(SESSION);
    expect(Session.distinct).not.toHaveBeenCalled();
    expect(Roster.updateMany).not.toHaveBeenCalled();
  });
});

describe("populate qilingan sessiya (L3/L4 chaqiruvi)", () => {
  test("havolalar id sifatida olinadi; fanOut sessiyani id bo'yicha qayta o'qiydi", async () => {
    const populated = { ...SESSION, rosterScope: "supervised", group: { _id: "g1", title: "G" }, announcedBy: { _id: "u1" }, science: { _id: "sc1" } };
    expect(R.eligibleFilter(populated)).toEqual(R.eligibleFilter({ ...SESSION, rosterScope: "supervised" }));
    await R.previewRoster(populated);
    expect(Roster.find.mock.calls[0][0].science).toBe("sc1");
    await R.fanOut(populated);
    expect(Session.findById).toHaveBeenCalledWith("s1");
    expect(Roster.insertMany.mock.calls[0][0][0].science).toBe("sc1");
  });
});

describe("fail-closed — to'liq bo'lmagan sessiya (sessiya proyeksiyasi)", () => {
  test.each([
    ["rosterScope yo'q", { ...SESSION, rosterScope: undefined }],
    ["noma'lum rosterScope", { ...SESSION, rosterScope: "all" }],
    ["guruh yo'q", { ...SESSION, group: undefined }],
    ["supervised, e'lonchi yo'q", { ...SESSION, rosterScope: "supervised", announcedBy: null }],
  ])("eligibleFilter: %s — xato (butun guruh kesimi EMAS)", (_label, session) => {
    expect(() => R.eligibleFilter(session)).toThrow(/eligibleFilter/);
  });

  test("selectSessionRoster ham bazaga bormaydi", () => {
    expect(() => R.selectSessionRoster({ _id: "s1", group: "g1" })).toThrow(/eligibleFilter/);
    expect(Resident.distinct).not.toHaveBeenCalled();
  });

  test("fanOut chaqiruvchi proyeksiyasiga ishonmaydi — doira va holat bazadan", async () => {
    dbSession = { ...SESSION, rosterScope: "supervised" };
    await R.fanOut({ _id: "s1", group: "g1" });
    expect(Session.findById).toHaveBeenCalledWith("s1");
    expect(Resident.distinct).toHaveBeenCalledWith("_id", expect.objectContaining({ group: "g1", supervisor: "u1" }));
    expect(Roster.insertMany).toHaveBeenCalled();
  });

  test("fanOut: sessiya bazada yo'q — xato, yozuv yo'q", async () => {
    dbSession = null;
    await expect(R.fanOut({ _id: "s404" })).rejects.toThrow(/topilmadi/);
    expect(Roster.insertMany).not.toHaveBeenCalled();
    expect(Roster.updateMany).not.toHaveBeenCalled();
  });
});

describe("classifyInsertError — faqat bizning indekslar yutiladi", () => {
  const rows = [{ resident: "r1" }, { resident: "r2" }];

  test("live-key va session-resident E11000 → kiritilmagan rezidentlar", () => {
    const err = bulkError([dup(0, "resident_lesson_live_unique"), dup(1, "session_resident_unique")]);
    expect(R.classifyInsertError(err, rows)).toEqual(["r1", "r2"]);
    const raw = bulkError([{ index: 1, code: 11000, errmsg: "index: resident_lesson_live_unique" }]);
    expect(R.classifyInsertError(raw, rows)).toEqual(["r2"]);
  });

  test.each([
    ["writeErrors yo'q", new Error("net")],
    ["bo'sh writeErrors (writeConcern)", bulkError([], { writeConcernErrors: [{ code: 64 }] })],
    ["code 121", bulkError([{ index: 0, err: { code: 121, errmsg: "Document failed validation" } }])],
    ["begona indeks", bulkError([dup(0, "_id_")])],
    ["indeks tashqarisi", bulkError([dup(5, "resident_lesson_live_unique")])],
    ["aralash validatsiya", bulkError([dup(0, "session_resident_unique")], { results: [new mongoose.Error.ValidationError()] })],
  ])("%s → qayta tashlanadi", (_label, err) => {
    expect(() => R.classifyInsertError(err, rows)).toThrow(err);
  });
});

describe("fanOut — qadamlar tartibi", () => {
  test("bazada bekor sessiya — kesim o'qilmaydi, qolgan jonli freymlari supuriladi (I4 tiklash)", async () => {
    const at = new Date("2026-09-27T08:00:00Z");
    dbSession = { ...SESSION, status: "cancelled", cancelledAt: at };
    await expect(R.fanOut(SESSION)).resolves.toEqual({ framed: 0, conflicts: [] });
    expect(Roster.updateMany).toHaveBeenCalledWith({ session: "s1", cancelledAt: null }, { $set: { cancelledAt: at } });
    expect(Resident.distinct).not.toHaveBeenCalled();
    expect(Roster.insertMany).not.toHaveBeenCalled();
    expect(Session.updateOne).not.toHaveBeenCalled();
  });

  test("band va o'zi freymlaganlar qatorga kirmaydi; qator shakli va opsiyalar", async () => {
    Roster.find.mockReturnValue(chain([{ resident: "r1", session: "s9" }, { resident: "r2", session: "s1" }]));
    const out = await R.fanOut(SESSION);
    const [rows, opts] = Roster.insertMany.mock.calls[0];
    expect(rows).toEqual([
      {
        session: "s1", resident: "r3", day: "2026-09-28", science: "sc1", lessonType: "amaliy", hours: 3,
        outcome: "pending", outcomeReason: null, attendance: null, resolvedAt: null, cancelledAt: null,
      },
    ]);
    expect(opts).toEqual({ ordered: false, throwOnValidationError: true });
    expect(out).toEqual({ framed: 3, conflicts: [{ resident: "r1", session: "s9" }] });
  });

  test("beforeWrite pre-check'dan KEYIN, insertMany'dan OLDIN; afterWrite — keyin", async () => {
    const hooks = { beforeWrite: jest.fn(), afterWrite: jest.fn() };
    await R.fanOut(SESSION, hooks);
    const order = (fn) => fn.mock.invocationCallOrder[0];
    expect(order(Roster.find)).toBeLessThan(order(hooks.beforeWrite));
    expect(order(hooks.beforeWrite)).toBeLessThan(order(Roster.insertMany));
    expect(order(Roster.insertMany)).toBeLessThan(order(hooks.afterWrite));
    expect(order(hooks.afterWrite)).toBeLessThan(order(Session.exists));
  });

  test("yozgandan keyin sessiya bekor — o'z freymlari bekor qilinadi (I4)", async () => {
    Session.exists.mockResolvedValue(null);
    await R.fanOut(SESSION);
    expect(Session.exists).toHaveBeenCalledWith({ _id: "s1", status: "announced" });
    expect(Roster.updateMany).toHaveBeenCalledWith({ session: "s1", cancelledAt: null }, { $set: { cancelledAt: expect.any(Date) } });
    expect(Roster.updateMany.mock.invocationCallOrder[0]).toBeGreaterThan(Roster.insertMany.mock.invocationCallOrder[0]);
  });

  test("yozuv yiqilsa ham (qisman yozilgan bo'lishi mumkin) holat qayta tekshiriladi, xato qayta tashlanadi", async () => {
    const boom = bulkError([], { writeConcernErrors: [{ code: 64 }] });
    Roster.insertMany.mockRejectedValue(boom);
    Session.exists.mockResolvedValue(null);
    await expect(R.fanOut(SESSION)).rejects.toBe(boom);
    expect(Session.exists).toHaveBeenCalledWith({ _id: "s1", status: "announced" });
    expect(Roster.updateMany).toHaveBeenCalledWith({ session: "s1", cancelledAt: null }, { $set: { cancelledAt: expect.any(Date) } });
    expect(Session.updateOne).not.toHaveBeenCalled();
  });
});

describe("fanOut — yakun", () => {
  test("E11000 dagi rezident — yakuniy so'rovdan `conflicts`; o'z sessiyasi chiqariladi", async () => {
    Roster.insertMany.mockRejectedValue(bulkError([dup(0, "resident_lesson_live_unique"), dup(1, "session_resident_unique")]));
    Roster.find
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([{ resident: "r1", session: "s7" }, { resident: "r2", session: "s1" }]));
    const out = await R.fanOut(SESSION);
    expect(out.conflicts).toEqual([{ resident: "r1", session: "s7" }]);
    expect(Roster.find.mock.calls[1][0].resident).toEqual({ $in: ["r1", "r2"] });
  });

  test("fannedOutAt + framedCount faqat e'lon qilingan sessiyaga", async () => {
    Roster.countDocuments.mockResolvedValue(2);
    const out = await R.fanOut(SESSION);
    expect(Roster.countDocuments).toHaveBeenCalledWith({ session: "s1", cancelledAt: null });
    expect(Session.updateOne).toHaveBeenCalledWith(
      { _id: "s1", status: "announced" },
      { $set: { fannedOutAt: expect.any(Date), framedCount: 2 } },
    );
    expect(out.framed).toBe(2);
  });

  test("hamma allaqachon freymlangan — insertMany chaqirilmaydi", async () => {
    Roster.find.mockReturnValue(chain(["r1", "r2", "r3"].map((resident) => ({ resident, session: "s1" }))));
    await R.fanOut(SESSION);
    expect(Roster.insertMany).not.toHaveBeenCalled();
  });
});

describe("cancelFrames / withdrawFrames", () => {
  test("cancelFrames — jonli freymlar, modifiedCount", async () => {
    Roster.updateMany.mockResolvedValue({ modifiedCount: 4 });
    const at = new Date();
    await expect(R.cancelFrames("s1", at)).resolves.toBe(4);
    expect(Roster.updateMany).toHaveBeenCalledWith({ session: "s1", cancelledAt: null }, { $set: { cancelledAt: at } });
  });

  test("withdrawFrames — `present` ga tegmaydi; guard faqat toraytiradi", async () => {
    Roster.updateMany.mockResolvedValue({ modifiedCount: 1 });
    const at = new Date();
    await expect(R.withdrawFrames("s1", ["r1"], at, { outcome: "present", score: null })).resolves.toBe(1);
    const [filter, update] = Roster.updateMany.mock.calls[0];
    expect(filter.$and[0]).toEqual({ session: "s1", resident: { $in: ["r1"] }, outcome: { $ne: "present" }, cancelledAt: null });
    expect(filter.$and[1]).toEqual({ outcome: "present", score: null });
    expect(update).toEqual({ $set: { cancelledAt: at } });
  });

  test("withdrawFrames — bo'sh ro'yxat bazaga bormaydi", async () => {
    await expect(R.withdrawFrames("s1", [], new Date())).resolves.toBe(0);
    expect(Roster.updateMany).not.toHaveBeenCalled();
  });
});
