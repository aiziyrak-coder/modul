"use strict";

jest.mock("./sessionResolution", () => ({ resolveSessionDays: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const winston = require("#shared/winston.logger");
const { resolveSessionDays } = require("./sessionResolution");
const { scheduleSessionResolution: schedule, _idle } = require("./samsPresenceSync");

const D = (n) => `2026-10-${String(n).padStart(2, "0")}`;
const RESULT = { sessions: 2, changed: 1, recounted: 1, errors: 0 };
const calls = () => resolveSessionDays.mock.calls.map(([days, o]) => [days, o.force]);

function holdFirstPass() {
  const g = {};
  g.released = new Promise((r) => (g.release = r));
  g.arrived = new Promise((r) => (g.reached = r));
  resolveSessionDays.mockImplementationOnce(async () => {
    g.reached();
    await g.released;
    return RESULT;
  });
  return g;
}

beforeEach(() => {
  jest.clearAllMocks();
  resolveSessionDays.mockResolvedValue(RESULT);
});
afterEach(() => _idle());

describe("navbat va o'tishlar", () => {
  test("kunlar takrorsiz va tartiblangan; oddiy o'tish; yakun sonlari", async () => {
    const out = await schedule({ days: [D(3), D(1), D(3)] });
    expect(calls()).toEqual([[[D(1), D(3)], false]]);
    expect(out).toEqual({ runs: 1, days: 2, sessions: 2, changed: 1, recounted: 1, errors: 0 });
    expect(winston.info).toHaveBeenCalledWith(
      "[4.5 samsPresenceSync] yechim: runs=1 days=2 sessions=2 changed=1 recounted=1 errors=0",
    );
  });

  test.each([
    ["kun yo'q", { days: [] }],
    ["yaroqsiz kunlar", { days: ["2026-02-30", "bugun", null] }],
    ["massiv emas", { days: "2026-10-01" }],
    ["argumentsiz", undefined],
  ])("%s — o'tish yo'q, promise bajariladi", async (_l, scope) => {
    await expect(schedule(scope)).resolves.toMatchObject({ runs: 0, errors: 0 });
    expect(resolveSessionDays).not.toHaveBeenCalled();
  });
});

describe("birlashtirish — darvoza bilan ushlangan drenaj", () => {
  test("ushlangan paytdagi ikki so'rov — o'sha drenajda, bitta o'tishda", async () => {
    const g = holdFirstPass();
    const first = schedule({ days: [D(1)] });
    await g.arrived;
    const second = schedule({ days: [D(3), D(1)] });
    const third = schedule({ days: [D(2)] });
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(calls()).toEqual([[[D(1)], false]]);
    g.release();
    await expect(first).resolves.toMatchObject({ runs: 2, days: 4 });
    expect(calls()).toEqual([[[D(1)], false], [[D(1), D(2), D(3)], false]]);
  });

  test("majburiy va oddiy — alohida o'tish; ikkalasidagi kun faqat majburiyda", async () => {
    const g = holdFirstPass();
    schedule({ days: [D(9)] });
    await g.arrived;
    schedule({ days: [D(2), D(1)], force: true });
    schedule({ days: [D(2), D(3)] });
    g.release();
    await _idle();
    expect(calls()).toEqual([[[D(9)], false], [[D(1), D(2)], true], [[D(3)], false]]);
  });
});

describe("xato — hech qachon rad etilmaydi", () => {
  test("majburiy o'tish yiqildi — oddiy o'tish baribir; yakunda errors; logda kunlar oralig'i", async () => {
    const g = holdFirstPass();
    schedule({ days: [D(9)] });
    await g.arrived;
    resolveSessionDays.mockRejectedValueOnce(new Error("mongo down"));
    const p = schedule({ days: [D(3), D(1)], force: true });
    schedule({ days: [D(5)] });
    g.release();
    await expect(p).resolves.toMatchObject({ runs: 2, errors: 1 });
    expect(calls()).toEqual([[[D(9)], false], [[D(1), D(3)], true], [[D(5)], false]]);
    expect(winston.error).toHaveBeenCalledWith(
      "[4.5 samsPresenceSync] yechim o'tishi yiqildi force=true days=2026-10-01..2026-10-03 (2): mongo down",
    );
  });

  test.each([
    ["yiqildi", () => resolveSessionDays.mockRejectedValueOnce(new Error("x"))],
    ["sessiya xatosi bilan tugadi", () => resolveSessionDays.mockResolvedValueOnce({ ...RESULT, errors: 1 })],
  ])("majburiy o'tish %s — ustma-ust oddiy kun oddiy o'tishda qoladi (I3-Q10)", async (_l, failForced) => {
    const g = holdFirstPass();
    schedule({ days: [D(9)] });
    await g.arrived;
    failForced();
    schedule({ days: [D(2), D(1)], force: true });
    schedule({ days: [D(2), D(3)] });
    g.release();
    await _idle();
    expect(calls()).toEqual([[[D(9)], false], [[D(1), D(2)], true], [[D(2), D(3)], false]]);
  });

  test("qayta hisobi yiqilgan rezident (faqat loglaydi) — har biri xato; hammasi o'tsa — xato yo'q (I3-Q12)", async () => {
    resolveSessionDays
      .mockResolvedValueOnce({ ...RESULT, affected: ["r1", "r2", "r3"], recounted: 1 })
      .mockResolvedValueOnce({ ...RESULT, affected: ["r1", "r2"], recounted: 2 });
    await expect(schedule({ days: [D(1)] })).resolves.toMatchObject({ recounted: 1, errors: 2 });
    expect(winston.info).toHaveBeenLastCalledWith(
      "[4.5 samsPresenceSync] yechim: runs=1 days=1 sessions=2 changed=1 recounted=1 errors=2",
    );
    await expect(schedule({ days: [D(1)] })).resolves.toMatchObject({ recounted: 2, errors: 0 });
  });

  test("yiqilgan drenajdan keyin rejalashtiruvchi qayta ishlaydi", async () => {
    resolveSessionDays.mockRejectedValueOnce(new Error("x"));
    await expect(schedule({ days: [D(1)] })).resolves.toMatchObject({ errors: 1 });
    await expect(schedule({ days: [D(2)] })).resolves.toMatchObject({ runs: 1, errors: 0 });
  });
});

describe("onDone — xatosiz to'plam (I3-Q10)", () => {
  test("xatosiz o'tish — `true`; drenaj yakunidan OLDIN, bir marta", async () => {
    const order = [];
    const forced = jest.fn(() => order.push("forced"));
    const normal = jest.fn(() => order.push("normal"));
    winston.info.mockImplementationOnce(() => order.push("summary"));
    const g = holdFirstPass();
    const p = schedule({ days: [D(9)] });
    await g.arrived;
    schedule({ days: [D(1)], force: true, onDone: forced });
    schedule({ days: [D(2)], onDone: normal });
    g.release();
    await p;
    expect([forced.mock.calls, normal.mock.calls]).toEqual([[[true]], [[true]]]);
    expect(order).toEqual(["forced", "normal", "summary"]);
  });

  test("ushlangan drenaj paytidagi so'rov — KEYINGI to'plam tugagach (joriy to'plam eski holatni o'qigan)", async () => {
    const g = holdFirstPass();
    const first = jest.fn();
    const second = jest.fn();
    schedule({ days: [D(9)], force: true, onDone: first });
    await g.arrived;
    const next = { reached: null };
    const secondPass = new Promise((r) => (next.reached = r));
    resolveSessionDays.mockImplementationOnce(async () => {
      next.reached();
      expect([first.mock.calls, second.mock.calls]).toEqual([[[true]], []]);
      return RESULT;
    });
    schedule({ days: [D(1)], force: true, onDone: second });
    g.release();
    await secondPass;
    await _idle();
    expect(second.mock.calls).toEqual([[true]]);
  });

  test("yaroqli kun yo'q — navbat yo'q, `onDone` chaqirilmaydi", async () => {
    const done = jest.fn();
    await schedule({ days: ["bugun"], force: true, onDone: done });
    expect(done).not.toHaveBeenCalled();
  });
});

describe("onDone — xato bilan tugagan to'plam (I3-Q10)", () => {
  test.each([
    ["yiqildi", () => resolveSessionDays.mockRejectedValueOnce(new Error("x"))],
    ["sessiya xatosi bilan tugadi", () => resolveSessionDays.mockResolvedValueOnce({ ...RESULT, errors: 2 })],
    ["qayta hisobi yiqildi (I3-Q12)", () => resolveSessionDays.mockResolvedValueOnce({ ...RESULT, affected: ["r1", "r2"], recounted: 1 })],
  ])("majburiy o'tish %s — majburiy so'rov `false`, oddiy so'rov ham `false`", async (_l, failForced) => {
    const g = holdFirstPass();
    schedule({ days: [D(9)] });
    await g.arrived;
    failForced();
    const forced = jest.fn();
    const normal = jest.fn();
    schedule({ days: [D(1)], force: true, onDone: forced });
    schedule({ days: [D(2)], onDone: normal });
    g.release();
    await _idle();
    expect([forced.mock.calls, normal.mock.calls]).toEqual([[[false]], [[false]]]);
  });

  test("faqat oddiy o'tish yiqildi — majburiy so'rov `true`, oddiy `false`", async () => {
    const g = holdFirstPass();
    schedule({ days: [D(9)] });
    await g.arrived;
    resolveSessionDays.mockResolvedValueOnce(RESULT).mockRejectedValueOnce(new Error("x"));
    const forced = jest.fn();
    const normal = jest.fn();
    schedule({ days: [D(1)], force: true, onDone: forced });
    schedule({ days: [D(2)], onDone: normal });
    g.release();
    await _idle();
    expect(calls()).toEqual([[[D(9)], false], [[D(1)], true], [[D(2)], false]]);
    expect([forced.mock.calls, normal.mock.calls]).toEqual([[[true]], [[false]]]);
  });
});

describe("onDone — izolyatsiya (I3-Q10)", () => {
  test("yiqilgan `onDone` qolganlarini to'xtatmaydi, promise bajariladi", async () => {
    const bad = jest.fn(async () => {
      throw new Error("cas down");
    });
    const good = jest.fn();
    const g = holdFirstPass();
    const p = schedule({ days: [D(9)] });
    await g.arrived;
    schedule({ days: [D(1)], force: true, onDone: bad });
    schedule({ days: [D(1)], force: true, onDone: good });
    g.release();
    await expect(p).resolves.toMatchObject({ runs: 2, errors: 0 });
    expect(good).toHaveBeenCalledWith(true);
    expect(winston.error).toHaveBeenCalledWith("[4.5 samsPresenceSync] onDone yiqildi: cas down");
  });

  test("kutilmagan drenaj xatosi — `onDone(false)` baribir, promise bajariladi", async () => {
    resolveSessionDays.mockRejectedValueOnce(new Error("x"));
    winston.error.mockImplementationOnce(() => {
      throw new Error("log down");
    });
    const done = jest.fn();
    await expect(schedule({ days: [D(1)], force: true, onDone: done })).resolves.toMatchObject({ errors: 1 });
    expect(done).toHaveBeenCalledWith(false);
    expect(winston.error).toHaveBeenCalledWith("[4.5 samsPresenceSync] drenaj yiqildi: log down");
  });
});

describe("mikrotask poygasi — drenaj oxirgi tekshiruvidan keyingi so'rov", () => {
  test("`finally` qayta ishga tushiradi; `_idle` undan keyin tugaydi", async () => {
    winston.info.mockImplementationOnce(() => schedule({ days: [D(7)] }));
    await schedule({ days: [D(1)] });
    await _idle();
    expect(calls()).toEqual([[[D(1)], false], [[D(7)], false]]);
  });

  test("bo'sh rejalashtiruvchida `_idle` darhol tugaydi", async () => {
    await expect(_idle()).resolves.toBeUndefined();
  });
});
