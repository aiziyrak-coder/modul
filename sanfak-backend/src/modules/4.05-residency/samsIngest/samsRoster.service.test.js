"use strict";

jest.mock("#modules/4.05-residency/resident/resident.model", () => ({
  find: jest.fn(),
  STATUS_IN_STUDY: "oquvda",
}));
jest.mock("./samsSyncState.model", () => ({
  findOne: jest.fn(),
  updateOne: jest.fn(),
  SYNC_STATE_KEY: "default",
}));
jest.mock("./samsDelivery", () => ({ computeWatermark: jest.fn() }));
jest.mock("./samsPacketLog", () => ({ cleanWindowsSince: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsSyncState = require("./samsSyncState.model");
const { computeWatermark } = require("./samsDelivery");
const { cleanWindowsSince } = require("./samsPacketLog");
const winston = require("#shared/winston.logger");
const S = require("./samsRoster.service");

const NOW = new Date("2026-09-27T05:00:00Z");
const residents = (docs) =>
  Resident.find.mockReturnValue({ select: () => ({ lean: async () => docs }) });
const state = (resendFrom, resendRequestedAt, resendClearedAt) =>
  SamsSyncState.findOne.mockReturnValue({
    lean: async () => (resendFrom === undefined ? null : { resendFrom, resendRequestedAt, resendClearedAt }),
  });

beforeEach(() => {
  jest.clearAllMocks();
  SamsSyncState.updateOne.mockResolvedValue({ modifiedCount: 1 });
  computeWatermark.mockResolvedValue({ deliveredThrough: null, resendFrom: null });
  cleanWindowsSince.mockResolvedValue([]);
});

describe("rosterFilter — yagona kogorta ta'rifi", () => {
  it("ordinatura, faol, o'qishda (yoki holatsiz eski yozuv), 14 raqamli jshshir", () => {
    expect(S.rosterFilter()).toEqual({
      program: "ordinatura",
      active: true,
      status: { $in: ["oquvda", null] },
      jshshir: { $regex: /^\d{14}$/ },
    });
  });
});

describe("effectiveResendFrom — [bugun-30, bugun] kesimi", () => {
  it.each([
    [null, null],
    [undefined, null],
    ["salom", null],
    ["2026-02-30", null],
    ["2026-08-01", "2026-08-28"],
    ["2026-08-28", "2026-08-28"],
    ["2026-09-20", "2026-09-20"],
    ["2026-10-05", "2026-09-27"],
  ])("%p → %p", (stored, want) => {
    expect(S.effectiveResendFrom(stored, "2026-09-27")).toBe(want);
  });
});

describe("getRoster", () => {
  it("oyna bugun-6..bugun, jshshir tartiblangan va takrorsiz, resendFrom kesilgan", async () => {
    residents([{ jshshir: "22222222222222" }, { jshshir: "11111111111111" }, { jshshir: "22222222222222" }]);
    state("2026-08-01");
    const r = await S.getRoster(NOW);
    expect(r).toEqual({
      schemaVersion: 1,
      serverTime: NOW.toISOString(),
      today: "2026-09-27",
      window: { from: "2026-09-21", to: "2026-09-27" },
      resendFrom: "2026-08-28",
      deliveredThrough: null,
      jshshirs: ["11111111111111", "22222222222222"],
    });
    expect(Resident.find).toHaveBeenCalledWith(S.rosterFilter());
  });

  it("bugun UZ bo'yicha (UTC 20:00 — UZ ertasi), holat hujjati yo'q → resendFrom null", async () => {
    residents([]);
    state(undefined);
    const r = await S.getRoster(new Date("2026-09-27T20:00:00Z"));
    expect(r.today).toBe("2026-09-28");
    expect(r.resendFrom).toBeNull();
    expect(r.jshshirs).toEqual([]);
  });
});

describe("getRoster — watermark bilan (I8)", () => {
  beforeEach(() => residents([]));

  it.each([
    ["qo'lda yo'q — avtomatik", undefined, "2026-09-20", "2026-09-20"],
    ["avtomatik ertaroq", "2026-09-24", "2026-09-20", "2026-09-20"],
    ["qo'lda ertaroq (kesilgan)", "2026-08-01", "2026-09-20", "2026-08-28"],
    ["avtomatik yo'q — qo'lda", "2026-09-24", null, "2026-09-24"],
  ])("resendFrom — ertarog'i: %s", async (_l, manual, auto, want) => {
    state(manual);
    computeWatermark.mockResolvedValueOnce({ deliveredThrough: "2026-09-19", resendFrom: auto });
    const r = await S.getRoster(NOW);
    expect([r.resendFrom, r.deliveredThrough]).toEqual([want, "2026-09-19"]);
    expect(computeWatermark).toHaveBeenCalledWith(NOW);
  });

  it("watermark yiqilsa roster baribir javob beradi (qo'lda qiymat, deliveredThrough null)", async () => {
    state("2026-09-24");
    computeWatermark.mockRejectedValueOnce(new Error("Mongo down"));
    const r = await S.getRoster(NOW);
    expect([r.resendFrom, r.deliveredThrough]).toEqual(["2026-09-24", null]);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("watermark hisoblanmadi: Mongo down"));
  });
});

const EMITTED = new Date("2026-09-27T04:59:00Z");
const REQUESTED = new Date("2026-09-27T03:00:00Z");
const WEEK = ["2026-09-21", "2026-09-27"];
const w = (from, to) => ({ from, to });
const clear = ([from, to], stored, { requestedAt = REQUESTED, clearedAt, clock, log = [], ...over } = {}) => {
  state(stored, requestedAt, clearedAt);
  cleanWindowsSince.mockResolvedValue(log);
  const packet = { window: { from, to }, emittedAt: EMITTED, trigger: "resend", scan: {}, ...over };
  return S.clearResendIfCovered(packet, NOW, clock);
};

describe("coversDays — birlashma [from..bugun] ning har kunini qoplaydimi (sof)", () => {
  it.each([
    [[w("2026-09-21", "2026-09-27")], "2026-09-21", true],
    [[w("2026-09-14", "2026-09-20"), w("2026-09-21", "2026-09-27")], "2026-09-17", true],
    [[w("2026-09-17", "2026-09-26"), w("2026-09-27", "2026-09-27")], "2026-09-17", true],
    [[w("2026-09-14", "2026-09-20")], "2026-09-17", false],
    [[w("2026-09-14", "2026-09-20"), w("2026-09-22", "2026-09-27")], "2026-09-17", false],
    [[], "2026-09-27", false],
  ])("%j, from %s → %p", (windows, from, want) => {
    expect(S.coversDays(windows, from, "2026-09-27")).toBe(want);
  });
});

describe("clearResendIfCovered — so'rovdan keyingi toza paketlar birlashmasi", () => {
  it("bitta paket [resendFrom..bugun] ni qoplaydi → CAS aynan saqlangan qiymatlar bo'yicha, vaqt ham o'chadi", async () => {
    expect(await clear(["2026-09-21", "2026-09-27"], "2026-09-24")).toBe(true);
    expect(cleanWindowsSince).toHaveBeenCalledWith(REQUESTED);
    expect(SamsSyncState.updateOne).toHaveBeenCalledWith(
      { key: "default", resendFrom: "2026-09-24", resendRequestedAt: REQUESTED },
      { $set: { resendFrom: null, resendRequestedAt: null, resendClearedAt: NOW } },
    );
  });

  it("eng eski bo'lak toza, yangi bo'lak jurnalda YO'Q (failedTenants bilan kelgan) → tozalanmaydi", async () => {
    expect(await clear(["2026-09-17", "2026-09-20"], "2026-09-17")).toBe(false);
    expect(SamsSyncState.updateOne).not.toHaveBeenCalled();
  });

  it("eng eski bo'lak + jurnaldagi toza yangi bo'lak → tozalanadi", async () => {
    expect(await clear(["2026-09-17", "2026-09-20"], "2026-09-17", { log: [w("2026-09-21", "2026-09-27")] })).toBe(true);
  });

  it("bugun-only tik — jurnalsiz qoplamaydi; birlashmada teshik bo'lsa ham qoplamaydi", async () => {
    expect(await clear(["2026-09-27", "2026-09-27"], "2026-09-24")).toBe(false);
    expect(await clear(["2026-09-27", "2026-09-27"], "2026-09-24", { log: [w("2026-09-24", "2026-09-25")] })).toBe(false);
    expect(await clear(["2026-09-27", "2026-09-27"], "2026-09-24", { log: [w("2026-09-20", "2026-09-26")] })).toBe(true);
  });

  it("so'ralgan kundan butunlay eski oyna {bugun-20..bugun-14} → tozalanmaydi", async () => {
    expect(await clear(["2026-09-07", "2026-09-13"], "2026-09-24")).toBe(false);
    expect(SamsSyncState.updateOne).not.toHaveBeenCalled();
  });

  it("30 kundan eski so'rov: kesilgan kundan bugungacha qoplansa tozalanadi, CAS — XOM qiymat bo'yicha", async () => {
    const log = [w("2026-09-04", "2026-09-10"), w("2026-09-11", "2026-09-17"), w("2026-09-18", "2026-09-24"), w("2026-09-25", "2026-09-27")];
    expect(await clear(["2026-08-28", "2026-09-03"], "2026-08-01", { log })).toBe(true);
    expect(SamsSyncState.updateOne.mock.calls[0][0].resendFrom).toBe("2026-08-01");
  });

  it("jurnal o'qilmasa — so'rov qoladi, winston.error", async () => {
    state("2026-09-24", REQUESTED);
    cleanWindowsSince.mockRejectedValueOnce(new Error("Mongo down"));
    const packet = { window: w("2026-09-24", "2026-09-26"), emittedAt: EMITTED, trigger: "resend", scan: {} };
    expect(await S.clearResendIfCovered(packet, NOW)).toBe(false);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("paket jurnali o'qilmadi: Mongo down"));
  });
});

describe("clearResendIfCovered — yetkazish sharti va poyga", () => {
  it("failedTenants bor bo'lak → tozalanmaydi (yuboruvchi markerlarni ushlaydi, qayta yuborish kerak)", async () => {
    const scan = { failedTenants: [{ dbname: "B", orgTitle: "B" }] };
    expect(await clear(WEEK, "2026-09-24", { scan })).toBe(false);
    expect(SamsSyncState.findOne).not.toHaveBeenCalled();
    expect(await clear(WEEK, "2026-09-24", { scan: { failedTenants: [] } })).toBe(true);
  });

  it("trigger manual → tozalanmaydi; trigger yo'q (eski worker) → oddiy qoida", async () => {
    expect(await clear(WEEK, "2026-09-24", { trigger: "manual" })).toBe(false);
    expect(SamsSyncState.findOne).not.toHaveBeenCalled();
    expect(await clear(WEEK, "2026-09-24", { trigger: undefined })).toBe(true);
  });

  it("snapshot so'rovdan OLDIN olingan (kechikkan qayta urinish) → tozalanmaydi, jurnal o'qilmaydi", async () => {
    expect(await clear(WEEK, "2026-09-24", { requestedAt: new Date("2026-09-27T05:00:00Z") })).toBe(false);
    expect(cleanWindowsSince).not.toHaveBeenCalled();
    expect(SamsSyncState.updateOne).not.toHaveBeenCalled();
  });

  it("so'rov ingest boshlangandan KEYIN yozilgan, SAMS soati oldinda → shu paket hisoblanmaydi", async () => {
    const opts = { requestedAt: new Date("2026-09-27T05:00:30Z"), emittedAt: new Date("2026-09-27T05:01:00Z") };
    expect(await clear(WEEK, "2026-09-24", opts)).toBe(false);
    expect(cleanWindowsSince).not.toHaveBeenCalled();
    expect(SamsSyncState.updateOne).not.toHaveBeenCalled();
    expect(await clear(WEEK, "2026-09-24", { requestedAt: NOW, emittedAt: NOW })).toBe(true);
  });

  it("so'rov yo'q yoki parallel o'zgargan (modifiedCount 0) → false", async () => {
    expect(await clear(WEEK, null)).toBe(false);
    expect(SamsSyncState.updateOne).not.toHaveBeenCalled();
    SamsSyncState.updateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await clear(WEEK, "2026-09-24")).toBe(false);
  });
});

describe("clearResendIfCovered — vaqtsiz so'rovga vaqt qo'yish", () => {
  it("vaqti shu paketda qo'yiladi (CAS), shu paket qoplamaydi; hech tozalanmagan holat — belgi null", async () => {
    expect(await clear(WEEK, "2026-09-24", { requestedAt: null })).toBe(false);
    expect(cleanWindowsSince).not.toHaveBeenCalled();
    expect(SamsSyncState.updateOne).toHaveBeenCalledWith(
      { key: "default", resendFrom: "2026-09-24", resendRequestedAt: null, resendClearedAt: null },
      { $set: { resendRequestedAt: NOW } },
    );
  });

  it("CAS o'qilgan tozalash belgisi bo'yicha — oradagi tozalash va qayta so'rov (ABA) mos kelmaydi", async () => {
    const clearedAt = new Date("2026-09-27T04:46:00Z");
    expect(await clear(WEEK, "2026-09-24", { requestedAt: null, clearedAt })).toBe(false);
    expect(SamsSyncState.updateOne.mock.calls[0][0]).toEqual({
      key: "default", resendFrom: "2026-09-24", resendRequestedAt: null, resendClearedAt: clearedAt,
    });
  });

  it("SAMS soati oldinda — vaqt shu paket emittedAt + 1 ms (paket birlashmaga kirmaydi)", async () => {
    const ahead = new Date("2026-09-27T05:02:00Z");
    expect(await clear(WEEK, "2026-09-24", { requestedAt: null, emittedAt: ahead })).toBe(false);
    expect(SamsSyncState.updateOne.mock.calls[0][1]).toEqual({ $set: { resendRequestedAt: new Date("2026-09-27T05:02:00.001Z") } });
  });

  it.each([
    ["so'rov ingest davomida yozilgan — ko'rilgan payt", "2026-09-27T05:00:02Z", "2026-09-27T05:00:02Z"],
    ["soat orqaga surilgan — qabul vaqti", "2026-09-27T04:59:58Z", "2026-09-27T05:00:00Z"],
  ])("vaqt so'rov ko'rilgan paytdan (holat o'qilgandan keyingi soat) oldin emas: %s", async (_l, seen, want) => {
    const clock = jest.fn(() => new Date(seen));
    expect(await clear(WEEK, "2026-09-24", { requestedAt: null, clock })).toBe(false);
    expect(SamsSyncState.updateOne.mock.calls[0][1]).toEqual({ $set: { resendRequestedAt: new Date(want) } });
    expect(clock.mock.invocationCallOrder[0]).toBeGreaterThan(SamsSyncState.findOne.mock.invocationCallOrder[0]);
  });
});
