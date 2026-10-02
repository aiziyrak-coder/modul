"use strict";

const { ErrorHandler } = require("#shared/error");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("./samsPresence.model");
const SamsAlert = require("./samsAlert.model");
const D = require("./samsDelivery");
const B = require("./samsBaseline");
const { addDays, dayRange, deliveryState } = require("./samsDayState");
const { collectWarnings, referenceDay, latestDay } = require("./samsWarnings");
const { tenantChanges } = require("./samsPacketLog");
const { livenessOf } = require("./samsDigest");
const { daysInclusive } = require("./samsContract");
const C = require("./samsMonitorConfig");

const DAY_MS = 86_400_000;
const DEFAULT_SPAN_DAYS = 30;

const configView = (cfg) => ({
  tickMinutes: cfg.tickMinutes,
  staleAfterMinutes: cfg.staleAfterMs / 60_000,
  closeGraceHours: cfg.closeGraceHours,
  resendMaxDays: cfg.resendMaxDays,
});

const packetView = (p) =>
  p && {
    receivedAt: p.receivedAt,
    emittedAt: p.emittedAt,
    lagSeconds: Math.round((new Date(p.receivedAt) - new Date(p.emittedAt)) / 1000),
    window: p.window,
    trigger: p.trigger ?? null,
    tenantsScanned: p.tenantsScanned,
    tenantsWithResidents: p.tenantsWithResidents,
    peopleCount: p.peopleCount,
    unresolvedCount: p.unresolvedCount,
    ambiguousCount: p.ambiguousCount,
    failedTenants: p.failedTenants ?? [],
  };

const NO_ROW = {
  measured: null,
  unmeasuredReason: null,
  expectedResidents: null,
  scannedResidents: null,
  packetAt: null,
  receivedAt: null,
};

function orgCell(row, rows, now, cfg) {
  const baselineCoverage = row ? B.clinicBaseline(rows, row.day) : null;
  const facts = row
    ? {
        measured: row.measured,
        unmeasuredReason: row.unmeasuredReason ?? null,
        expectedResidents: row.expectedResidents,
        scannedResidents: row.scannedResidents,
        packetAt: row.packetAt,
        receivedAt: row.receivedAt,
      }
    : NO_ROW;
  return {
    delivery: deliveryState(row, now, cfg),
    ...facts,
    coverage: B.coverage(row),
    baselineCoverage,
    coverageStatus: B.coverageStatus(row, baselineCoverage),
  };
}

async function recentTenantChanges(now) {
  const changes = await tenantChanges(now.getTime() - C.TENANT_REPORT_DAYS * DAY_MS);
  return changes.reverse().map(({ at, from, to, added, removed }) => ({ at, from, to, added, removed }));
}

const clinicHead = (c) => ({
  dbname: c.dbname,
  orgTitle: c.orgTitle,
  live: c.live,
  firstDay: c.firstDay,
  lastDay: c.lastDay,
  lastPacketAt: c.lastPacketAt,
  deliveredThrough: c.deliveredThrough,
});

const countsOf = (w) => ({
  unresolved: w.unresolved.count,
  ambiguous: w.ambiguous.count,
  noSchedule: w.noSchedule.count,
  inactiveUser: w.inactiveUser.count,
});

async function overview(now = new Date()) {
  const snap = await D.deliverySnapshot(now);
  const { today, cfg } = snap;
  const titles = new Map(snap.clinics.map((c) => [c.dbname, c.orgTitle]));
  const allRows = [...snap.rowsByClinic.values()].flatMap((byDay) => [...byDay.values()]);
  const day = referenceDay(today, allRows);
  const last = snap.lastPacket;
  const [warnings, changes] = await Promise.all([collectWarnings(day, { titles }), recentTenantChanges(now)]);
  const clinics = snap.clinics.map((c) => {
    const byDay = snap.rowsByClinic.get(c.dbname) ?? new Map();
    return { ...clinicHead(c), gapCount: c.gaps.length, today: orgCell(byDay.get(today) ?? null, byDay.values(), now, cfg) };
  });
  return {
    now: now.toISOString(),
    today,
    config: configView(cfg),
    liveness: { state: livenessOf(last, now, cfg), lastPacket: packetView(last) ?? null },
    delivery: snap.watermark,
    clinics,
    warnings: { day, ...countsOf(warnings), tenantSetChanged: changes[0] ?? null },
  };
}

function resolveRange({ from, to }, today) {
  const end = to ?? today;
  const start = from ?? addDays(end, -(DEFAULT_SPAN_DAYS - 1));
  const bad = start > end || end > today || daysInclusive(start, end) > C.MAX_RANGE_DAYS;
  if (bad) {
    throw new ErrorHandler(400, `Oraliq noto'g'ri: ${start}..${end} (≤${C.MAX_RANGE_DAYS} kun, bugundan kech emas)`, "", {
      reason: "range_invalid",
    });
  }
  return { from: start, to: end };
}

const dayCell = (e, cell) => ({
  day: e.day,
  delivery: e.delivery,
  measured: cell.measured,
  unmeasuredReason: cell.unmeasuredReason,
  expectedResidents: cell.expectedResidents,
  scannedResidents: cell.scannedResidents,
  rosterScanCount: e.row?.rosterScanCount ?? null,
  coverage: cell.coverage,
  coverageStatus: cell.coverageStatus,
  deviceMix: e.row?.deviceMix ?? null,
  packetAt: cell.packetAt,
  receivedAt: cell.receivedAt,
});

function clinicDaysView({ dbname, meta, byDay, days, now, cfg }) {
  const { entries, gaps } = D.gapsInRange({ byDay, meta, days, now, cfg });
  return {
    dbname,
    orgTitle: meta.orgTitle ?? "",
    firstDay: meta.firstDay,
    gaps,
    days: entries.map((e) => dayCell(e, orgCell(e.row, byDay.values(), now, cfg))),
  };
}

async function days(query, now = new Date()) {
  const cfg = C.monitorConfig();
  const range = resolveRange(query, uzDayKey(now));
  const snap = await D.deliverySnapshot(now);
  const meta = query.dbname ? new Map([...snap.meta].filter(([d]) => d === query.dbname)) : snap.meta;
  const rows = await D.loadOrgRows([...meta.keys()], addDays(range.from, -C.BASELINE_LOOKBACK_DAYS), range.to);
  const byClinic = D.groupRows(rows);
  const list = dayRange(range.from, range.to);
  const summary = new Map(snap.clinics.map((c) => [c.dbname, c]));
  const clinics = [...meta].map(([dbname, m]) => ({
    ...clinicDaysView({ dbname, meta: m, byDay: byClinic.get(dbname) ?? new Map(), days: list, now, cfg }),
    live: summary.get(dbname)?.live ?? false,
    lastPacketAt: summary.get(dbname)?.lastPacketAt ?? null,
    deliveredThrough: summary.get(dbname)?.deliveredThrough ?? null,
  }));
  return { ...range, deliveredThrough: snap.watermark.deliveredThrough, resendFrom: snap.watermark.resendFrom, clinics };
}

async function lastDigest() {
  return SamsAlert.findOne({ kind: "digest" }).sort({ createdAt: -1 }).select("day payload").lean();
}

async function warnings(query, now = new Date()) {
  const day = query.day ?? (await latestDay(uzDayKey(now)));
  const [titles, digest, changes] = await Promise.all([D.clinicTitles(), lastDigest(), recentTenantChanges(now)]);
  const w = await collectWarnings(day, { titles, prevKeys: new Set(digest?.payload?.keys ?? []) });
  return {
    day,
    digestDay: digest?.day ?? null,
    unresolved: w.unresolved,
    ambiguous: w.ambiguous,
    noSchedule: w.noSchedule,
    inactiveUser: w.inactiveUser,
    tenantSetChanged: { changes },
  };
}

const byDrillOrder = (a, b) =>
  Number(b.baseline.suspectSilent) - Number(a.baseline.suspectSilent) ||
  b.baseline.silentStreak - a.baseline.silentStreak ||
  String(a.fullName).localeCompare(String(b.fullName));

const recordView = (r) => ({ accessTime: r.accessTime, exitTime: r.exitTime, deviceType: r.deviceType });

async function clinicOrgCell(dbname, day, now, cfg) {
  const rows = await D.loadOrgRows([dbname], addDays(day, -C.BASELINE_LOOKBACK_DAYS), day);
  const org = rows.find((r) => r.day === day) ?? null;
  return org ? orgCell(org, rows, now, cfg) : null;
}

async function clinicDay({ dbname, day }, { page, limit }, now = new Date()) {
  const cfg = C.monitorConfig();
  const [org, presence, titles] = await Promise.all([
    clinicOrgCell(dbname, day, now, cfg),
    SamsPresence.find({ dbname, day }).select("resident measured unmeasuredReason hasShift samsUserActive records recordCount").lean(),
    D.clinicTitles(),
  ]);
  const ids = presence.map((p) => p.resident);
  const residents = new Map((await Resident.find({ _id: { $in: ids } }).select("fullName").lean()).map((r) => [String(r._id), r]));
  const yesterday = addDays(uzDayKey(now), -1);
  const baselines = await B.personBaselines(ids, { to: day < yesterday ? day : yesterday });
  const docs = presence
    .filter((p) => residents.has(String(p.resident)))
    .map((p) => ({
      resident: String(p.resident),
      fullName: residents.get(String(p.resident)).fullName,
      measured: p.measured,
      unmeasuredReason: p.unmeasuredReason ?? null,
      hasShift: p.hasShift ?? null,
      userActive: p.samsUserActive ?? null,
      recordCount: p.recordCount ?? p.records.length,
      records: p.records.map(recordView),
      baseline: baselines.get(String(p.resident)),
    }))
    .sort(byDrillOrder);
  const start = (page - 1) * limit;
  return {
    dbname, orgTitle: titles.get(dbname) ?? null, day, org,
    docs: docs.slice(start, start + limit),
    totalDocs: docs.length, page, limit, totalPages: Math.ceil(docs.length / limit),
  };
}

const residentExists = async (id) => Boolean(await Resident.findById(id).select("_id").lean());

async function residentBaseline(residentId, { to }, now = new Date()) {
  const cfg = C.monitorConfig();
  const end = to ?? addDays(uzDayKey(now), -1);
  const [detail, titles] = await Promise.all([B.personDetail(residentId, { to: end, now, cfg }), D.clinicTitles()]);
  return { resident: String(residentId), ...detail, orgTitle: detail.dbname ? titles.get(detail.dbname) ?? "" : null };
}

module.exports = { overview, days, warnings, clinicDay, residentBaseline, residentExists, resolveRange, orgCell };
