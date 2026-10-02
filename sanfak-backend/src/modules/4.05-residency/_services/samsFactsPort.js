"use strict";

const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const Outage = require("#modules/4.05-residency/residencySamsOutage/residencySamsOutage.model");
const { isDayKey } = require("#modules/4.05-residency/samsIngest/samsContract");
const { countsForAccrual } = require("#modules/4.05-residency/samsIngest/samsDayState");

const SCAN_IN = 1;
const SCAN_OUT = 2;

const PRESENCE_FIELDS = "resident day dbname measured unmeasuredReason records packetAt";
const ORG_DAY_FIELDS = "dbname day measured unmeasuredReason packetAt";

const EMPTY = () => ({ presence: new Map(), outages: [] });

const deviceOf = (mark) => (Number.isInteger(mark?.device) ? mark.device : null);
const textOrNull = (v) => (typeof v === "string" ? v : null);

function toRecord(record) {
  const marks = Array.isArray(record?.deviceType) ? record.deviceType : [];
  const ins = marks.filter((m) => m?.type === SCAN_IN);
  const outs = marks.filter((m) => m?.type === SCAN_OUT);
  return {
    accessTime: textOrNull(record?.accessTime),
    exitTime: textOrNull(record?.exitTime),
    inDevice: ins.length ? deviceOf(ins[0]) : null,
    outDevice: outs.length ? deviceOf(outs[outs.length - 1]) : null,
  };
}

const earliest = (a, b) => new Date(Math.min(new Date(a).getTime(), new Date(b).getTime()));

function toFacts(row, org) {
  const measured = row.measured === true && org?.measured === true;
  const reason = row.measured === true ? org?.unmeasuredReason : row.unmeasuredReason;
  return {
    measured,
    reason: measured ? null : reason ?? null,
    dbname: row.dbname ?? null,
    packetAt: countsForAccrual(row, org) ? earliest(row.packetAt, org.packetAt) : null,
    records: (Array.isArray(row.records) ? row.records : []).map(toRecord),
  };
}

async function activeOutages(day) {
  const docs = await Outage.find({ cancelledAt: null, from: { $lte: day }, to: { $gte: day } })
    .select("from to dbname")
    .lean();
  return docs.map((o) => ({ fromDay: o.from, toDay: o.to, dbname: o.dbname ?? null }));
}

async function orgDaysOf(day, rows) {
  const dbnames = [...new Set(rows.map((r) => r.dbname).filter(Boolean))];
  if (!dbnames.length) return new Map();
  const docs = await SamsOrgDay.find({ day, dbname: { $in: dbnames } }).select(ORG_DAY_FIELDS).lean();
  return new Map(docs.map((o) => [o.dbname, o]));
}

async function loadSessionFacts({ day, residentIds } = {}) {
  const ids = Array.isArray(residentIds) ? residentIds : [];
  if (!isDayKey(day) || ids.length === 0) return EMPTY();
  const rows = await SamsPresence.find({ day, resident: { $in: ids } }).select(PRESENCE_FIELDS).lean();
  const [orgBy, outages] = await Promise.all([orgDaysOf(day, rows), activeOutages(day)]);
  const presence = new Map(
    rows.map((r) => [String(r.resident), toFacts(r, r.dbname ? orgBy.get(r.dbname) ?? null : null)]),
  );
  return { presence, outages };
}

module.exports = { loadSessionFacts, toFacts, toRecord };
