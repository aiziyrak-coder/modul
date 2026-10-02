"use strict";

const winston = require("#shared/winston.logger");
const { MAX_PACKET_DAYS } = require("./samsContract");

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const KNOBS = {
  tickMinutes: { env: "RESIDENCY_SAMS_TICK_MINUTES", def: 15, min: 5, max: 60 },
  staleTicks: { env: "RESIDENCY_SAMS_STALE_TICKS", def: 2, min: 2, max: 8 },
  closeGraceHours: { env: "RESIDENCY_SAMS_CLOSE_GRACE_HOURS", def: 6, min: 1, max: 23 },
  resendMaxDays: { env: "RESIDENCY_SAMS_RESEND_MAX_DAYS", def: 30, min: 7, max: MAX_PACKET_DAYS - 1 },
  digestHour: { env: "RESIDENCY_SAMS_DIGEST_HOUR", def: 10, min: 0, max: 23 },
};

const CONSTANTS = Object.freeze({
  BASELINE_DAYS: 20,
  MIN_SAMPLES: 5,
  BASELINE_LOOKBACK_DAYS: 45,
  LOW_COVERAGE_FACTOR: 0.5,
  SILENT_MIN_DAYS: 3,
  SILENT_BASELINE_RATE: 0.8,
  LIVE_DAYS: 2,
  WATCHDOG_LOOKBACK_DAYS: 92,
  MAX_RANGE_DAYS: 62,
  TENANT_LOOKBACK_HOURS: 24,
  TENANT_REPORT_DAYS: 7,
  LIVENESS_DIGEST_DAYS: 7,
  LAST_KNOWN_CLINIC_DAYS: 92,
});

const warned = new Set();

function readKnob({ env, def, min, max }) {
  const raw = process.env[env];
  if (raw === undefined || raw === "") return def;
  const value = Number(raw);
  if (Number.isInteger(value) && value >= min && value <= max) return value;
  const mark = `${env}=${raw}`;
  if (!warned.has(mark)) {
    warned.add(mark);
    winston.warn(`[4.5:SAMS] ${env}="${raw}" yaroqsiz (butun ${min}..${max}) — standart ${def} ishlatiladi`);
  }
  return def;
}

function monitorConfig() {
  const cfg = Object.fromEntries(Object.entries(KNOBS).map(([k, knob]) => [k, readKnob(knob)]));
  cfg.staleAfterMs = cfg.staleTicks * cfg.tickMinutes * MINUTE_MS;
  cfg.closeGraceMs = cfg.closeGraceHours * HOUR_MS;
  return cfg;
}

module.exports = { monitorConfig, KNOBS, ...CONSTANTS };
