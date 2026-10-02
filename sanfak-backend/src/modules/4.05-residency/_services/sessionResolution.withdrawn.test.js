"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("./expulsionCheck", () => ({ runExpulsionCheck: jest.fn() }));
jest.mock("./sessionProjection", () => ({ applyResult: jest.fn(), copiesFrameScore: jest.fn() }));
jest.mock("./sessionRosterSync", () => ({ syncSessionRoster: jest.fn() }));
jest.mock("./samsFactsPort", () => ({ loadSessionFacts: jest.fn(async () => ({ presence: new Map(), outages: [] })) }));
jest.mock("#modules/4.05-residency/residencySetting/residencySetting.service", () => ({
  getOrCreate: jest.fn().mockResolvedValue({ workDayFrom: "09:00", workDayTo: "14:00" }),
}));

const { applyResult } = require("./sessionProjection");
const { syncSessionRoster } = require("./sessionRosterSync");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const { resolveSession } = require("./sessionResolution");

const NOW = new Date("2026-10-13T03:00:00.000Z");
const REV = NOW.getTime();
const WITHDRAWN_AT = new Date("2026-10-12T08:00:00.000Z");
const SESSION = { _id: "s1", day: "2026-10-12", status: "announced", hours: 4, rosterFrozenAt: null };
const chain = (value) => {
  const c = { select: () => c, sort: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};
const FRAME = {
  _id: "f1", session: "s1", resident: "r1", outcome: "absent", outcomeReason: "no_overlap", cancelledAt: WITHDRAWN_AT,
  resolvedRev: REV - 10, resolverVersion: 1, attendance: "row1", score: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Session, "findById").mockImplementation(() => chain({ ...SESSION }));
  jest.spyOn(Session, "exists").mockResolvedValue(null);
  jest.spyOn(Roster, "find").mockImplementation(() => chain([{ ...FRAME }]));
  jest.spyOn(Roster, "findOneAndUpdate").mockImplementation((filter, update) => chain({ ...FRAME, ...update.$set }));
  jest.spyOn(Roster, "updateOne").mockResolvedValue({ modifiedCount: 1 });
  jest.spyOn(Roster, "findById").mockReturnValue(chain({ resolvedRev: null }));
  jest.spyOn(Resident, "find").mockReturnValue(chain([{ _id: "r1" }]));
  jest.spyOn(Attendance, "findOne").mockReturnValue(chain(null));
  jest.spyOn(ResidentApplication, "find").mockReturnValue(chain([]));
  applyResult.mockResolvedValue({ changed: false, stale: false, rowId: null });
});
afterEach(() => jest.restoreAllMocks());

describe("freym CAS'i yuklangan cancelledAt ga bog'langan (L4-Q29)", () => {
  test("chiqarilgan freym — filtrda o'sha cancelledAt, natija void/withdrawn", async () => {
    await resolveSession("s1", { now: NOW, force: true });
    expect(Roster.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "f1", cancelledAt: WITHDRAWN_AT });
    expect(Roster.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({ outcome: "void", outcomeReason: "withdrawn" });
  });

  test("jonli yuklangan freym — filtrda cancelledAt: null (orada chiqarilsa stale)", async () => {
    Roster.find.mockImplementation(() => chain([{ ...FRAME, cancelledAt: null }]));
    Roster.findOneAndUpdate.mockReturnValue(chain(null));
    const out = await resolveSession("s1", { now: NOW, force: true });
    expect(Roster.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: "f1", cancelledAt: null });
    expect(applyResult).not.toHaveBeenCalled();
    expect(out).toMatchObject({ stale: 1, repaired: 0 });
  });
});

describe("void CAS'i yutqazdi — tuzatish faqat freym void bo'lmasa (L4-Q29)", () => {
  const staleOnce = () => Roster.findOneAndUpdate.mockReturnValueOnce(chain(null));

  test("yangiroq o'tish chiqarishdan oldin absent yozgan — o'sha revizyadan keyin void tuzatish", async () => {
    staleOnce();
    Roster.findById.mockReturnValueOnce(chain({ outcome: "absent", resolvedRev: REV + 5 }));
    const out = await resolveSession("s1", { now: NOW, force: true });
    expect(Roster.findById).toHaveBeenCalledWith("f1");
    expect(Roster.find).toHaveBeenLastCalledWith({ session: "s1", resident: { $in: ["r1"] } });
    expect(Roster.findOneAndUpdate.mock.calls[1][1].$set).toMatchObject({ outcome: "void", resolvedRev: REV + 6 });
    expect(out).toMatchObject({ stale: 1, repaired: 1 });
  });

  test("freymda revizya yo'q (bekor qilish bilan poyga) — o'z revizyasidan keyin tuzatish", async () => {
    staleOnce();
    Roster.findById.mockReturnValueOnce(chain({ outcome: "pending", resolvedRev: null }));
    await resolveSession("s1", { now: NOW, force: true });
    expect(Roster.findOneAndUpdate.mock.calls[1][1].$set).toMatchObject({ outcome: "void", resolvedRev: REV + 1 });
  });

  test("freym allaqachon void (yangiroq o'tish ham chiqarishni ko'rgan) — tuzatish yo'q", async () => {
    staleOnce();
    Roster.findById.mockReturnValueOnce(chain({ outcome: "void", resolvedRev: REV + 5 }));
    expect(await resolveSession("s1", { now: NOW, force: true })).toMatchObject({ stale: 1, repaired: 0 });
    expect(Roster.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  test("void bo'lmagan natija stale — freym qayta o'qilmaydi", async () => {
    Roster.find.mockImplementation(() => chain([{ ...FRAME, cancelledAt: null }]));
    staleOnce();
    expect(await resolveSession("s1", { now: NOW, force: true })).toMatchObject({ stale: 1, repaired: 0 });
    expect(Roster.findById).not.toHaveBeenCalled();
  });
});

describe("cheklangan o'tish sync'da freym chiqarsa — butun sessiya (L4-Q30)", () => {
  test.each([
    ["chiqardi — filtrda rezident yo'q", 1, { session: "s1" }],
    ["chiqarmadi — faqat so'ralgan rezident", 0, { session: "s1", resident: { $in: ["r1"] } }],
  ])("%s", async (_label, withdrawn, filter) => {
    syncSessionRoster.mockResolvedValueOnce({ frozen: false, framed: null, withdrawn });
    await resolveSession("s1", { now: NOW, force: true, residentIds: ["r1"] });
    expect(Roster.find).toHaveBeenNthCalledWith(1, filter);
  });

  test("bekor qilingan sessiya — sync yo'q, cheklov saqlanadi", async () => {
    Session.findById.mockImplementation(() => chain({ ...SESSION, status: "cancelled" }));
    await resolveSession("s1", { now: NOW, residentIds: ["r1"] });
    expect(syncSessionRoster).not.toHaveBeenCalled();
    expect(Roster.find).toHaveBeenNthCalledWith(1, { session: "s1", resident: { $in: ["r1"] } });
  });
});
