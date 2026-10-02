"use strict";

jest.mock("#modules/4.05-residency/_services/sessionResolution", () => ({ resolveSession: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({
  ...jest.requireActual("#modules/4.05-residency/_services/residentScope"),
  buildResidentScope: jest.fn(),
}));

const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { resolveSession } = require("#modules/4.05-residency/_services/sessionResolution");
const { buildResidentScope } = require("#modules/4.05-residency/_services/residentScope");
const S = require("./residencySessionGrade.service");

const NOW = new Date("2026-10-15T07:00:00Z");
const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const TEACHER = { _id: "u-teacher", role: { title: "klinik_ustoz" } };
const q = (value) => {
  const c = { select: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};
const entry = (outcome = "present", extra = {}) => ({ _id: "f1", session: "s1", resident: "r1", outcome, outcomeReason: "overlap", ...extra });
const grade = (score, user = OFFICE) => S.gradeEntry({ sessionId: "s1", residentId: "r1", score, user, now: NOW });
const failure = (p) => p.then(() => null, (err) => ({ status: err.statusCode, ...err.meta }));
const ROW_CAS = { $or: [{ scoreRev: null }, { scoreRev: { $lt: NOW.getTime() } }] };
const FRAME_CAS = { $or: [{ scoredAt: null }, { scoredAt: { $lt: NOW } }] };
const CLEAR_ROW_CAS = { $or: [{ scoreRev: null }, { scoreRev: { $lte: NOW.getTime() } }] };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Session, "findById").mockReturnValue(q({ _id: "s1", status: "announced", lessonType: "maruza" }));
  jest.spyOn(Resident, "findById").mockReturnValue(q({ _id: "r1", supervisor: "u-teacher" }));
  jest.spyOn(Roster, "findOne").mockReturnValue(q(entry()));
  jest.spyOn(Roster, "updateOne").mockResolvedValue({ matchedCount: 1 });
  jest.spyOn(Attendance, "updateOne").mockResolvedValue({ matchedCount: 1 });
  jest.spyOn(Attendance, "findOne").mockReturnValue(q(null));
  resolveSession.mockResolvedValue({});
});
afterEach(() => jest.restoreAllMocks());

describe("gradeEntry — kim va qaysi freym", () => {
  test.each([
    ["sessiya yo'q", () => Session.findById.mockReturnValue(q(null)), { status: 404, reason: "session_not_found" }],
    ["sessiya bekor", () => Session.findById.mockReturnValue(q({ status: "cancelled" })), { status: 409, reason: "session_cancelled" }],
    ["rezident yo'q", () => Resident.findById.mockReturnValue(q(null)), { status: 404, reason: "entry_not_found" }],
    ["freym yo'q yoki chiqarilgan", () => Roster.findOne.mockReturnValue(q(null)), { status: 404, reason: "entry_not_found" }],
  ])("%s", async (_label, arrange, expected) => {
    arrange();
    await expect(failure(grade(8))).resolves.toEqual(expected);
    expect(Attendance.updateOne).not.toHaveBeenCalled();
  });

  test("begona ustoz — 404 (doiradan tashqari); o'z ustozi — o'tadi", async () => {
    await expect(failure(grade(8, { _id: "u-other", role: { title: "klinik_ustoz" } }))).resolves.toEqual({ status: 404, reason: "entry_not_found" });
    await expect(grade(8, TEACHER)).resolves.toMatchObject({ score: 8 });
  });

  test("freym faqat jonli (`cancelledAt: null`)", async () => {
    await grade(8);
    expect(Roster.findOne).toHaveBeenCalledWith({ session: "s1", resident: "r1", cancelledAt: null });
  });
});

describe("gradeEntry — TZ 4.5.6: amaliy mashg'ulotga dars bahosi yo'q (L3-Q8)", () => {
  const AMALIY = { status: 409, reason: "lesson_type_not_graded" };

  test.each([8, 0, null])("amaliy sessiya, score=%p — 409, yechim ham, yozuv ham yo'q", async (score) => {
    Session.findById.mockReturnValue(q({ _id: "s1", status: "announced", lessonType: "amaliy" }));
    await expect(failure(grade(score))).resolves.toEqual(AMALIY);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(Attendance.updateOne).not.toHaveBeenCalled();
    expect(Roster.updateOne).not.toHaveBeenCalled();
  });

  test("matn — FE bilan bir xil; sessiya sifatida tekshiriladi: bekor va doiradan OLDIN (L3-Q9)", async () => {
    const chain = q({ _id: "s1", status: "cancelled", lessonType: "amaliy" });
    chain.select = jest.fn(() => chain);
    Session.findById.mockReturnValue(chain);
    Resident.findById.mockReturnValue(q(null));
    const err = await grade(8).catch((e) => e);
    expect(err.message).toBe("Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi");
    expect({ status: err.statusCode, ...err.meta }).toEqual(AMALIY);
    expect(chain.select).toHaveBeenCalledWith(expect.stringMatching(/\blessonType\b/));
    expect(Resident.findById).not.toHaveBeenCalled();
  });

  test.each(["maruza", "test", "oraliq_nazorat", "yakuniy_nazorat"])("%s sessiyasi — avvalgidek baholanadi", async (lessonType) => {
    Session.findById.mockReturnValue(q({ _id: "s1", status: "announced", lessonType }));
    await expect(grade(8)).resolves.toMatchObject({ score: 8 });
  });
});

describe("gradeEntry — TZ:515 darvozasi", () => {
  test("avval yangi yechim (bitta rezident), keyin natija tekshiriladi", async () => {
    await grade(8);
    expect(resolveSession).toHaveBeenCalledWith("s1", { now: NOW, residentIds: ["r1"] });
    expect(resolveSession.mock.invocationCallOrder[0]).toBeLessThan(Attendance.updateOne.mock.invocationCallOrder[0]);
  });

  test.each(["pending", "absent", "unmeasured", "void"])("yangi natija %s — 409 not_confirmed", async (outcome) => {
    Roster.findOne.mockReturnValueOnce(q(entry())).mockReturnValueOnce(q(entry(outcome, { outcomeReason: "no_facts" })));
    await expect(failure(grade(8))).resolves.toEqual({ status: 409, reason: "not_confirmed", outcome, outcomeReason: "no_facts" });
    expect(Attendance.updateOne).not.toHaveBeenCalled();
  });

  test("yechimda freym xatosi — ball qo'yilmaydi (eskirgan natija), oddiy xato (500)", async () => {
    resolveSession.mockResolvedValue({ errors: 1 });
    await expect(grade(8)).rejects.toThrow("sessiya yechimi yiqildi session=s1 resident=r1");
    expect(Roster.findOne).toHaveBeenCalledTimes(1);
    expect(Attendance.updateOne).not.toHaveBeenCalled();
  });

  test("yechimdan keyin freym yo'qoldi (chiqarildi) — 404", async () => {
    Roster.findOne.mockReturnValueOnce(q(entry())).mockReturnValueOnce(q(null));
    await expect(failure(grade(8))).resolves.toEqual({ status: 404, reason: "entry_not_found" });
  });

  test("score:null — darvozasiz tozalash, yechim chaqirilmaydi", async () => {
    Roster.findOne.mockReturnValue(q(entry("absent")));
    const out = await grade(null);
    expect(resolveSession).not.toHaveBeenCalled();
    expect(Roster.updateOne).toHaveBeenCalledWith(
      { _id: "f1", ...FRAME_CAS }, { $set: { score: null, scoredBy: "u-office", scoredAt: NOW } },
    );
    expect(Attendance.updateOne).toHaveBeenCalledWith(
      { session: "s1", resident: "r1", ...CLEAR_ROW_CAS }, { $set: { score: null, scoreRev: NOW.getTime() } },
    );
    expect(out).toEqual({ message: "Ball olib tashlandi", outcome: "absent", score: null });
  });
});

describe("tozalash — freym AVVAL, qator KEYIN (L3-Q10, L3-Q12)", () => {
  test("tartib: freym CAS'i qator yozuvidan oldin", async () => {
    await grade(null);
    expect(Roster.updateOne.mock.invocationCallOrder[0]).toBeLessThan(Attendance.updateOne.mock.invocationCallOrder[0]);
  });

  test("freymga yangiroq baho yozilgan — 409 state_changed, qatorga tegilmaydi", async () => {
    Roster.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(failure(grade(null))).resolves.toEqual({ status: 409, reason: "state_changed" });
    expect(Attendance.updateOne).not.toHaveBeenCalled();
  });

  test("qator yo'q — 200 (yangiroq revizya o'chirilgan qatorlarda ham qidiriladi)", async () => {
    Attendance.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(grade(null)).resolves.toMatchObject({ score: null });
    expect(Attendance.findOne).toHaveBeenCalledWith(
      { session: "s1", resident: "r1", scoreRev: { $gt: NOW.getTime() } }, { _id: 1 }, { includeDeleted: true },
    );
  });

  test("qatorda yangiroq baho/tozalash — tozalash yutqazgan: 409 state_changed", async () => {
    Attendance.updateOne.mockResolvedValue({ matchedCount: 0 });
    Attendance.findOne.mockReturnValue(q({ _id: "row1" }));
    await expect(failure(grade(null))).resolves.toEqual({ status: 409, reason: "state_changed" });
  });

  test("qator yangilandi — yangiroq revizya qidirilmaydi", async () => {
    await grade(null);
    expect(Attendance.findOne).not.toHaveBeenCalled();
  });
});

describe("gradeEntry — yozuv tartibi va poyga", () => {
  test("qator AVVAL (`present`, o'chirilmagan), freym KEYIN (`present`, jonli)", async () => {
    const out = await grade(8);
    expect(Attendance.updateOne).toHaveBeenCalledWith(
      { session: "s1", resident: "r1", status: "present", deletedAt: null, ...ROW_CAS },
      { $set: { score: 8, scoreRev: NOW.getTime() } },
      { runValidators: true },
    );
    expect(Roster.updateOne).toHaveBeenCalledWith(
      { _id: "f1", outcome: "present", cancelledAt: null, ...FRAME_CAS },
      { $set: { score: 8, scoredBy: "u-office", scoredAt: NOW } },
      { runValidators: true },
    );
    expect(Attendance.updateOne.mock.invocationCallOrder[0]).toBeLessThan(Roster.updateOne.mock.invocationCallOrder[0]);
    expect(out).toEqual({ message: "Ball qo'yildi", outcome: "present", score: 8 });
  });

  test("qator endi present emas yoki yangiroq baho yozilgan — 409 state_changed, freymga yozilmaydi", async () => {
    Attendance.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(failure(grade(8))).resolves.toEqual({ status: 409, reason: "state_changed" });
    expect(Roster.updateOne).not.toHaveBeenCalled();
  });

  test("freym endi present emas yoki yangiroq baho yozilgan — 409 state_changed", async () => {
    Roster.updateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(failure(grade(0))).resolves.toEqual({ status: 409, reason: "state_changed" });
  });
});

describe("attendanceContext (D-GRADE)", () => {
  const frames = (list) => jest.spyOn(Roster, "find").mockReturnValue(q(list));
  const f = (outcome, day, session = `s-${outcome}-${day}`) => ({ outcome, day, session });

  beforeEach(() => {
    buildResidentScope.mockResolvedValue({ denied: false, filter: {} });
    Resident.findById.mockReturnValue(q({ _id: "r1", status: "oquvda", totalUnexcusedHours: 8, warningIssued: true, expulsionOrderCreated: false }));
    jest.spyOn(Attendance, "countDocuments").mockResolvedValue(1);
  });

  test("doiradan tashqari — 403; rezident yo'q — 404", async () => {
    buildResidentScope.mockResolvedValueOnce({ denied: true });
    await expect(failure(S.attendanceContext("r1", TEACHER, NOW))).resolves.toEqual({ status: 403, reason: "resident_out_of_scope" });
    Resident.findById.mockReturnValue(q(null));
    await expect(failure(S.attendanceContext("r1", OFFICE, NOW))).resolves.toEqual({ status: 404, reason: "resident_not_found" });
  });

  test("sonlar: excused qatordan, o'tgan kun pending → unmeasured, qamrov", async () => {
    const spy = frames([
      f("present", "2026-10-01"), f("present", "2026-10-02"), f("absent", "2026-10-03", "s3"), f("absent", "2026-10-04", "s4"),
      f("unmeasured", "2026-10-05"), f("pending", "2026-10-14"), f("pending", "2026-10-15"),
    ]);
    const out = await S.attendanceContext("r1", OFFICE, NOW);
    expect(spy).toHaveBeenCalledWith({
      resident: "r1", day: { $gte: "2026-09-01", $lte: "2027-08-31" }, cancelledAt: null, outcome: { $ne: "void" },
    });
    expect(Attendance.countDocuments).toHaveBeenCalledWith({ resident: "r1", session: { $in: ["s3", "s4"] }, status: "excused" });
    expect(out).toEqual({
      resident: { _id: "r1", status: "oquvda", totalUnexcusedHours: 8, warningIssued: true, expulsionOrderCreated: false },
      academicYear: "2026/2027",
      sessions: { total: 7, present: 2, absent: 1, excused: 1, unmeasured: 2, pending: 1 },
      coverage: { measured: 4, ratio: 4 / 6 },
    });
  });

  test("hammasi kutilmoqda — ratio null; absent yo'q — qator sanalmaydi", async () => {
    frames([f("pending", "2026-10-15")]);
    const out = await S.attendanceContext("r1", OFFICE, NOW);
    expect(out.coverage).toEqual({ measured: 0, ratio: null });
    expect(Attendance.countDocuments).not.toHaveBeenCalled();
  });
});
