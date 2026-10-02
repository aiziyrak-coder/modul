"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const winston = require("#shared/winston.logger");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { applyResult, copiesFrameScore } = require("./sessionProjection");

const NOW = new Date("2026-10-13T03:00:00Z");
const REV = NOW.getTime();
const SESSION = {
  _id: "s1", day: "2026-10-12", hours: 4, science: "sc1", scienceTitle: "Terapiya", lessonType: "amaliy",
  announcedBy: "u-teacher", group: "g1",
};
const ENTRY = { _id: "f1", resident: "r1", score: 7 };
const LESSON = {
  date: new Date("2026-10-12T00:00:00.000Z"), hours: 4, science: "sc1", scienceTitle: "Terapiya", lessonType: "amaliy",
  teacher: "u-teacher", group: "g1", active: true, deletedAt: null, deletedBy: null, deletionReason: null, sessionRev: REV,
};
const base = { samsFirstIn: null, samsLastOut: null, checkInTime: null, checkOutTime: null, lateMinutes: null, devices: [], excuse: null };
const APP = { _id: "app1", reason: "Kasal", reviewedBy: "u-office", fromDate: new Date("2026-10-10"), toDate: new Date("2026-10-14") };
const RESULTS = {
  present: { ...base, outcome: "present", reason: "overlap", samsFirstIn: "09:05", samsLastOut: "13:00", checkInTime: "09:05", checkOutTime: "13:00", lateMinutes: 5, devices: [1] },
  absent: { ...base, outcome: "absent", reason: "no_overlap" },
  excused: { ...base, outcome: "absent", reason: "no_overlap", excuse: APP },
  unmeasured: { ...base, outcome: "unmeasured", reason: "no_facts" },
  pending: { ...base, outcome: "pending", reason: "awaiting_close" },
  void: { ...base, outcome: "void", reason: "session_cancelled" },
};
const row = (status, extra = {}) => ({
  _id: "row-1", session: "s1", resident: "r1", status, ...LESSON, sessionRev: 1, application: null, excuseReason: null,
  samsVerified: status === "present", score: null, ...extra,
});
const presentRow = () =>
  row("present", {
    samsVerified: true, manualVerified: false, checkInTime: "09:05", checkOutTime: "13:00", late: true, lateMinutes: 5,
    excuseApprovedBy: null, fromDate: null, toDate: null, score: 7,
  });
const absentRow = () =>
  row("absent", {
    manualVerified: false, checkInTime: null, checkOutTime: null, late: false, lateMinutes: null,
    excuseApprovedBy: null, fromDate: null, toDate: null,
  });
const args = (result, r) => ({ session: SESSION, entry: ENTRY, result, row: r, rev: REV, now: NOW });
const F = { NOW, REV, LESSON, RESULTS, row, presentRow, absentRow, args };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Attendance, "updateOne").mockImplementation(async (filter, update, opts = {}) =>
    opts.upsert ? { matchedCount: 0, upsertedId: "new-row" } : { matchedCount: 1, upsertedId: null },
  );
  jest.spyOn(Attendance, "exists").mockResolvedValue(null);
  jest.spyOn(Attendance, "findOne").mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "raced-row" }) });
});
afterEach(() => jest.restoreAllMocks());

const setOf = () => Attendance.updateOne.mock.calls[0]?.[1].$set;

describe("none (unmeasured/pending/void) — jonli qator yashiriladi", () => {
  test.each([
    ["qator yo'q", null, false, false],
    ["jonli present", F.row("present"), true, false],
    ["jonli absent", F.row("absent"), true, true],
    ["jonli excused", F.row("excused"), true, false],
    ["o'chirilgan absent", F.row("absent", { deletedAt: F.NOW }), false, false],
  ])("%s", async (_label, row, writes, affectsHours) => {
    const out = await applyResult(F.args(F.RESULTS.unmeasured, row));
    expect(Attendance.updateOne).toHaveBeenCalledTimes(writes ? 1 : 0);
    expect(out).toMatchObject({ changed: writes, affectsHours, stale: false, rowId: null });
    if (writes) {
      expect(setOf()).toEqual({ deletedAt: F.NOW, deletionReason: "session:unmeasured:no_facts", sessionRev: F.REV });
    }
  });
});

describe("present", () => {
  test("qator yo'q — upsert: dalil, vaqtlar, kechikish, freym bahosi", async () => {
    const out = await applyResult(F.args(F.RESULTS.present, null));
    expect(setOf()).toMatchObject({
      ...F.LESSON, status: "present", samsVerified: true, manualVerified: false, checkInTime: "09:05",
      checkOutTime: "13:00", late: true, lateMinutes: 5, score: 7, application: null, excuseReason: null,
    });
    expect(Attendance.updateOne.mock.calls[0][2]).toEqual({ upsert: true, runValidators: true });
    expect(out).toMatchObject({ changed: true, affectsHours: false, rowId: "new-row" });
  });

  test("jonli present — ball TEGILMAYDI (faqat baholash yozadi)", async () => {
    await applyResult(F.args(F.RESULTS.present, F.row("present", { checkInTime: null, score: 9 })));
    expect(setOf()).not.toHaveProperty("score");
  });

  test.each([
    ["jonli absent → soat kamayadi", F.row("absent"), true],
    ["jonli excused → sabab tozalanadi", F.row("excused", { application: "app1", excuseReason: "x" }), false],
    ["o'chirilgan present → tiklanadi", F.row("present", { deletedAt: F.NOW }), false],
  ])("%s", async (_label, row, affectsHours) => {
    const out = await applyResult(F.args(F.RESULTS.present, row));
    expect(setOf()).toMatchObject({ status: "present", score: 7, deletedAt: null, application: null, excuseReason: null });
    expect(out).toMatchObject({ changed: true, affectsHours, rowId: row._id });
  });

  test("hech narsa o'zgarmagan — yozuv yo'q", async () => {
    const out = await applyResult(F.args(F.RESULTS.present, F.presentRow()));
    expect(Attendance.updateOne).not.toHaveBeenCalled();
    expect(out).toMatchObject({ changed: false, rowId: "row-1" });
  });
});

describe("absent — sessiya soati, excused pasaytirilmaydi", () => {
  test("qator yo'q — absent, sessiya soati, ball/kechikish tozalanadi, excused'ga himoya", async () => {
    const out = await applyResult(F.args(F.RESULTS.absent, null));
    expect(setOf()).toMatchObject({ ...F.LESSON, status: "absent", hours: 4, score: null, late: false, lateMinutes: null, samsVerified: false });
    expect(Attendance.updateOne.mock.calls[0][0]).toMatchObject({ status: { $ne: "excused" } });
    expect(out).toMatchObject({ changed: true, affectsHours: true });
  });

  test.each([
    ["jonli present → absent (ball o'chadi)", F.row("present", { score: 8 }), "absent", true],
    ["o'chirilgan absent → tiklanadi", F.row("absent", { deletedAt: F.NOW }), "absent", true],
    ["jonli excused → SAQLANADI", F.row("excused", { hours: 3 }), undefined, false],
    ["o'chirilgan excused → excused holida tiklanadi", F.row("excused", { deletedAt: F.NOW }), undefined, false],
  ])("%s", async (_label, row, status, affectsHours) => {
    const out = await applyResult(F.args(F.RESULTS.absent, row));
    expect(setOf().status).toBe(status);
    if (!status) expect(setOf()).not.toHaveProperty("excuseReason");
    expect(out).toMatchObject({ changed: true, affectsHours });
  });

  test("allaqachon absent — yozuv yo'q", async () => {
    await applyResult(F.args(F.RESULTS.absent, F.absentRow()));
    expect(Attendance.updateOne).not.toHaveBeenCalled();
  });
});

describe("absent + ariza → excused", () => {
  test("qator yo'q — ariza yamog'i (applyApprovedExcuses bilan bir xil)", async () => {
    const out = await applyResult(F.args(F.RESULTS.excused, null));
    expect(setOf()).toMatchObject({
      status: "excused", excuseReason: "Kasal", excuseApprovedBy: "u-office", application: "app1", score: null, samsVerified: false,
    });
    expect(out).toMatchObject({ changed: true, affectsHours: false });
  });

  test("jonli absent → excused — soat kamayadi", async () => {
    expect(await applyResult(F.args(F.RESULTS.excused, F.row("absent")))).toMatchObject({ affectsHours: true });
    expect(setOf().status).toBe("excused");
  });

  test("boshqa asos bilan excused — o'zgarmaydi", async () => {
    await applyResult(F.args(F.RESULTS.excused, F.row("excused", { application: "other", hours: 3 })));
    expect(setOf()).not.toHaveProperty("application");
    expect(setOf()).not.toHaveProperty("status");
  });
});

describe("qulf — D-MODE: faqat absent natija `absent` yozadi", () => {
  const ROWS = [
    null,
    F.row("present"),
    F.absentRow(),
    F.row("excused"),
    F.row("absent", { deletedAt: F.NOW }),
    F.row("excused", { deletedAt: F.NOW }),
    F.row("present", { deletedAt: F.NOW }),
  ];

  test.each(["present", "unmeasured", "pending", "void"])("%s × har qator — hech qachon status: absent", async (key) => {
    for (const r of ROWS) {
      Attendance.updateOne.mockClear();
      await applyResult(F.args(F.RESULTS[key], r));
      for (const [, update] of Attendance.updateOne.mock.calls) expect(update.$set.status).not.toBe("absent");
      if (key !== "present") {
        for (const [, update] of Attendance.updateOne.mock.calls) expect(update.$set).not.toHaveProperty("status");
      }
    }
  });
});

describe("CAS — revizya va o'qilgan holat", () => {
  test("mavjud qator: filtr sessionRev <= rev + o'qilgan status/application", async () => {
    await applyResult(F.args(F.RESULTS.unmeasured, F.row("excused", { application: "app9" })));
    expect(Attendance.updateOne.mock.calls[0][0]).toEqual({
      session: "s1", resident: "r1", status: "excused", application: "app9",
      $or: [{ sessionRev: null }, { sessionRev: { $lte: F.REV } }],
    });
    expect(Attendance.updateOne.mock.calls[0][2]).toEqual({ runValidators: true });
  });

  test("mos kelmadi (yangiroq o'tish yoki orada ariza) — stale, soat ta'siri yo'q", async () => {
    Attendance.updateOne.mockResolvedValue({ matchedCount: 0 });
    const out = await applyResult(F.args(F.RESULTS.present, F.absentRow()));
    expect(out).toMatchObject({ stale: true, changed: false, affectsHours: false });
  });

  test("upsert mavjud qatorni topdi (insert emas) — id o'qiladi", async () => {
    Attendance.updateOne.mockResolvedValue({ matchedCount: 1, upsertedId: null });
    expect(await applyResult(F.args(F.RESULTS.absent, null))).toMatchObject({ changed: true, rowId: "raced-row" });
    expect(Attendance.findOne).toHaveBeenCalledWith({ session: "s1", resident: "r1" }, { _id: 1 }, { includeDeleted: true });
  });
});

describe("copiesFrameScore — freym bahosi qachon qatorga ko'chadi (L3-Q11)", () => {
  test.each([
    ["present, qator yo'q", F.RESULTS.present, null, true],
    ["present, jonli absent", F.RESULTS.present, F.row("absent"), true],
    ["present, jonli excused", F.RESULTS.present, F.row("excused"), true],
    ["present, o'chirilgan present", F.RESULTS.present, F.row("present", { deletedAt: F.NOW }), true],
    ["present, jonli present", F.RESULTS.present, F.row("present"), false],
    ["absent, jonli absent", F.RESULTS.absent, F.row("absent"), false],
    ["excused, qator yo'q", F.RESULTS.excused, null, false],
    ["unmeasured, o'chirilgan present", F.RESULTS.unmeasured, F.row("present", { deletedAt: F.NOW }), false],
  ])("%s → %p", (_label, result, row, copies) => {
    expect(copiesFrameScore(result, row)).toBe(copies);
  });
});

describe("freym bahosini ko'chirish — o'qilgan baho revizyasiga bog'langan (L3-Q11)", () => {
  const filterOf = (i = 0) => Attendance.updateOne.mock.calls[i][0];

  test.each([
    ["jonli absent, baholangan (scoreRev 111)", F.row("absent", { scoreRev: 111 }), 111],
    ["o'chirilgan present, maydonsiz eski qator", F.row("present", { deletedAt: F.NOW }), null],
  ])("%s — filtrda o'qilgan scoreRev", async (_label, row, pinned) => {
    await applyResult(F.args(F.RESULTS.present, row));
    expect(setOf()).toMatchObject({ status: "present", score: 7 });
    expect(filterOf()).toMatchObject({ status: row.status, scoreRev: pinned });
  });

  test("qator yo'q — upsert va E11000 dan keyingi qayta urinish `scoreRev: null` bilan", async () => {
    const dup = Object.assign(new Error("E11000"), { code: 11000, keyPattern: { session: 1, resident: 1 } });
    Attendance.updateOne.mockRejectedValueOnce(dup).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await applyResult(F.args(F.RESULTS.present, null))).toMatchObject({ stale: true });
    expect([filterOf(0).scoreRev, filterOf(1).scoreRev]).toEqual([null, null]);
  });

  test.each([
    ["jonli present (ball ko'chmaydi)", F.RESULTS.present, F.row("present", { scoreRev: 5 })],
    ["absent ga o'tish", F.RESULTS.absent, F.row("present", { score: 8, scoreRev: 5 })],
    ["qator yo'q, absent", F.RESULTS.absent, null],
    ["yashirish", F.RESULTS.unmeasured, F.row("present", { scoreRev: 5 })],
  ])("%s — baho revizyasi filtrda yo'q", async (_label, result, row) => {
    await applyResult(F.args(result, row));
    expect(filterOf()).not.toHaveProperty("scoreRev");
  });
});

describe("E11000", () => {
  const dup = (keyPattern) => Object.assign(new Error("E11000"), { code: 11000, keyPattern });

  test("sessiya indeksi (parallel qo'shish) — bir marta upsert'siz qayta", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup({ session: 1, resident: 1 })).mockResolvedValueOnce({ matchedCount: 1 });
    const out = await applyResult(F.args(F.RESULTS.present, null));
    expect(Attendance.updateOne).toHaveBeenCalledTimes(2);
    expect(Attendance.updateOne.mock.calls[1][2]).toEqual({ runValidators: true });
    expect(out).toMatchObject({ changed: true, rowId: "raced-row" });
  });

  test("qayta urinish ham mos kelmadi — stale", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup({ session: 1, resident: 1 })).mockResolvedValueOnce({ matchedCount: 0 });
    expect(await applyResult(F.args(F.RESULTS.present, null))).toMatchObject({ stale: true, changed: false });
  });

  const LESSON_KEY = { resident: 1, date: 1, science: 1, lessonType: 1 };
  const noRow = () => ({ lean: jest.fn().mockResolvedValue(null) });

  test("P9 dars kaliti, qo'shish, sessiya qatori yo'q — darsni boshqa qator egallagan: log + o'tkazib yuborish", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup(LESSON_KEY)).mockResolvedValueOnce({ matchedCount: 0 });
    Attendance.findOne.mockReturnValue(noRow());
    const out = await applyResult(F.args(F.RESULTS.absent, null));
    expect(out).toMatchObject({ skipped: "lesson_conflict", stale: false, changed: false, affectsHours: false });
    expect(Attendance.updateOne).toHaveBeenCalledTimes(2);
    expect(Attendance.findOne).toHaveBeenCalledWith({ session: "s1", resident: "r1" }, { _id: 1 }, { includeDeleted: true });
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("index=resident,date,science,lessonType"));
  });

  test("P9 dars kaliti, qo'shish, parallel o'tish AYNAN shu sessiya qatorini qo'shgan — stale (L4-Q25)", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup(LESSON_KEY)).mockResolvedValueOnce({ matchedCount: 0 });
    const out = await applyResult(F.args(F.RESULTS.absent, null));
    expect(out).toMatchObject({ stale: true, changed: false, skipped: null });
    expect(winston.error).not.toHaveBeenCalled();
  });

  test("P9 dars kaliti, qo'shish, upsert'siz qayta urinish mos keldi — yozildi", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup(LESSON_KEY)).mockResolvedValueOnce({ matchedCount: 1 });
    expect(await applyResult(F.args(F.RESULTS.absent, null))).toMatchObject({ changed: true, rowId: "raced-row" });
  });

  test("P9 dars kaliti, o'chirilgan qatorni tiklash — log + o'tkazib yuborish (qayta urinish yo'q)", async () => {
    Attendance.updateOne.mockRejectedValueOnce(dup(LESSON_KEY));
    const out = await applyResult(F.args(F.RESULTS.absent, F.row("absent", { deletedAt: F.NOW })));
    expect(out).toMatchObject({ skipped: "lesson_conflict", changed: false, affectsHours: false });
    expect(Attendance.updateOne).toHaveBeenCalledTimes(1);
  });

  test("boshqa xato — yuqoriga", async () => {
    Attendance.updateOne.mockRejectedValueOnce(new Error("network"));
    await expect(applyResult(F.args(F.RESULTS.absent, null))).rejects.toThrow("network");
  });
});

describe("qo'lda yozilgan dars (o'tish davri)", () => {
  test("jonli qo'lda qator bor — proyeksiya o'tkaziladi va ogohlantiriladi", async () => {
    Attendance.exists.mockResolvedValue({ _id: "manual" });
    const out = await applyResult(F.args(F.RESULTS.absent, null));
    expect(Attendance.exists).toHaveBeenCalledWith({
      resident: "r1", date: new Date("2026-10-12T00:00:00.000Z"), science: "sc1", lessonType: "amaliy", session: null,
    });
    expect(Attendance.updateOne).not.toHaveBeenCalled();
    expect(out).toMatchObject({ skipped: "manual_row", changed: false });
    expect(winston.warn).toHaveBeenCalled();
  });

  test("jonli sessiya qatori bor — qo'lda qator tekshirilmaydi", async () => {
    await applyResult(F.args(F.RESULTS.present, F.absentRow()));
    expect(Attendance.exists).not.toHaveBeenCalled();
  });
});
