"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("./expulsionCheck", () => ({ runExpulsionCheck: jest.fn() }));
jest.mock("./sessionProjection", () => ({ applyResult: jest.fn(), copiesFrameScore: jest.fn() }));
jest.mock("./sessionRosterSync", () => ({ syncSessionRoster: jest.fn() }));
jest.mock("./samsFactsPort", () => ({ loadSessionFacts: jest.fn(async () => ({ presence: new Map(), outages: [] })) }));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn().mockResolvedValue({ workDayFrom: "09:00", workDayTo: "14:00" }),
}));

const winston = require("#shared/winston.logger");
const { runExpulsionCheck } = require("./expulsionCheck");
const { applyResult, copiesFrameScore } = require("./sessionProjection");
const { syncSessionRoster } = require("./sessionRosterSync");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const { resolveSession, resolveSessionDays } = require("./sessionResolution");

const DAY = "2026-10-12";
const uz = (hhmm, day = DAY) => new Date(`${day}T${hhmm}:00.000+05:00`);
const AFTER = uz("08:00", "2026-10-13");
const REV = AFTER.getTime();
const SESSION = {
  _id: "s1", day: DAY, status: "announced", hours: 4, science: "sc1", lessonType: "amaliy", group: "g1",
  announcedBy: "u1", rosterScope: "group", rosterFrozenAt: null,
};
const chain = (value) => {
  const c = { select: () => c, sort: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};
const frame = (resident, extra = {}) => ({
  _id: `f-${resident}`, session: "s1", resident, outcome: "pending", outcomeReason: null, cancelledAt: null,
  resolvedRev: null, resolverVersion: null, attendance: null, score: null, ...extra,
});
const presentFacts = () => ({
  measured: true, reason: null, dbname: "c", packetAt: AFTER, records: [{ accessTime: "09:05", exitTime: "13:00", inDevice: 1, outDevice: 1 }],
});
let current = [];
const M = {
  DAY, uz, AFTER, D: new Date(`${DAY}T00:00:00.000Z`), chain, frame, presentFacts, Session, Roster, Resident, Attendance, ResidentApplication,
  session: (extra = {}) => Session.findById.mockImplementation(() => chain({ ...SESSION, ...extra })),
  frames: (list) => {
    current = list;
    Roster.find.mockImplementation((filter) =>
      chain(filter.resident ? list.filter((f) => filter.resident.$in.includes(f.resident)) : list),
    );
  },
  casSet: (i) => Roster.findOneAndUpdate.mock.calls[i][1].$set,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Session, "findById").mockImplementation(() => chain({ ...SESSION }));
  jest.spyOn(Session, "exists").mockResolvedValue(null);
  jest.spyOn(Session, "find").mockReturnValue(chain([{ _id: "s1" }]));
  jest.spyOn(Roster, "find").mockReturnValue(chain([]));
  M.frames([frame("r1"), frame("r2")]);
  jest.spyOn(Roster, "findOneAndUpdate").mockImplementation((filter, update) =>
    chain({ ...current.find((f) => f._id === filter._id), ...update.$set }),
  );
  jest.spyOn(Roster, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  jest.spyOn(Roster, "findById").mockReturnValue(chain({ resolvedRev: null }));
  jest.spyOn(Resident, "find").mockReturnValue(chain([{ _id: "r1" }, { _id: "r2" }]));
  jest.spyOn(Attendance, "findOne").mockReturnValue(chain(null));
  jest.spyOn(ResidentApplication, "find").mockReturnValue(chain([]));
  applyResult.mockResolvedValue({ changed: false, stale: false, rowId: null });
  copiesFrameScore.mockReturnValue(false);
  runExpulsionCheck.mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("oyna (7 UZ kun) va force", () => {
  test.each([
    ["8 kun oldin — muzlatilgan", "2026-10-12", {}, "window"],
    ["aynan 7 kun oldin — yechiladi", "2026-10-13", {}, null],
    ["8 kun, force — yechiladi", "2026-10-12", { force: true }, null],
  ])("%s", async (_label, day, extra, skipped) => {
    M.session({ day });
    const out = await resolveSession("s1", { now: M.uz("10:00", "2026-10-20"), ...extra });
    expect(out.skipped).toBe(skipped);
    expect(M.Roster.find).toHaveBeenCalledTimes(skipped ? 0 : 1);
  });

  test("sessiya yo'q — not_found", async () => {
    M.Session.findById.mockReturnValue(M.chain(null));
    expect((await resolveSession("s1", { now: M.AFTER })).skipped).toBe("not_found");
  });
});

describe("bekor qilingan sessiya — hammasi void, faktsiz", () => {
  test("port, arizalar va sync chaqirilmaydi; eski kun ham yechiladi", async () => {
    M.session({ status: "cancelled", day: "2026-09-01" });
    const port = { loadSessionFacts: jest.fn() };
    await resolveSession("s1", { now: M.AFTER, factsPort: port });
    expect(port.loadSessionFacts).not.toHaveBeenCalled();
    expect(M.ResidentApplication.find).not.toHaveBeenCalled();
    expect(syncSessionRoster).not.toHaveBeenCalled();
    expect(M.casSet(0)).toMatchObject({ outcome: "void", outcomeReason: "session_cancelled", resolverVersion: 1 });
  });

  test("allaqachon void (o'sha sabab, o'sha versiya) — CAS yo'q, qator baribir yashiriladi", async () => {
    M.session({ status: "cancelled" });
    M.frames([M.frame("r1", { outcome: "void", outcomeReason: "session_cancelled", resolverVersion: 1 })]);
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.findOneAndUpdate).not.toHaveBeenCalled();
    expect(applyResult).toHaveBeenCalledWith(expect.objectContaining({ result: expect.objectContaining({ outcome: "void" }) }));
  });
});

describe("freym CAS", () => {
  test("filtr — resolvedRev <= rev va yuklangan cancelledAt (L4-Q29); $set — natija maydonlari", async () => {
    await resolveSession("s1", { now: M.AFTER });
    const [filter, , opts] = M.Roster.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({
      _id: "f-r1", cancelledAt: null, $or: [{ resolvedRev: null }, { resolvedRev: { $lte: M.AFTER.getTime() } }],
    });
    expect(opts).toEqual({ new: true, runValidators: true });
    expect(M.casSet(0)).toEqual({
      outcome: "unmeasured", outcomeReason: "no_facts", samsFirstIn: null, samsLastOut: null, lateMinutes: null,
      devices: [], excuseApplication: null, resolvedAt: M.AFTER, resolvedRev: M.AFTER.getTime(), resolverVersion: 1,
    });
  });

  test("stale (yangiroq o'tish yozgan) — qatorga tegilmaydi", async () => {
    M.Roster.findOneAndUpdate.mockReturnValue(M.chain(null));
    const out = await resolveSession("s1", { now: M.AFTER });
    expect(applyResult).not.toHaveBeenCalled();
    expect(M.Attendance.findOne).not.toHaveBeenCalled();
    expect(out).toMatchObject({ stale: 2, changed: 0 });
  });

  test("qator freym CAS'idan KEYIN o'qiladi, proyeksiyaga shu qator boradi (L4-Q27)", async () => {
    M.frames([M.frame("r1")]);
    const row = { _id: "row1", resident: "r1", status: "absent" };
    M.Attendance.findOne.mockReturnValue(M.chain(row));
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Attendance.findOne).toHaveBeenCalledWith({ session: "s1", resident: "r1" }, null, { includeDeleted: true });
    expect(M.Roster.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(M.Attendance.findOne.mock.invocationCallOrder[0]);
    expect(applyResult.mock.calls[0][0].row).toBe(row);
  });

  test("sync — faqat bekor qilinmaganda, sozlama oynasi bilan, freymlar yuklanishidan OLDIN", async () => {
    await resolveSession("s1", { now: M.AFTER });
    expect(syncSessionRoster).toHaveBeenCalledWith(expect.objectContaining({ _id: "s1" }), {
      now: M.AFTER, window: { from: "09:00", to: "14:00" },
    });
    expect(syncSessionRoster.mock.invocationCallOrder[0]).toBeLessThan(M.Roster.find.mock.invocationCallOrder[0]);
  });
});

describe("ko'chiriladigan freym bahosi — qator o'qilgandan KEYIN (L3-Q11)", () => {
  const row = { _id: "row1", resident: "r1", status: "absent" };
  beforeEach(() => {
    M.frames([M.frame("r1", { score: 8 })]);
    M.Attendance.findOne.mockReturnValue(M.chain(row));
  });

  test("qator present ga kiradi — freym bahosi qayta o'qiladi, proyeksiyaga yangisi boradi", async () => {
    copiesFrameScore.mockReturnValue(true);
    M.Roster.findById.mockReturnValueOnce(M.chain({ score: null }));
    await resolveSession("s1", { now: M.AFTER });
    expect(copiesFrameScore).toHaveBeenCalledWith(expect.objectContaining({ outcome: "unmeasured" }), row);
    expect(M.Roster.findById).toHaveBeenCalledWith("f-r1");
    expect(M.Attendance.findOne.mock.invocationCallOrder[0]).toBeLessThan(M.Roster.findById.mock.invocationCallOrder[0]);
    expect(applyResult.mock.calls[0][0].entry).toMatchObject({ _id: "f-r1", score: null });
  });

  test("ko'chirish yo'q — freym qayta o'qilmaydi, CAS natijasi boradi", async () => {
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.findById).not.toHaveBeenCalled();
    expect(applyResult.mock.calls[0][0].entry).toMatchObject({ _id: "f-r1", score: 8 });
  });
});

describe("yuklash — tirik rezidentlar, DI port, arizalar", () => {
  test("o'chirilgan rezident (Resident.find qaytarmaydi) — freymiga tegilmaydi", async () => {
    M.Resident.find.mockReturnValue(M.chain([{ _id: "r1" }]));
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(M.Roster.findOneAndUpdate.mock.calls[0][0]._id).toBe("f-r1");
  });

  test("factsPort DI — kun va tirik id'lar bilan; fakt resolverga yetadi", async () => {
    const port = { loadSessionFacts: jest.fn().mockResolvedValue({ presence: new Map([["r1", M.presentFacts()]]), outages: [] }) };
    await resolveSession("s1", { now: M.AFTER, factsPort: port });
    expect(port.loadSessionFacts).toHaveBeenCalledWith({ day: M.DAY, residentIds: ["r1", "r2"] });
    expect(M.casSet(0)).toMatchObject({ outcome: "present", samsFirstIn: "09:05", devices: [1] });
    expect(M.casSet(1)).toMatchObject({ outcome: "unmeasured" });
  });

  test("arizalar — tasdiqlangan so'rov, rezident bo'yicha; residentIds filtri", async () => {
    M.ResidentApplication.find.mockReturnValue(M.chain([{ _id: "a1", resident: "r2", fromDate: M.D, toDate: M.D }]));
    await resolveSession("s1", { now: M.AFTER, residentIds: ["r2"] });
    expect(M.Roster.find).toHaveBeenCalledWith({ session: "s1", resident: { $in: ["r2"] } });
    expect(M.ResidentApplication.find.mock.calls[0][0]).toMatchObject({ status: "tasdiqlangan" });
    expect(M.Attendance.findOne).toHaveBeenCalledWith({ session: "s1", resident: "r2" }, null, { includeDeleted: true });
  });
});

describe("eski chiqarilgan freymlar", () => {
  test("jonli + eski chiqarilgan — ikkalasi CAS, qator faqat jonli bo'yicha", async () => {
    M.frames([M.frame("r1"), M.frame("r1", { _id: "old", cancelledAt: M.uz("08:00") })]);
    await resolveSession("s1", { now: M.AFTER });
    const sets = M.Roster.findOneAndUpdate.mock.calls.map(([f, u]) => [f._id, u.$set.outcome, u.$set.outcomeReason]);
    expect(sets).toEqual([["f-r1", "unmeasured", "no_facts"], ["old", "void", "withdrawn"]]);
    expect(applyResult).toHaveBeenCalledTimes(1);
    expect(applyResult.mock.calls[0][0].entry._id).toBe("f-r1");
  });

  test("eski freym allaqachon void — o'tkaziladi", async () => {
    M.frames([M.frame("r1"), M.frame("r1", { _id: "old", cancelledAt: M.uz("08:00"), outcome: "void" })]);
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("qatorga havola va qayta hisob", () => {
  test("proyeksiya id'si freymga (o'z revizyasi bilan); bir xil bo'lsa yozilmaydi", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "row9" }).mockResolvedValueOnce({ changed: false, rowId: null });
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.updateOne).toHaveBeenCalledTimes(1);
    expect(M.Roster.updateOne).toHaveBeenCalledWith({ _id: "f-r1", resolvedRev: M.AFTER.getTime() }, { $set: { attendance: "row9" } });
  });

  test("stale proyeksiya — havola o'zgarmaydi", async () => {
    applyResult.mockResolvedValue({ stale: true, rowId: "x" });
    await resolveSession("s1", { now: M.AFTER });
    expect(M.Roster.updateOne).not.toHaveBeenCalled();
  });

  test("soati o'zgargan rezident — BIR marta, `sams` manbai bilan", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, affectsHours: true, rowId: "a" }).mockResolvedValueOnce({ changed: true, rowId: "b" });
    const out = await resolveSession("s1", { now: M.AFTER });
    expect(runExpulsionCheck).toHaveBeenCalledTimes(1);
    expect(runExpulsionCheck).toHaveBeenCalledWith("r1", { source: "sams", now: M.AFTER });
    expect(out).toMatchObject({ recounted: 1, affected: ["r1"], changed: 2 });
  });

  test("qayta hisob yiqilsa — loglanadi, keyingisi davom etadi", async () => {
    applyResult.mockResolvedValue({ changed: true, affectsHours: true, rowId: "a" });
    runExpulsionCheck.mockRejectedValueOnce(new Error("boom"));
    const out = await resolveSession("s1", { now: M.AFTER });
    expect(runExpulsionCheck).toHaveBeenCalledTimes(2);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("resident=r1: boom"));
    expect(out.recounted).toBe(1);
  });

  test("recount:false — chaqiruvchi o'zi hisoblaydi (`affected` qaytadi)", async () => {
    applyResult.mockResolvedValue({ changed: true, affectsHours: true, rowId: "a" });
    const out = await resolveSession("s1", { now: M.AFTER, recount: false });
    expect(runExpulsionCheck).not.toHaveBeenCalled();
    expect(out.affected).toEqual(["r1", "r2"]);
  });
});

describe("yozuvdan keyin qayta tekshiruv — tuzatish o'tishi", () => {
  test("freymni yangiroq o'tish olgan — shu rezident uchun force bilan yana yechiladi", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV + 5 }));
    const out = await resolveSession("s1", { now: AFTER });
    expect(Session.findById).toHaveBeenCalledTimes(2);
    expect(Roster.find).toHaveBeenLastCalledWith({ session: "s1", resident: { $in: ["r1"] } });
    expect(M.casSet(2).resolvedRev).toBe(REV + 6);
    expect(out.repaired).toBe(1);
  });

  test("sessiya shu orada bekor qilindi — hamma rezident void tuzatish o'tishi", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "a" });
    Session.exists.mockResolvedValue({ _id: "s1" });
    Session.findById.mockImplementationOnce(() => chain({ ...SESSION })).mockImplementationOnce(() => chain({ ...SESSION, status: "cancelled" }));
    await resolveSession("s1", { now: AFTER });
    expect(Session.exists).toHaveBeenCalledWith({ _id: "s1", status: "cancelled" });
    expect(Roster.find).toHaveBeenLastCalledWith({ session: "s1" });
    expect(M.casSet(2)).toMatchObject({ outcome: "void", outcomeReason: "session_cancelled" });
  });

  test("qator yozilmagan o'tish ham tekshiradi: bekor bo'lsa void tuzatish (CAS'ni yutgan present)", async () => {
    Session.exists.mockResolvedValue({ _id: "s1" });
    Session.findById.mockImplementationOnce(() => chain({ ...SESSION })).mockImplementationOnce(() => chain({ ...SESSION, status: "cancelled" }));
    await resolveSession("s1", { now: AFTER });
    expect(applyResult.mock.results.every((r) => r.type === "return")).toBe(true);
    expect(Session.findById).toHaveBeenCalledTimes(2);
    expect(M.casSet(2)).toMatchObject({ outcome: "void" });
  });

  test("bekor qilinmagan — bitta tekshiruv, tuzatish yo'q; freym yo'q — tekshiruv ham yo'q", async () => {
    await resolveSession("s1", { now: AFTER });
    expect(Session.exists).toHaveBeenCalledTimes(1);
    expect(Session.findById).toHaveBeenCalledTimes(1);
    M.frames([]);
    Session.exists.mockClear();
    await resolveSession("s1", { now: AFTER });
    expect(Session.exists).not.toHaveBeenCalled();
  });
});

describe("tuzatish zanjiri (L4-Q28)", () => {
  test("tuzatish o'tishi ham tuzatadi — zanjir 3 bosqich bilan cheklangan, chegarada warn (L4-Q28)", async () => {
    M.frames([frame("r1")]);
    applyResult.mockResolvedValue({ changed: true, rowId: "a" });
    let newer = REV;
    Roster.findById.mockImplementation(() => chain({ resolvedRev: (newer += 1000) }));
    const out = await resolveSession("s1", { now: AFTER });
    expect(Session.findById).toHaveBeenCalledTimes(4);
    expect(out.repaired).toBe(3);
    expect(winston.warn).toHaveBeenCalledTimes(1);
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("tuzatish chegarasi (3)"));
    expect(winston.warn).toHaveBeenCalledWith(expect.stringContaining("session=s1 cancelled=false residents=r1"));
  });

  test("tuzatish o'tishi sessiya bekor qilinganini ham tekshiradi (void o'qishidan keyin tushgan qator)", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "a" });
    Session.exists.mockResolvedValue({ _id: "s1" });
    Session.findById.mockImplementationOnce(() => chain({ ...SESSION })).mockImplementationOnce(() => chain({ ...SESSION, status: "cancelled" }));
    await resolveSession("s1", { now: AFTER, depth: 1 });
    expect(Session.findById).toHaveBeenCalledTimes(2);
    expect(M.casSet(2)).toMatchObject({ outcome: "void", outcomeReason: "session_cancelled" });
  });
});

describe("stale qator yozuvi — freym egasi javobgar", () => {
  test("freym hali shu o'tishniki (o'qilgan holat orada o'zgardi) — yangi snapshot bilan tuzatish", async () => {
    applyResult.mockResolvedValueOnce({ stale: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV }));
    const out = await resolveSession("s1", { now: AFTER });
    expect(Roster.findById).toHaveBeenCalledWith("f-r1");
    expect(Session.findById).toHaveBeenCalledTimes(2);
    expect(Roster.find).toHaveBeenLastCalledWith({ session: "s1", resident: { $in: ["r1"] } });
    expect(Attendance.findOne).toHaveBeenCalledTimes(3);
    expect(M.casSet(2).resolvedRev).toBe(REV + 1);
    expect(out).toMatchObject({ stale: 1, repaired: 1 });
  });

  test("freymni yangiroq o'tish olgan — tuzatish yo'q (u o'tish qatorni o'zi hal qiladi)", async () => {
    applyResult.mockResolvedValueOnce({ stale: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV + 5 }));
    const out = await resolveSession("s1", { now: AFTER });
    expect(Session.findById).toHaveBeenCalledTimes(1);
    expect(out.repaired).toBe(0);
  });

  test("qator yozildi, freym hali shu o'tishniki (resolvedRev === rev) — tuzatish yo'q", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV }));
    const out = await resolveSession("s1", { now: AFTER });
    expect(Roster.findById).toHaveBeenCalledWith("f-r1");
    expect(Session.findById).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ changed: 1, repaired: 0 });
  });

  test("o'zgarmagan qator — freym qayta o'qilmaydi", async () => {
    await resolveSession("s1", { now: AFTER });
    expect(Roster.findById).not.toHaveBeenCalled();
  });
});

describe("xato izolyatsiyasi — yozilgan qatorlar qayta hisobi yo'qolmaydi", () => {
  const failSecondCas = () => {
    const original = Roster.findOneAndUpdate.getMockImplementation();
    let calls = 0;
    Roster.findOneAndUpdate.mockImplementation((...args) => {
      calls += 1;
      if (calls === 2) throw new Error("transient");
      return original(...args);
    });
  };

  test("2-freym CAS'i yiqildi — 1-rezident baribir qayta hisoblanadi, xato loglanadi va sanaladi", async () => {
    applyResult.mockResolvedValue({ changed: true, affectsHours: true, rowId: "a" });
    failSecondCas();
    const out = await resolveSession("s1", { now: AFTER });
    expect(runExpulsionCheck.mock.calls.map(([id]) => id)).toEqual(["r1", "r2"]);
    expect(out).toMatchObject({ errors: 1, changed: 1, recounted: 2, affected: ["r1", "r2"] });
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("session=s1 resident=r2: transient"));
  });

  test("qator yozilgach havola yiqildi — o'sha rezident ham qayta hisoblanadi (L4-Q26)", async () => {
    M.frames([frame("r1")]);
    applyResult.mockResolvedValueOnce({ changed: true, affectsHours: true, rowId: "a" });
    Roster.updateOne.mockRejectedValueOnce(new Error("transient"));
    const out = await resolveSession("s1", { now: AFTER });
    expect(runExpulsionCheck).toHaveBeenCalledWith("r1", { source: "sams", now: AFTER });
    expect(out).toMatchObject({ errors: 1, changed: 0, recounted: 1, affected: ["r1"] });
  });

  test("tuzatish o'tishi yiqildi — asosiy o'tish qayta hisobi saqlanadi", async () => {
    applyResult.mockResolvedValueOnce({ changed: true, affectsHours: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV + 5 }));
    Session.findById.mockImplementationOnce(() => chain({ ...SESSION })).mockImplementationOnce(() => {
      throw new Error("db down");
    });
    const out = await resolveSession("s1", { now: AFTER });
    expect(runExpulsionCheck).toHaveBeenCalledWith("r1", { source: "sams", now: AFTER });
    expect(out).toMatchObject({ errors: 1, repaired: 0, recounted: 1 });
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("tuzatish o'tishi yiqildi session=s1: db down"));
  });

  test("tuzatish o'tishidagi freym xatosi ham tashqi `errors` da (baho uni ko'rishi shart)", async () => {
    M.frames([frame("r1")]);
    applyResult.mockResolvedValueOnce({ changed: true, rowId: "a" });
    Roster.findById.mockReturnValueOnce(chain({ resolvedRev: REV + 5 }));
    failSecondCas();
    expect(await resolveSession("s1", { now: AFTER })).toMatchObject({ errors: 1, repaired: 1 });
  });

  test("resolveSessionDays — freym xatolari ham `errors` ga qo'shiladi, sessiya sanaladi", async () => {
    failSecondCas();
    expect(await resolveSessionDays([DAY], { now: AFTER })).toMatchObject({ errors: 1, sessions: 1, entries: 2 });
  });
});

describe("resolveSessionDays", () => {
  test("kunlar takrorsiz va tartibli; force uzatiladi", async () => {
    await resolveSessionDays(["2026-10-13", DAY, "2026-10-13"], { now: uz("10:00", "2026-10-30"), force: true });
    expect(Session.find.mock.calls.map(([f]) => f)).toEqual([{ day: DAY }, { day: "2026-10-13" }]);
    expect(Roster.findOneAndUpdate).toHaveBeenCalled();
  });

  test("bitta sessiya yiqilsa — loglanadi, qolganlari yechiladi", async () => {
    Session.find.mockReturnValue(chain([{ _id: "bad" }, { _id: "s1" }]));
    Session.findById.mockImplementation((id) => {
      if (id === "bad") throw new Error("db");
      return chain({ ...SESSION });
    });
    const out = await resolveSessionDays([DAY], { now: AFTER });
    expect(out).toMatchObject({ errors: 1, sessions: 1, entries: 2 });
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("session=bad: db"));
  });

  test("qayta hisob oxirida — rezident bir necha sessiyada bo'lsa ham BIR marta", async () => {
    Session.find.mockReturnValue(chain([{ _id: "s1" }, { _id: "s2" }]));
    applyResult.mockResolvedValue({ changed: true, affectsHours: true, rowId: "a" });
    const out = await resolveSessionDays([DAY], { now: AFTER });
    expect(runExpulsionCheck.mock.calls).toEqual([["r1", { source: "sams", now: AFTER }], ["r2", { source: "sams", now: AFTER }]]);
    expect(out.recounted).toBe(2);
  });
});
