"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/sessionRoster", () => ({
  previewRoster: jest.fn(),
  fanOut: jest.fn(),
  cancelFrames: jest.fn(),
  studyCutFilter: jest.fn(() => ({ cut: true })),
}));
jest.mock("#modules/4.05-residency/_services/residentScope", () => ({ residentIdsFor: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/sessionResolution", () => ({ resolveSession: jest.fn() }));

const Session = require("./residencySession.model");
const Group = require("#references/group/group.model");
const Science = require("#references/science/science.model");
const { previewRoster, fanOut, cancelFrames } = require("#modules/4.05-residency/_services/sessionRoster");
const { resolveSession } = require("#modules/4.05-residency/_services/sessionResolution");
const winston = require("#shared/winston.logger");
const S = require("./residencySession.service");

const NOW = new Date("2026-09-27T10:00:00Z");
const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const TEACHER = { _id: "u-teacher", role: { title: "klinik_ustoz" } };
const INPUT = { day: "2026-09-28", group: "g1", science: "sc1", lessonType: "amaliy", hours: 2 };
const q = (value) => {
  const chain = { select: () => chain, populate: () => chain, sort: () => chain, lean: jest.fn().mockResolvedValue(value) };
  return chain;
};
const sessionDoc = (extra = {}) => ({
  _id: "s1", ...INPUT, groupTitle: "G-1", scienceTitle: "Terapiya", announcedBy: "u-teacher",
  rosterScope: "supervised", status: "announced", ...extra,
});
const reasonOf = (promise) => promise.then(() => null, (err) => ({ status: err.statusCode, ...err.meta }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Group, "findById").mockReturnValue(q({ _id: "g1", title: "G-1", active: true }));
  jest.spyOn(Science, "findById").mockReturnValue(q({ _id: "sc1", title: "Terapiya" }));
  jest.spyOn(Session, "findOne").mockReturnValue(q(null));
  jest.spyOn(Session, "create").mockImplementation(async (d) => ({ toObject: () => ({ _id: "s1", ...d }) }));
  jest.spyOn(Session, "findById").mockImplementation(() => q(sessionDoc()));
  jest.spyOn(Session, "findOneAndUpdate").mockReturnValue(q(sessionDoc({ status: "cancelled" })));
  previewRoster.mockResolvedValue({ eligible: ["r1", "r2"], taken: [] });
  fanOut.mockResolvedValue({ framed: 2, conflicts: [] });
  cancelFrames.mockResolvedValue(2);
});
afterEach(() => jest.restoreAllMocks());

describe("announcerKind — faqat bo'lim va klinik ustoz", () => {
  test.each([
    ["magistratura_bolim", "office"],
    ["klinik_ustoz", "teacher"],
    ["super_admin", null],
    ["admin", null],
    ["ilmiy_rahbar", null],
    ["kafedra_mudiri", null],
    ["rezident", null],
  ])("%s → %p", (title, kind) => {
    expect(S.announcerKind({ role: { title } })).toBe(kind);
  });
});

describe("announce — rad etish shoxlari", () => {
  test("begona rol — 403, baza chaqirilmaydi", async () => {
    await expect(reasonOf(S.announce(INPUT, { _id: "a", role: { title: "super_admin" } }, { now: NOW }))).resolves.toEqual({
      status: 403,
      reason: "not_session_announcer",
    });
    expect(Group.findById).not.toHaveBeenCalled();
  });

  test("kecha / keyingi o'quv yili — 400 day_not_announceable {from,to}", async () => {
    const expected = { status: 400, reason: "day_not_announceable", from: "2026-09-27", to: "2027-08-31" };
    await expect(reasonOf(S.announce({ ...INPUT, day: "2026-09-26" }, OFFICE, { now: NOW }))).resolves.toEqual(expected);
    await expect(reasonOf(S.announce({ ...INPUT, day: "2027-09-01" }, OFFICE, { now: NOW }))).resolves.toEqual(expected);
    expect(Group.findById).not.toHaveBeenCalled();
  });

  test.each([
    ["guruh yo'q", () => Group.findById.mockReturnValue(q(null)), "group_not_found"],
    ["guruh nofaol", () => Group.findById.mockReturnValue(q({ _id: "g1", active: false })), "group_not_found"],
    ["fan yo'q", () => Science.findById.mockReturnValue(q(null)), "science_not_found"],
    ["fan nofaol", () => Science.findById.mockReturnValue(q({ _id: "sc1", active: false })), "science_not_found"],
  ])("%s — 400", async (_label, arrange, reason) => {
    arrange();
    await expect(reasonOf(S.announce(INPUT, OFFICE, { now: NOW }))).resolves.toEqual({ status: 400, reason });
  });

  test("mos rezident yo'q — 400 no_eligible_residents", async () => {
    previewRoster.mockResolvedValue({ eligible: [], taken: [] });
    await expect(reasonOf(S.announce(INPUT, OFFICE, { now: NOW }))).resolves.toEqual({ status: 400, reason: "no_eligible_residents" });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("hammasi band — 409 all_residents_framed {conflicts}, sessiya yaratilmaydi", async () => {
    previewRoster.mockResolvedValue({ eligible: ["r1"], taken: [{ resident: "r1", session: "s9", extra: 1 }] });
    await expect(reasonOf(S.announce(INPUT, OFFICE, { now: NOW }))).resolves.toEqual({
      status: 409,
      reason: "all_residents_framed",
      conflicts: [{ resident: "r1", session: "s9" }],
    });
    expect(Session.create).not.toHaveBeenCalled();
  });
});

describe("announce — takroriy e'lon (bir xil kalit)", () => {
  test("mavjud sessiya — fan-out tiklanadi, 409 {session}; yaratilmaydi", async () => {
    const existing = sessionDoc({ _id: "s-old" });
    Session.findOne.mockReturnValue(q(existing));
    const hooks = { beforeWrite: jest.fn() };
    await expect(reasonOf(S.announce(INPUT, TEACHER, { now: NOW, hooks }))).resolves.toEqual({
      status: 409,
      reason: "session_already_announced",
      session: "s-old",
    });
    expect(fanOut).toHaveBeenCalledWith(existing, hooks);
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("poyga: create E11000 → mavjudga fan-out + 409", async () => {
    const existing = sessionDoc({ _id: "s-won" });
    Session.findOne.mockReturnValueOnce(q(null)).mockReturnValueOnce(q(existing));
    Session.create.mockRejectedValue(Object.assign(new Error("E11000 index: session_announced_unique dup key"), { code: 11000 }));
    await expect(reasonOf(S.announce(INPUT, TEACHER, { now: NOW }))).resolves.toMatchObject({ status: 409, session: "s-won" });
    expect(fanOut).toHaveBeenCalledWith(existing, undefined);
  });

  test("boshqa create xatosi qayta tashlanadi", async () => {
    const boom = Object.assign(new Error("E11000 index: other_index"), { code: 11000 });
    Session.create.mockRejectedValue(boom);
    await expect(S.announce(INPUT, TEACHER, { now: NOW })).rejects.toBe(boom);
    expect(fanOut).not.toHaveBeenCalled();
  });
});

describe("announce — muvaffaqiyat", () => {
  test("allowlist: announcedBy req.user dan, titllar serverdan, doira roldan", async () => {
    const out = await S.announce({ ...INPUT, announcedBy: "evil" }, TEACHER, { now: NOW });
    expect(Session.create).toHaveBeenCalledWith({
      ...INPUT, groupTitle: "G-1", scienceTitle: "Terapiya", announcedBy: "u-teacher",
      rosterScope: "supervised", status: "announced",
    });
    expect(out).toMatchObject({ framed: 2, conflicts: [], session: { _id: "s1", canCancel: true } });
  });

  test("bo'lim — rosterScope 'group'; fan-out yaratilgan sessiya bilan", async () => {
    const hooks = {};
    await S.announce(INPUT, OFFICE, { now: NOW, hooks });
    expect(Session.create.mock.calls[0][0]).toMatchObject({ announcedBy: "u-office", rosterScope: "group" });
    expect(fanOut).toHaveBeenCalledWith(expect.objectContaining({ _id: "s1", status: "announced" }), hooks);
  });
});

describe("cancel", () => {
  test("begona rol — 403; begona ustoz yoki yo'q — 404", async () => {
    await expect(reasonOf(S.cancel("s1", "sabab", { _id: "x", role: { title: "admin" } }, { now: NOW }))).resolves.toMatchObject({ status: 403 });
    const other = { _id: "u-other", role: { title: "klinik_ustoz" } };
    await expect(reasonOf(S.cancel("s1", "sabab", other, { now: NOW }))).resolves.toEqual({ status: 404, reason: "session_not_found" });
    Session.findById.mockReturnValueOnce(q(null));
    await expect(reasonOf(S.cancel("s1", "sabab", OFFICE, { now: NOW }))).resolves.toMatchObject({ status: 404 });
    expect(Session.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("kun yopilgan — 409 session_day_closed", async () => {
    Session.findById.mockReturnValueOnce(q(sessionDoc({ day: "2026-09-26" })));
    await expect(reasonOf(S.cancel("s1", "sabab", OFFICE, { now: NOW }))).resolves.toEqual({ status: 409, reason: "session_day_closed" });
  });

  test("CAS null (parallel bekor qilish) — freymlar tiklanadi, keyin 409", async () => {
    const at = new Date("2026-09-27T09:00:00Z");
    Session.findOneAndUpdate.mockReturnValue(q(null));
    Session.findById.mockReturnValueOnce(q(sessionDoc())).mockReturnValueOnce(q(sessionDoc({ status: "cancelled", cancelledAt: at })));
    await expect(reasonOf(S.cancel("s1", "sabab", TEACHER, { now: NOW }))).resolves.toEqual({ status: 409, reason: "session_already_cancelled" });
    expect(cancelFrames).toHaveBeenCalledWith("s1", at);
  });

  test("takroriy bekor qilish (kun yopilgan bo'lsa ham) — uzilgan freym qadami tiklanadi, 409; CAS yo'q", async () => {
    const at = new Date("2026-09-26T09:00:00Z");
    Session.findById.mockReturnValueOnce(q(sessionDoc({ day: "2026-09-26", status: "cancelled", cancelledAt: at })));
    await expect(reasonOf(S.cancel("s1", "sabab", TEACHER, { now: NOW }))).resolves.toEqual({ status: 409, reason: "session_already_cancelled" });
    expect(cancelFrames).toHaveBeenCalledWith("s1", at);
    expect(Session.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("bo'lim istalganini bekor qiladi: CAS → keyin freymlar", async () => {
    const out = await S.cancel("s1", "sabab", OFFICE, { now: NOW });
    expect(Session.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "s1", status: "announced" },
      { $set: { status: "cancelled", cancelledAt: NOW, cancelledBy: "u-office", cancelReason: "sabab" } },
      { new: true },
    );
    expect(cancelFrames).toHaveBeenCalledWith("s1", NOW);
    expect(Session.findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(cancelFrames.mock.invocationCallOrder[0]);
    expect(out.cancelledFrames).toBe(2);
  });
});

describe("cancel — L4 natijalarini void qiladi", () => {
  test("muvaffaqiyatli bekor qilish: freymlardan KEYIN resolveSession(force)", async () => {
    await S.cancel("s1", "sabab", OFFICE, { now: NOW });
    expect(resolveSession).toHaveBeenCalledWith("s1", { now: expect.any(Date), force: true });
    expect(cancelFrames.mock.invocationCallOrder[0]).toBeLessThan(resolveSession.mock.invocationCallOrder[0]);
  });

  test("void revizyasi — CAS'dan keyingi vaqt, so'rov boshidagi `now` emas (yangiroq o'tishni yutadi)", async () => {
    let casAt = null;
    Session.findOneAndUpdate.mockImplementation(() => {
      casAt = Date.now();
      return q(sessionDoc({ status: "cancelled" }));
    });
    await S.cancel("s1", "sabab", OFFICE, { now: NOW });
    const { now } = resolveSession.mock.calls[0][1];
    expect(now).not.toBe(NOW);
    expect(now.getTime()).toBeGreaterThanOrEqual(casAt);
  });

  test("takroriy bekor qilish ham qatorlarni tiklaydi, keyin 409", async () => {
    Session.findById.mockReturnValueOnce(q(sessionDoc({ status: "cancelled", cancelledAt: NOW })));
    await expect(reasonOf(S.cancel("s1", "sabab", TEACHER, { now: NOW }))).resolves.toMatchObject({ status: 409 });
    expect(resolveSession).toHaveBeenCalledWith("s1", { now: expect.any(Date), force: true });
  });

  test("yechim yiqilsa — bekor qilish baribir 200, xato loglanadi", async () => {
    resolveSession.mockRejectedValueOnce(new Error("facts down"));
    const out = await S.cancel("s1", "sabab", OFFICE, { now: NOW });
    expect(out.cancelledFrames).toBe(2);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("session=s1: facts down"));
  });
});
