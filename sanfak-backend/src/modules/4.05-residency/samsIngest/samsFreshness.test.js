"use strict";

jest.mock("./samsOrgDay.model", () => ({ distinct: jest.fn(), find: jest.fn(), updateOne: jest.fn() }));
jest.mock("./samsPresence.model", () => ({ updateMany: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const SamsOrgDay = require("./samsOrgDay.model");
const SamsPresence = require("./samsPresence.model");
const winston = require("#shared/winston.logger");
const { markStaleDays } = require("./samsFreshness");

const NOW = new Date("2026-09-27T05:00:00Z");
const at = (iso) => new Date(iso);
const row = (id, over) => ({ _id: id, dbname: "A", packetAt: at("2026-09-27T04:00:00Z"), receivedAt: at("2026-09-27T04:00:05Z"), ...over });
const candidates = (rows) => SamsOrgDay.find.mockReturnValue({ select: () => ({ lean: async () => rows }) });

beforeEach(() => {
  jest.clearAllMocks();
  SamsOrgDay.distinct.mockResolvedValue(["A", "B"]);
  SamsPresence.updateMany.mockResolvedValue({ modifiedCount: 3 });
  SamsOrgDay.updateOne.mockResolvedValue({ modifiedCount: 1 });
});

describe("markStaleDays — tanlash", () => {
  it("klinika yo'q — hech narsa o'qilmaydi va yozilmaydi", async () => {
    SamsOrgDay.distinct.mockResolvedValueOnce([]);
    await expect(markStaleDays(NOW)).resolves.toEqual({ orgDays: 0, presence: 0, todayOrgDays: 0, lost: 0 });
    expect(SamsOrgDay.find).not.toHaveBeenCalled();
  });

  it("so'rov: dbname $in, 92 kun, o'lchangan, receivedAt < now−30 daq", async () => {
    candidates([]);
    await markStaleDays(NOW);
    expect(SamsOrgDay.find).toHaveBeenCalledWith({
      dbname: { $in: ["A", "B"] },
      day: { $gte: "2026-06-27", $lte: "2026-09-27" },
      measured: true,
      receivedAt: { $lt: new Date(NOW.getTime() - 30 * 60_000) },
    });
  });

  it("yakuniy va hali yopilmagan qatorlar tegilmaydi; bugungi va muddati o'tgan kun tushiriladi", async () => {
    candidates([
      row("today", { day: "2026-09-27", receivedAt: at("2026-09-27T04:29:00Z") }),
      row("final", { day: "2026-09-25", packetAt: at("2026-09-25T20:00:00Z") }),
      row("past", { day: "2026-09-26", packetAt: at("2026-09-26T15:00:00Z") }),
      row("future", { day: "2026-09-28" }),
    ]);
    const res = await markStaleDays(NOW);
    expect(SamsOrgDay.updateOne.mock.calls.map((c) => c[0]._id)).toEqual(["today", "past"]);
    expect(res).toEqual({ orgDays: 2, presence: 6, todayOrgDays: 1, lost: 0 });
  });

  it("kecha 06:00 UZ dan oldin (05:59) — hali tushirilmaydi", async () => {
    candidates([row("past", { day: "2026-09-26", packetAt: at("2026-09-26T15:00:00Z") })]);
    await markStaleDays(at("2026-09-27T00:59:00Z"));
    expect(SamsOrgDay.updateOne).not.toHaveBeenCalled();
  });
});

describe("markStaleDays — yozish tartibi va CAS", () => {
  const r = row("x", { day: "2026-09-27" });
  beforeEach(() => candidates([r]));

  it("avval rezident qatorlari (receivedAt $lte), keyin klinika CAS (aynan packetAt + receivedAt)", async () => {
    await markStaleDays(NOW);
    const set = { $set: { measured: false, unmeasuredReason: "stale" } };
    expect(SamsPresence.updateMany).toHaveBeenCalledWith(
      { dbname: "A", day: "2026-09-27", measured: true, receivedAt: { $lte: r.receivedAt } },
      set,
    );
    expect(SamsOrgDay.updateOne).toHaveBeenCalledWith(
      { _id: "x", measured: true, packetAt: r.packetAt, receivedAt: r.receivedAt },
      set,
    );
    expect(SamsPresence.updateMany.mock.invocationCallOrder[0]).toBeLessThan(SamsOrgDay.updateOne.mock.invocationCallOrder[0]);
    expect(winston.warn).toHaveBeenCalledWith(expect.stringMatching(/stale orgDays=1 \(bugun=1\) presence=3 kunlar=A:2026-09-27/));
  });

  it("CAS yutqazildi (yangiroq paket) — info, xato emas, `lost` sanaladi", async () => {
    SamsOrgDay.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    SamsPresence.updateMany.mockResolvedValueOnce({ modifiedCount: 0 });
    await expect(markStaleDays(NOW)).resolves.toEqual({ orgDays: 0, presence: 0, todayOrgDays: 0, lost: 1 });
    expect(winston.info).toHaveBeenCalledWith(expect.stringContaining("A:2026-09-27 yangiroq paket yutdi"));
    expect(winston.warn).not.toHaveBeenCalled();
  });

  it("yozish xatosi yuqoriga (tik uni ushlaydi va loglaydi)", async () => {
    SamsOrgDay.updateOne.mockRejectedValueOnce(new Error("Mongo down"));
    await expect(markStaleDays(NOW)).rejects.toThrow("Mongo down");
  });
});
