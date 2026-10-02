"use strict";

jest.mock("./residencySamsOutage.model", () => ({ find: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/samsPresenceSync", () => ({ scheduleSessionResolution: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#modules/4.05-residency/attendance/attendance.model", () => ({ distinct: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/expulsionCheck", () => ({ runExpulsionCheck: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/sessionResolution", () => ({ RECOUNT_SOURCE: "sams" }));

const Outage = require("./residencySamsOutage.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const { runExpulsionCheck } = require("#modules/4.05-residency/_services/expulsionCheck");
const { scheduleSessionResolution } = require("#modules/4.05-residency/_services/samsPresenceSync");
const winston = require("#shared/winston.logger");
const R = require("./outageResolution");

const NOW = new Date("2026-10-15T07:00:00.000Z");
const TOKEN = new Date("2026-10-15T06:59:00.000Z");
const doc = (over = {}) => ({
  _id: "o1", from: "2026-10-10", to: "2026-10-12", resolutionPendingSince: TOKEN, resolutionAttempts: 1, ...over,
});
const lastOnDone = () => scheduleSessionResolution.mock.calls.at(-1)[0].onDone;
const findChain = (docs) => {
  const chain = { sort: jest.fn(() => chain), limit: jest.fn(() => chain), select: jest.fn(() => chain), lean: jest.fn(async () => docs) };
  Outage.find.mockReturnValueOnce(chain);
  return chain;
};
const claimReturns = (value) => Outage.findOneAndUpdate.mockReturnValueOnce({ lean: async () => value });

beforeEach(() => {
  jest.clearAllMocks();
  Outage.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Attendance.distinct.mockResolvedValue([]);
  runExpulsionCheck.mockResolvedValue(undefined);
});

describe("resolutionDays — oyna ∩ joriy o'quv yili ∩ (… bugun] (I3-Q5)", () => {
  const days = (from, to, now = NOW) => R.resolutionDays({ from, to }, now);

  it("oyna ichida — har kun, o'sish tartibida", () => {
    expect(days("2026-10-10", "2026-10-12")).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(days("2026-10-15", "2026-10-15")).toEqual(["2026-10-15"]);
  });

  it("o'quv yili boshidan kesiladi; butunlay o'tgan yil — bo'sh", () => {
    expect(days("2026-08-30", "2026-09-02")).toEqual(["2026-09-01", "2026-09-02"]);
    expect(days("2025-10-01", "2026-08-31")).toEqual([]);
  });

  it("bugundan keyingi kun olinmaydi", () => {
    expect(days("2026-10-14", "2026-10-20")).toEqual(["2026-10-14", "2026-10-15"]);
  });

  it("366 kunlik oyna — faqat joriy yil qismi", () => {
    const out = days("2025-10-15", "2026-10-15");
    expect([out.length, out[0], out[out.length - 1]]).toEqual([45, "2026-09-01", "2026-10-15"]);
  });

  it("UZ 1-sentabr 02:00 (UTC hali 31-avgust) — soat oynasi bilan bir xil: eski yil", () => {
    expect(days("2026-08-30", "2026-09-01", new Date("2026-08-31T21:00:00.000Z"))).toEqual(["2026-08-30", "2026-08-31"]);
  });
});

describe("requestResolution — majburiy o'tish va token (I3-Q10)", () => {
  it("oyna kunlari `force: true` bilan; o'tish kutilmaydi", async () => {
    await expect(R.requestResolution(doc(), NOW)).resolves.toBe(true);
    expect(scheduleSessionResolution).toHaveBeenCalledWith({
      days: ["2026-10-10", "2026-10-11", "2026-10-12"], force: true, onDone: expect.any(Function),
    });
    expect(Outage.updateOne).not.toHaveBeenCalled();
    await lastOnDone()(true);
  });

  it("xatosiz o'tish — token CAS bilan (o'sha qiymatda) tozalanadi; birinchi urinishda qayta hisob yo'q", async () => {
    await R.requestResolution(doc(), NOW);
    await lastOnDone()(true);
    expect(Outage.updateOne).toHaveBeenCalledWith(
      { _id: "o1", resolutionPendingSince: TOKEN },
      { $set: { resolutionPendingSince: null } },
    );
    expect(winston.error).not.toHaveBeenCalled();
    expect(Attendance.distinct).not.toHaveBeenCalled();
  });

  it.each([
    [1, "monitor tiki qayta urinadi"],
    [R.MAX_ATTEMPTS, "qayta urinilmaydi"],
  ])("xato bilan tugagan o'tish (urinish %i) — token qoladi, logda oraliq: «%s»", async (attempt, tail) => {
    await R.requestResolution(doc({ resolutionAttempts: attempt }), NOW);
    await lastOnDone()(false);
    expect(Outage.updateOne).not.toHaveBeenCalled();
    expect(Attendance.distinct).not.toHaveBeenCalled();
    expect(winston.error).toHaveBeenCalledWith(
      `[4.5 samsOutage] qayta yechim tugallanmadi outage=o1 days=2026-10-10..2026-10-12 (3) urinish=${attempt}/${R.MAX_ATTEMPTS} — ${tail}`,
    );
  });
});

describe("requestResolution — bo'sh oyna va rejalashtiruvchi xatosi (I3-Q10)", () => {
  it("joriy o'quv yilida kun yo'q — o'tish yo'q, token darhol tozalanadi", async () => {
    await expect(R.requestResolution(doc({ from: "2025-10-01", to: "2026-08-31" }), NOW)).resolves.toBe(false);
    expect(scheduleSessionResolution).not.toHaveBeenCalled();
    expect(Outage.updateOne).toHaveBeenCalledWith(
      { _id: "o1", resolutionPendingSince: TOKEN },
      { $set: { resolutionPendingSince: null } },
    );
  });

  it("rejalashtiruvchi yiqilsa — throw yo'q, log; o'tish navbatda EMAS (tik qayta oladi)", async () => {
    scheduleSessionResolution.mockImplementationOnce(() => {
      throw new Error("require failed");
    });
    await expect(R.requestResolution(doc(), NOW)).resolves.toBe(false);
    expect(winston.error).toHaveBeenCalledWith("[4.5 samsOutage] qayta yechim rejalashtirilmadi outage=o1: require failed");

    findChain([doc()]);
    claimReturns(doc({ resolutionAttempts: 2 }));
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(1);
    await lastOnDone()(true);
  });
});

describe("resumePendingResolutions — filtr va rejalashtirish (I3-Q10)", () => {
  it("filtr: token bor, urinish < MAX; eng eski token birinchi, chegarali", async () => {
    const chain = findChain([]);
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(0);
    expect(Outage.find).toHaveBeenCalledWith({
      resolutionPendingSince: { $ne: null }, resolutionAttempts: { $lt: R.MAX_ATTEMPTS },
    });
    expect(chain.sort).toHaveBeenCalledWith({ resolutionPendingSince: 1 });
    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(winston.warn).not.toHaveBeenCalled();
  });

  it("urinish CAS bilan band qilinadi ($inc) va o'tish rejalashtiriladi; warn", async () => {
    findChain([doc()]);
    claimReturns(doc({ resolutionAttempts: 2 }));
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(1);
    expect(Outage.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "o1", resolutionPendingSince: TOKEN, resolutionAttempts: 1 },
      { $inc: { resolutionAttempts: 1 } },
      { new: true, projection: "_id from to resolutionPendingSince resolutionAttempts" },
    );
    expect(scheduleSessionResolution).toHaveBeenCalledWith(expect.objectContaining({ force: true }));
    expect(winston.warn).toHaveBeenCalledWith("[4.5 samsOutage] qayta yechim qayta rejalashtirildi: outages=1");
    await lastOnDone()(true);
  });

});

describe("resumePendingResolutions — navbatdagi o'tish va band qilish (I3-Q10)", () => {
  it("navbatdagi/ishlayotgan o'tish qayta rejalashtirilmaydi; tugagach — yana olinadi", async () => {
    await R.requestResolution(doc(), NOW);
    const onDone = lastOnDone();
    findChain([doc()]);
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(0);
    expect(Outage.findOneAndUpdate).not.toHaveBeenCalled();
    expect(scheduleSessionResolution).toHaveBeenCalledTimes(1);

    await onDone(false);
    findChain([doc()]);
    claimReturns(doc({ resolutionAttempts: 2 }));
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(1);
    expect(scheduleSessionResolution).toHaveBeenCalledTimes(2);
    await lastOnDone()(true);
  });

  it("boshqa token (orada bekor qilindi) — navbatdagi eski token uni to'smaydi", async () => {
    await R.requestResolution(doc(), NOW);
    const onDone = lastOnDone();
    const newer = doc({ resolutionPendingSince: new Date(TOKEN.getTime() + 60_000) });
    findChain([newer]);
    claimReturns({ ...newer, resolutionAttempts: 2 });
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(1);
    await onDone(true);
    await lastOnDone()(true);
  });

  it("band qilish yutqazildi (token yoki urinish o'zgargan) — o'tkaziladi", async () => {
    findChain([doc()]);
    claimReturns(null);
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(0);
    expect(scheduleSessionResolution).not.toHaveBeenCalled();
  });
});

describe("qayta urinish — oyna kunlari qayta hisobi, xatosiz (I3-Q12)", () => {
  const retried = () => doc({ resolutionAttempts: 2 });
  const dates = ["2026-10-10", "2026-10-11", "2026-10-12"].map((d) => new Date(`${d}T00:00:00.000Z`));

  it("xatosiz qayta urinish — sessiya qatori bor rezidentlar (yashirilgani ham) ketma-ket, token SHUNDAN keyin", async () => {
    const order = [];
    Attendance.distinct.mockResolvedValueOnce(["r1", "r2"]);
    runExpulsionCheck.mockImplementation(async (id) => order.push(id));
    Outage.updateOne.mockImplementationOnce(async () => order.push("settle"));
    await R.requestResolution(retried(), NOW);
    await lastOnDone()(true);
    expect(Attendance.distinct).toHaveBeenCalledWith(
      "resident",
      { session: { $ne: null }, date: { $in: dates } },
      { includeDeleted: true },
    );
    expect(runExpulsionCheck.mock.calls).toEqual([["r1", { source: "sams" }], ["r2", { source: "sams" }]]);
    expect(order).toEqual(["r1", "r2", "settle"]);
    expect(winston.info).toHaveBeenCalledWith(
      "[4.5 samsOutage] qayta urinish qayta hisobi outage=o1 days=2026-10-10..2026-10-12 (3) residents=2 failed=0",
    );
    expect(winston.error).not.toHaveBeenCalled();
  });
});

describe("qayta urinish — qayta hisob xatolari va darvoza (I3-Q12)", () => {
  const retried = () => doc({ resolutionAttempts: 2 });

  it("bitta rezident qayta hisobi yiqildi — qolganlari baribir; token qoladi, error log", async () => {
    Attendance.distinct.mockResolvedValueOnce(["r1", "r2"]);
    runExpulsionCheck.mockRejectedValueOnce(new Error("boom"));
    await R.requestResolution(retried(), NOW);
    await expect(lastOnDone()(true)).resolves.toBeUndefined();
    expect(runExpulsionCheck).toHaveBeenCalledTimes(2);
    expect(Outage.updateOne).not.toHaveBeenCalled();
    expect(winston.error.mock.calls.map(([m]) => m)).toEqual([
      "[4.5 samsOutage] qayta hisob yiqildi outage=o1 resident=r1: boom",
      `[4.5 samsOutage] qayta yechim tugallanmadi outage=o1 days=2026-10-10..2026-10-12 (3) urinish=2/${R.MAX_ATTEMPTS} — monitor tiki qayta urinadi`,
    ]);
  });

  it("rezidentlar o'qilmadi — throw yo'q, token qoladi", async () => {
    Attendance.distinct.mockRejectedValueOnce(new Error("db"));
    await R.requestResolution(retried(), NOW);
    await expect(lastOnDone()(true)).resolves.toBeUndefined();
    expect(Outage.updateOne).not.toHaveBeenCalled();
    expect(winston.error).toHaveBeenCalledWith("[4.5 samsOutage] qayta urinish qayta hisobi yiqildi outage=o1: db");
  });

  it("darvoza: qayta hisob paytidagi tik o'tishni qayta rejalashtirmaydi; tugagach token tozalanadi", async () => {
    const g = {};
    g.released = new Promise((r) => (g.release = r));
    g.arrived = new Promise((r) => (g.reached = r));
    Attendance.distinct.mockResolvedValueOnce(["r1"]);
    runExpulsionCheck.mockImplementationOnce(async () => {
      g.reached();
      await g.released;
    });
    await R.requestResolution(retried(), NOW);
    const done = lastOnDone()(true);
    await g.arrived;

    findChain([retried()]);
    await expect(R.resumePendingResolutions(NOW)).resolves.toBe(0);
    expect(Outage.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Outage.updateOne).not.toHaveBeenCalled();

    g.release();
    await done;
    expect(Outage.updateOne).toHaveBeenCalledTimes(1);
    expect(scheduleSessionResolution).toHaveBeenCalledTimes(1);
  });
});
