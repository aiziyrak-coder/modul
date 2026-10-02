"use strict";

const winston = require("#shared/winston.logger");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const SamsOrgDay = require("./samsOrgDay.model");
const SamsPresence = require("./samsPresence.model");
const { addDays, isStale } = require("./samsDayState");
const { monitorConfig, WATCHDOG_LOOKBACK_DAYS } = require("./samsMonitorConfig");

const STALE_SET = { $set: { measured: false, unmeasuredReason: "stale" } };
const LOG_PAIRS = 10;

async function loadCandidates(dbnames, now, cfg) {
  const today = uzDayKey(now);
  const rows = await SamsOrgDay.find({
    dbname: { $in: dbnames },
    day: { $gte: addDays(today, -WATCHDOG_LOOKBACK_DAYS), $lte: today },
    measured: true,
    receivedAt: { $lt: new Date(now.getTime() - cfg.staleAfterMs) },
  })
    .select("dbname day packetAt receivedAt")
    .lean();
  return rows.filter((row) => isStale(row, now, cfg));
}

async function flipOne(row) {
  const presence = await SamsPresence.updateMany(
    { dbname: row.dbname, day: row.day, measured: true, receivedAt: { $lte: row.receivedAt } },
    STALE_SET,
  );
  const org = await SamsOrgDay.updateOne(
    { _id: row._id, measured: true, packetAt: row.packetAt, receivedAt: row.receivedAt },
    STALE_SET,
  );
  return { presence: presence.modifiedCount, org: org.modifiedCount };
}

function logFlipped(result, pairs) {
  const shown = pairs.slice(0, LOG_PAIRS).join(",");
  const more = pairs.length > LOG_PAIRS ? ` +${pairs.length - LOG_PAIRS}` : "";
  winston.warn(
    `[4.5:SAMS] watchdog: stale orgDays=${result.orgDays} (bugun=${result.todayOrgDays}) ` +
      `presence=${result.presence} kunlar=${shown}${more}`,
  );
}

async function markStaleDays(now = new Date()) {
  const result = { orgDays: 0, presence: 0, todayOrgDays: 0, lost: 0 };
  const dbnames = await SamsOrgDay.distinct("dbname");
  if (dbnames.length === 0) return result;
  const cfg = monitorConfig();
  const today = uzDayKey(now);
  const pairs = [];
  for (const row of await loadCandidates(dbnames, now, cfg)) {
    const flipped = await flipOne(row);
    result.presence += flipped.presence;
    if (flipped.org === 0) {
      result.lost += 1;
      winston.info(`[4.5:SAMS] watchdog: ${row.dbname}:${row.day} yangiroq paket yutdi — tegilmadi`);
      continue;
    }
    result.orgDays += 1;
    if (row.day === today) result.todayOrgDays += 1;
    pairs.push(`${row.dbname}:${row.day}`);
  }
  if (result.orgDays > 0 || result.presence > 0) logFlipped(result, pairs);
  return result;
}

module.exports = { markStaleDays, STALE_SET };
