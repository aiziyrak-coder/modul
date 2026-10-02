"use strict";

const mongoose = require("mongoose");
const SamsOrgDay = require("./samsOrgDay.model");
const SamsPresence = require("./samsPresence.model");
const { isFinalRow } = require("./samsContract");
const { addDays, deliveryState, isFinal } = require("./samsDayState");
const C = require("./samsMonitorConfig");

const coverage = (org) =>
  org && org.expectedResidents > 0 ? org.scannedResidents / org.expectedResidents : null;

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const isSample = (row) => isFinal(row) && row.measured === true && row.expectedResidents > 0 && row.scannedResidents > 0;

function clinicBaseline(rows, beforeDay) {
  const from = addDays(beforeDay, -C.BASELINE_LOOKBACK_DAYS);
  const samples = [...rows]
    .filter((r) => r.day < beforeDay && r.day >= from && isSample(r))
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, C.BASELINE_DAYS)
    .map(coverage);
  return samples.length >= C.MIN_SAMPLES ? median(samples) : null;
}

function coverageStatus(org, baseline) {
  if (!org) return null;
  if (!isFinal(org)) return "provisional";
  if (!(org.expectedResidents > 0)) return "empty";
  if (!(org.scannedResidents > 0)) return "zero";
  if (baseline === null || baseline === undefined) return "no_baseline";
  return coverage(org) < C.LOW_COVERAGE_FACTOR * baseline ? "low" : "normal";
}

const isEligible = (p, org) =>
  p.measured === true && isFinalRow(p, org) && org.measured === true && org.scannedResidents > 0;

const share = (days) => (days.length >= C.MIN_SAMPLES ? days.filter((d) => d.hasRecords).length / days.length : null);

function summarizePerson(days) {
  const newest = [...days].sort((a, b) => (a.day < b.day ? 1 : -1));
  let streak = 0;
  for (const d of newest) {
    if (d.hasRecords) break;
    if (d.eligible) streak += 1;
  }
  const eligible = newest.filter((d) => d.eligible);
  const beforeStreak = eligible.slice(streak);
  const baselineRate = share(beforeStreak.slice(0, C.BASELINE_DAYS));
  return {
    eligibleDays: eligible.length,
    daysWithRecords: eligible.filter((d) => d.hasRecords).length,
    rate: share(eligible.slice(0, C.BASELINE_DAYS)),
    baselineRate,
    silentStreak: streak,
    lastRecordDay: newest.find((d) => d.hasRecords)?.day ?? null,
    suspectSilent: baselineRate !== null && baselineRate >= C.SILENT_BASELINE_RATE && streak >= C.SILENT_MIN_DAYS,
  };
}

const orgKey = (dbname, day) => `${dbname}|${day}`;

async function orgRowsFor(presence, from, to) {
  const dbnames = [...new Set(presence.map((p) => p.dbname).filter(Boolean))];
  if (dbnames.length === 0) return new Map();
  const rows = await SamsOrgDay.find({ dbname: { $in: dbnames }, day: { $gte: from, $lte: to } })
    .select("dbname day packetAt receivedAt measured unmeasuredReason scannedResidents")
    .lean();
  return new Map(rows.map((r) => [orgKey(r.dbname, r.day), r]));
}

const newestDbname = (rows) =>
  [...rows].sort((a, b) => (a.day < b.day ? 1 : -1)).find((r) => r.dbname)?.dbname ?? null;

async function personDetail(residentId, { to, now, cfg }) {
  const from = addDays(to, -C.BASELINE_LOOKBACK_DAYS);
  const rows = await SamsPresence.find({ resident: residentId, day: { $gte: from, $lte: to } })
    .select("day dbname measured unmeasuredReason packetAt recordCount")
    .sort({ day: 1 })
    .lean();
  const orgs = await orgRowsFor(rows, from, to);
  const days = [];
  const measured = [];
  for (const p of rows) {
    const org = orgs.get(orgKey(p.dbname, p.day)) ?? null;
    const hasRecords = p.recordCount > 0;
    days.push({
      day: p.day,
      measured: p.measured,
      unmeasuredReason: p.unmeasuredReason ?? null,
      delivery: deliveryState(org, now, cfg),
      clinicAlive: Boolean(org) && org.measured === true && org.scannedResidents > 0,
      hasRecords,
    });
    if (p.measured) measured.push({ day: p.day, hasRecords, eligible: Boolean(org) && isEligible(p, org) });
  }
  return { from, to, dbname: newestDbname(rows), ...summarizePerson(measured), days };
}

async function personBaselines(residentIds, { to }) {
  const from = addDays(to, -C.BASELINE_LOOKBACK_DAYS);
  const ids = residentIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const presence = await SamsPresence.aggregate([
    { $match: { resident: { $in: ids }, day: { $gte: from, $lte: to }, measured: true } },
    {
      $project: {
        resident: 1, day: 1, dbname: 1, packetAt: 1, measured: 1,
        hasRecords: { $gt: [{ $size: { $ifNull: ["$records", []] } }, 0] },
      },
    },
  ]);
  const orgs = await orgRowsFor(presence, from, to);
  const byResident = new Map(ids.map((id) => [String(id), []]));
  for (const p of presence) {
    const org = orgs.get(orgKey(p.dbname, p.day));
    byResident.get(String(p.resident))?.push({ day: p.day, hasRecords: p.hasRecords, eligible: Boolean(org) && isEligible(p, org) });
  }
  return new Map([...byResident].map(([id, days]) => [id, summarizePerson(days)]));
}

module.exports = {
  coverage,
  median,
  clinicBaseline,
  coverageStatus,
  isEligible,
  summarizePerson,
  personBaselines,
  personDetail,
  orgRowsFor,
  orgKey,
};
