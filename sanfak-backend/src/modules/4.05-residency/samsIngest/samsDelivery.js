"use strict";

const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const SamsOrgDay = require("./samsOrgDay.model");
const { latestPacket } = require("./samsPacketLog");
const { addDays, dayRange, deliveryState, isOverdue } = require("./samsDayState");
const { monitorConfig, BASELINE_LOOKBACK_DAYS, LIVE_DAYS } = require("./samsMonitorConfig");

const DAY_MS = 86_400_000;
const WINDOW_FIELDS =
  "dbname day orgTitle packetAt receivedAt measured unmeasuredReason expectedResidents scannedResidents rosterScanCount deviceMix";

const maxDate = (a, b) => (!a || (b && b > a) ? b : a);

async function loadClinicMeta(dbname) {
  const match = dbname ? [{ $match: { dbname } }] : [];
  const [firsts, lasts] = await Promise.all([
    SamsOrgDay.aggregate([...match, { $sort: { dbname: 1, day: 1 } }, { $group: { _id: "$dbname", firstDay: { $first: "$day" } } }]),
    SamsOrgDay.aggregate([
      ...match,
      { $sort: { dbname: -1, day: -1 } },
      {
        $group: {
          _id: "$dbname",
          lastDay: { $first: "$day" },
          orgTitle: { $first: "$orgTitle" },
          lastReceivedAt: { $first: "$receivedAt" },
        },
      },
    ]),
  ]);
  const meta = new Map(firsts.map((f) => [f._id, { firstDay: f.firstDay }]));
  for (const l of lasts) meta.set(l._id, { ...meta.get(l._id), lastDay: l.lastDay, orgTitle: l.orgTitle, lastReceivedAt: l.lastReceivedAt });
  return meta;
}

async function clinicTitles() {
  const meta = await loadClinicMeta();
  return new Map([...meta].map(([dbname, m]) => [dbname, m.orgTitle ?? ""]));
}

async function loadOrgRows(dbnames, from, to) {
  if (dbnames.length === 0) return [];
  return SamsOrgDay.find({ dbname: { $in: dbnames }, day: { $gte: from, $lte: to } })
    .select(WINDOW_FIELDS)
    .lean();
}

async function loadWindow(now, dbname) {
  const today = uzDayKey(now);
  const meta = await loadClinicMeta(dbname);
  const rows = await loadOrgRows([...meta.keys()], addDays(today, -(BASELINE_LOOKBACK_DAYS + 1)), today);
  return { today, meta, rowsByClinic: groupRows(rows) };
}

function groupRows(rows) {
  const byClinic = new Map();
  for (const row of rows) {
    if (!byClinic.has(row.dbname)) byClinic.set(row.dbname, new Map());
    byClinic.get(row.dbname).set(row.day, row);
  }
  return byClinic;
}

function lastPacketAtOf(byDay, meta) {
  let last = meta?.lastReceivedAt ?? null;
  for (const row of byDay.values()) last = maxDate(last, row.receivedAt);
  return last;
}

function rosterScope(packet) {
  if (!Array.isArray(packet?.tenantDbnames)) return null;
  return new Set([...packet.tenantDbnames, ...(packet.failedTenants ?? []).map((f) => f.dbname)]);
}

function isLive({ dbname, lastPacketAt, now, scope }) {
  if (!lastPacketAt || now.getTime() - new Date(lastPacketAt).getTime() > LIVE_DAYS * DAY_MS) return false;
  return !scope || scope.has(dbname);
}

function summarizeClinic({ dbname, byDay, meta, now, cfg, scope = null }) {
  const today = uzDayKey(now);
  const yesterday = addDays(today, -1);
  const oldest = addDays(today, -cfg.resendMaxDays);
  const floor = meta.firstDay > oldest ? meta.firstDay : oldest;
  const gaps = dayRange(floor, yesterday)
    .map((day) => ({ day, delivery: deliveryState(byDay.get(day), now, cfg) }))
    .filter((g) => g.delivery !== "final");
  const lastPacketAt = lastPacketAtOf(byDay, meta);
  return {
    dbname,
    orgTitle: meta.orgTitle ?? "",
    firstDay: meta.firstDay,
    lastDay: meta.lastDay,
    lastPacketAt,
    live: isLive({ dbname, lastPacketAt, now, scope }),
    deliveredThrough: gaps.length ? addDays(gaps[0].day, -1) : yesterday,
    gaps,
    resendFrom: gaps.length && isOverdue(gaps[0].day, now, cfg) ? gaps[0].day : null,
  };
}

const minDay = (days) => (days.length ? days.reduce((a, b) => (b < a ? b : a)) : null);

function globalWatermark(summaries, now, cfg) {
  const live = summaries.filter((s) => s.live);
  const overdue = live.flatMap((s) => s.gaps.filter((g) => isOverdue(g.day, now, cfg)).map((g) => g.day));
  return {
    deliveredThrough: minDay(live.map((s) => s.deliveredThrough)),
    resendFrom: minDay(live.map((s) => s.resendFrom).filter(Boolean)),
    gapDays: new Set(overdue).size,
    oldestGap: minDay(overdue),
  };
}

async function deliverySnapshot(now = new Date()) {
  const cfg = monitorConfig();
  const [window, lastPacket] = await Promise.all([loadWindow(now), latestPacket()]);
  const scope = rosterScope(lastPacket);
  const clinics = [...window.meta].map(([dbname, meta]) =>
    summarizeClinic({ dbname, byDay: window.rowsByClinic.get(dbname) ?? new Map(), meta, now, cfg, scope }),
  );
  return { ...window, cfg, lastPacket, clinics, watermark: globalWatermark(clinics, now, cfg) };
}

async function computeWatermark(now = new Date()) {
  const { watermark } = await deliverySnapshot(now);
  return { deliveredThrough: watermark.deliveredThrough, resendFrom: watermark.resendFrom };
}

async function computeResendFrom(now = new Date()) {
  return (await computeWatermark(now)).resendFrom;
}

function gapsInRange({ byDay, meta, days, now, cfg }) {
  const yesterday = addDays(uzDayKey(now), -1);
  const entries = days.map((day) => ({
    day,
    row: byDay.get(day) ?? null,
    delivery: day < meta.firstDay ? "not_started" : deliveryState(byDay.get(day), now, cfg),
  }));
  const gaps = entries
    .filter((e) => e.delivery !== "not_started" && e.delivery !== "final" && e.day <= yesterday)
    .map((e) => ({ day: e.day, delivery: e.delivery }));
  return { entries, gaps };
}

module.exports = {
  loadClinicMeta,
  loadOrgRows,
  loadWindow,
  groupRows,
  clinicTitles,
  rosterScope,
  summarizeClinic,
  globalWatermark,
  deliverySnapshot,
  computeWatermark,
  computeResendFrom,
  gapsInRange,
};
