"use strict";

jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const ENV = [
  "RESIDENCY_SAMS_TICK_MINUTES",
  "RESIDENCY_SAMS_STALE_TICKS",
  "RESIDENCY_SAMS_CLOSE_GRACE_HOURS",
  "RESIDENCY_SAMS_RESEND_MAX_DAYS",
  "RESIDENCY_SAMS_DIGEST_HOUR",
];

let config;
let winston;
beforeEach(() => {
  for (const k of ENV) delete process.env[k];
  jest.isolateModules(() => {
    config = require("./samsMonitorConfig");
    winston = require("#shared/winston.logger");
  });
});
afterAll(() => {
  for (const k of ENV) delete process.env[k];
});

describe("monitorConfig", () => {
  it("standartlar: 15 daq × 2 tik = 30 daq, 6 soat, 30 kun, 10:00", () => {
    expect(config.monitorConfig()).toEqual({
      tickMinutes: 15, staleTicks: 2, closeGraceHours: 6, resendMaxDays: 30, digestHour: 10,
      staleAfterMs: 30 * 60_000, closeGraceMs: 6 * 3_600_000,
    });
    expect(winston.warn).not.toHaveBeenCalled();
  });

  it("yaroqli qiymatlar (chegaralar ham) qabul qilinadi", () => {
    Object.assign(process.env, {
      RESIDENCY_SAMS_TICK_MINUTES: "5", RESIDENCY_SAMS_STALE_TICKS: "8", RESIDENCY_SAMS_CLOSE_GRACE_HOURS: "23",
      RESIDENCY_SAMS_RESEND_MAX_DAYS: "7", RESIDENCY_SAMS_DIGEST_HOUR: "0",
    });
    expect(config.monitorConfig()).toMatchObject({
      tickMinutes: 5, staleTicks: 8, closeGraceHours: 23, resendMaxDays: 7, digestHour: 0,
      staleAfterMs: 40 * 60_000, closeGraceMs: 23 * 3_600_000,
    });
  });

  it.each([
    ["RESIDENCY_SAMS_TICK_MINUTES", "4", "tickMinutes", 15],
    ["RESIDENCY_SAMS_STALE_TICKS", "1", "staleTicks", 2],
    ["RESIDENCY_SAMS_CLOSE_GRACE_HOURS", "24", "closeGraceHours", 6],
    ["RESIDENCY_SAMS_RESEND_MAX_DAYS", "31", "resendMaxDays", 30],
    ["RESIDENCY_SAMS_DIGEST_HOUR", "10.5", "digestHour", 10],
    ["RESIDENCY_SAMS_DIGEST_HOUR", "abc", "digestHour", 10],
  ])("%s=%s → standart, bitta ogohlantirish (qayta o'qishda takrorlanmaydi)", (env, raw, key, def) => {
    process.env[env] = raw;
    expect(config.monitorConfig()[key]).toBe(def);
    expect(config.monitorConfig()[key]).toBe(def);
    expect(winston.warn).toHaveBeenCalledTimes(1);
    expect(winston.warn.mock.calls[0][0]).toContain(env);
  });

  it("statistik konstantalar", () => {
    expect(config).toMatchObject({
      BASELINE_DAYS: 20, MIN_SAMPLES: 5, BASELINE_LOOKBACK_DAYS: 45, LOW_COVERAGE_FACTOR: 0.5,
      SILENT_MIN_DAYS: 3, SILENT_BASELINE_RATE: 0.8, LIVE_DAYS: 2, WATCHDOG_LOOKBACK_DAYS: 92,
      MAX_RANGE_DAYS: 62, TENANT_LOOKBACK_HOURS: 24, TENANT_REPORT_DAYS: 7,
    });
  });
});
