"use strict";

jest.mock("./sessionRoster", () => ({ selectSessionRoster: jest.fn(), fanOut: jest.fn(), withdrawFrames: jest.fn() }));

const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const { selectSessionRoster, fanOut, withdrawFrames } = require("./sessionRoster");
const { syncSessionRoster } = require("./sessionRosterSync");

const DAY = "2026-10-12";
const uz = (hhmm) => new Date(`${DAY}T${hhmm}:00.000+05:00`);
const WINDOW = { from: "09:00", to: "14:00" };
const SESSION = { _id: "s1", day: DAY, rosterScope: "group", group: "g1", rosterFrozenAt: null };
const chain = (value) => {
  const c = { select: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};

beforeEach(() => {
  jest.clearAllMocks();
  selectSessionRoster.mockResolvedValue(["r1", "r3"]);
  fanOut.mockResolvedValue({ framed: 3, conflicts: [] });
  withdrawFrames.mockResolvedValue(1);
  jest.spyOn(Roster, "find").mockReturnValue(chain([{ resident: "r1" }, { resident: "r2" }, { resident: "r3" }]));
  jest.spyOn(Session, "updateOne").mockResolvedValue({ modifiedCount: 1 });
});
afterEach(() => jest.restoreAllMocks());

describe("syncSessionRoster", () => {
  test("muzlatilgan — hech narsa qilinmaydi", async () => {
    const out = await syncSessionRoster({ ...SESSION, rosterFrozenAt: uz("15:00") }, { now: uz("16:00"), window: WINDOW });
    expect(out).toEqual({ frozen: true, framed: null, withdrawn: 0 });
    expect(selectSessionRoster).not.toHaveBeenCalled();
    expect(fanOut).not.toHaveBeenCalled();
    expect(Session.updateOne).not.toHaveBeenCalled();
  });

  test("boshlanishdan oldin — fanOut qo'shadi, keraksiz chiqariladi, muzlatilmaydi", async () => {
    const out = await syncSessionRoster(SESSION, { now: uz("08:59"), window: WINDOW });
    expect(fanOut).toHaveBeenCalledWith("s1");
    expect(Roster.find).toHaveBeenCalledWith({ session: "s1", cancelledAt: null });
    expect(withdrawFrames).toHaveBeenCalledWith("s1", ["r2"], uz("08:59"), { score: null });
    expect(Session.updateOne).not.toHaveBeenCalled();
    expect(out).toEqual({ frozen: false, framed: 3, withdrawn: 1 });
  });

  test("boshlangandan keyin — qo'shish YO'Q, chiqarish davom etadi", async () => {
    await syncSessionRoster(SESSION, { now: uz("09:00"), window: WINDOW });
    expect(fanOut).not.toHaveBeenCalled();
    expect(withdrawFrames).toHaveBeenCalledTimes(1);
    expect(Session.updateOne).not.toHaveBeenCalled();
  });

  test("tugagach — avval chiqarish, keyin muzlatish (CAS `rosterFrozenAt: null` dan)", async () => {
    const out = await syncSessionRoster(SESSION, { now: uz("14:00"), window: WINDOW });
    expect(Session.updateOne).toHaveBeenCalledWith({ _id: "s1", rosterFrozenAt: null }, { $set: { rosterFrozenAt: uz("14:00") } });
    expect(withdrawFrames.mock.invocationCallOrder[0]).toBeLessThan(Session.updateOne.mock.invocationCallOrder[0]);
    expect(out.frozen).toBe(true);
  });

  test("muzlatish CAS'ini parallel o'tish yutdi — frozen:false", async () => {
    Session.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect((await syncSessionRoster(SESSION, { now: uz("15:00"), window: WINDOW })).frozen).toBe(false);
  });

  test("hamma mos — chiqariladigan yo'q (bo'sh ro'yxat)", async () => {
    selectSessionRoster.mockResolvedValue(["r1", "r2", "r3"]);
    await syncSessionRoster(SESSION, { now: uz("10:00"), window: WINDOW });
    expect(withdrawFrames).toHaveBeenCalledWith("s1", [], uz("10:00"), { score: null });
  });

  test("oyna yaroqsiz — qo'shish ham, muzlatish ham yo'q", async () => {
    await syncSessionRoster(SESSION, { now: uz("20:00"), window: { from: "x", to: "y" } });
    expect(fanOut).not.toHaveBeenCalled();
    expect(Session.updateOne).not.toHaveBeenCalled();
  });
});
