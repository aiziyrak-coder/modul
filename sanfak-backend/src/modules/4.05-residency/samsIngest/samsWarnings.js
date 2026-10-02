"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const SamsPresence = require("./samsPresence.model");
const SamsOrgDay = require("./samsOrgDay.model");
const { addDays } = require("./samsDayState");
const { LAST_KNOWN_CLINIC_DAYS } = require("./samsMonitorConfig");

const TYPES = ["unresolved", "ambiguous", "no_schedule", "inactive_user"];
const FLAGGED_REASONS = ["unresolved", "ambiguous", "no_schedule"];

function referenceDay(today, rows) {
  let best = null;
  for (const r of rows) if (r.day <= today && (best === null || r.day > best)) best = r.day;
  return best;
}

async function latestDay(today) {
  const dbnames = await SamsOrgDay.distinct("dbname");
  if (dbnames.length === 0) return null;
  const rows = await SamsOrgDay.find({ dbname: { $in: dbnames }, day: { $gte: addDays(today, -LAST_KNOWN_CLINIC_DAYS), $lte: today } })
    .select("day -_id")
    .lean();
  return referenceDay(today, rows);
}

async function flaggedRows(day) {
  const dbnames = await SamsOrgDay.distinct("dbname");
  return SamsPresence.find({
    dbname: { $in: [...dbnames, null] },
    day,
    $or: [{ unmeasuredReason: { $in: FLAGGED_REASONS } }, { samsUserActive: false }],
  })
    .select("resident dbname unmeasuredReason ambiguousDbnames samsUserActive")
    .lean();
}

async function lastKnownClinics(residentIds, day) {
  if (residentIds.length === 0) return new Map();
  const rows = await SamsPresence.aggregate([
    { $match: { resident: { $in: residentIds }, dbname: { $ne: null }, day: { $gte: addDays(day, -LAST_KNOWN_CLINIC_DAYS), $lt: day } } },
    { $sort: { resident: 1, day: -1 } },
    { $group: { _id: "$resident", dbname: { $first: "$dbname" } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.dbname]));
}

function typesOf(row) {
  const types = [];
  if (FLAGGED_REASONS.includes(row.unmeasuredReason)) types.push(row.unmeasuredReason);
  if (row.samsUserActive === false) types.push("inactive_user");
  return types;
}

const keyOf = (type, residentId) => `${type}:${residentId}`;

function groupByClinic(items, titles) {
  const groups = new Map();
  for (const item of items) {
    const dbname = item.dbname ?? null;
    if (!groups.has(dbname)) groups.set(dbname, { dbname, orgTitle: dbname ? titles.get(dbname) ?? "" : null, residents: [] });
    groups.get(dbname).residents.push(item.person);
  }
  return [...groups.values()].sort((a, b) => b.residents.length - a.residents.length);
}

function bucketize({ rows, residents, lastKnown, prevKeys }) {
  const byType = Object.fromEntries(TYPES.map((t) => [t, []]));
  for (const row of rows) {
    const r = residents.get(String(row.resident));
    if (!r) continue;
    for (const type of typesOf(row)) {
      const key = keyOf(type, r._id);
      const person = { resident: String(r._id), fullName: r.fullName, jshshir: r.jshshir ?? null, isNew: !prevKeys.has(key) };
      const dbname = type === "unresolved" ? lastKnown.get(String(r._id)) ?? null : row.dbname;
      byType[type].push({ dbname, person, key, ambiguousDbnames: row.ambiguousDbnames ?? [] });
    }
  }
  return byType;
}

const EMPTY = () => ({
  unresolved: { count: 0, groups: [] },
  ambiguous: { count: 0, items: [] },
  noSchedule: { count: 0, groups: [] },
  inactiveUser: { count: 0, groups: [] },
  keys: [],
});

function shape(byType, titles) {
  const clinicsOf = (dbnames) => dbnames.map((d) => ({ dbname: d, orgTitle: titles.get(d) ?? "" }));
  return {
    unresolved: { count: byType.unresolved.length, groups: groupByClinic(byType.unresolved, titles) },
    ambiguous: {
      count: byType.ambiguous.length,
      items: byType.ambiguous.map((i) => ({ ...i.person, clinics: clinicsOf(i.ambiguousDbnames) })),
    },
    noSchedule: { count: byType.no_schedule.length, groups: groupByClinic(byType.no_schedule, titles) },
    inactiveUser: { count: byType.inactive_user.length, groups: groupByClinic(byType.inactive_user, titles) },
    keys: TYPES.flatMap((t) => byType[t].map((i) => i.key)),
  };
}

async function collectWarnings(day, { titles, prevKeys = new Set() }) {
  if (!day) return EMPTY();
  const rows = await flaggedRows(day);
  if (rows.length === 0) return EMPTY();
  const ids = [...new Set(rows.map((r) => String(r.resident)))];
  const residents = await Resident.find({ _id: { $in: ids } }).select("fullName jshshir").lean();
  const unresolvedIds = rows.filter((r) => r.unmeasuredReason === "unresolved").map((r) => r.resident);
  const lastKnown = await lastKnownClinics(unresolvedIds, day);
  const byType = bucketize({ rows, residents: new Map(residents.map((r) => [String(r._id), r])), lastKnown, prevKeys });
  return shape(byType, titles);
}

const newKeys = (keys, prevKeys) => keys.filter((k) => !prevKeys.has(k));

module.exports = { TYPES, referenceDay, latestDay, collectWarnings, typesOf, keyOf, newKeys, bucketize, shape };
