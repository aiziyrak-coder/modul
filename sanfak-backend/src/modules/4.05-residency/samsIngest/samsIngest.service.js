"use strict";

const winston = require("#shared/winston.logger");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");
const SamsPresence = require("./samsPresence.model");
const SamsOrgDay = require("./samsOrgDay.model");
const SamsSyncState = require("./samsSyncState.model");
const { parsePacket } = require("./samsIngest.validation");
const { assertPacket } = require("./samsPacketRules");
const { buildRows, supersedeFilter } = require("./samsRows");
const { upsertNewer, makeEnsureIndexes } = require("./samsBulk");
const { rosterFilter, getRoster, clearResendIfCovered } = require("./samsRoster.service");
const { SAMS_SCHEMA_VERSION, enumerateDays } = require("./samsContract");

const PRESENCE_KEY = ["resident", "day"];
const ORG_DAY_KEY = ["dbname", "day"];

const ensureIndexesOnce = makeEnsureIndexes([SamsPresence, SamsOrgDay, SamsSyncState]);

const packetJshshirs = (packet) => [
  ...new Set([
    ...packet.tenants.flatMap((t) => t.people.map((p) => p.jshshir)),
    ...packet.unresolved,
    ...packet.ambiguous.map((a) => a.jshshir),
  ]),
];

async function residentIdsFor(packet) {
  const docs = await Resident.find({
    $and: [rosterFilter(), { jshshir: { $in: packetJshshirs(packet) } }],
  })
    .select("_id jshshir")
    .lean();
  return new Map(docs.map((d) => [d.jshshir, d._id]));
}

function warnOnOffset(packet) {
  const offset = packet.serverUtcOffsetMinutes;
  if (offset !== undefined && offset !== UZ_OFFSET_MINUTES) {
    winston.warn(`[residency-sams] serverUtcOffsetMinutes=${offset} (kutilgan ${UZ_OFFSET_MINUTES})`);
  }
}

async function supersedeUnrefreshed(packet, days) {
  const filter = supersedeFilter(packet, days);
  if (!filter) return 0;
  const res = await SamsPresence.updateMany(filter, { $set: { measured: false, unmeasuredReason: "stale" } });
  return res.modifiedCount;
}

async function monitorHook(name, fn) {
  try {
    return await fn();
  } catch (err) {
    winston.error(`[residency-sams] monitor ilgagi (${name}) yiqildi: ${err.message}`);
    return null;
  }
}

const logPacket = (packet, receivedAt) =>
  monitorHook("packetLog", () => require("./samsPacketLog").recordPacket(packet, receivedAt));

const deliveredThroughAt = (receivedAt) =>
  monitorHook("watermark", async () => (await require("./samsDelivery").computeWatermark(receivedAt)).deliveredThrough);

function scheduleResolution(days) {
  try {
    require("#modules/4.05-residency/_services/samsPresenceSync").scheduleSessionResolution({ days });
  } catch (err) {
    winston.error(`[residency-sams] sessiya yechimi rejalashtirilmadi: ${err.message}`);
  }
}

function logSummary(packet, result, startedAt) {
  const { window, presence, orgDays, residents } = result;
  winston.info(
    `[residency-sams] ingest window=${window.from}..${window.to} tenants=${packet.tenants.length} ` +
      `presence=${presence.rows}/${presence.stale} superseded=${presence.superseded} ` +
      `orgDays=${orgDays.rows}/${orgDays.stale} ` +
      `unknown=${residents.unknown} conflicts=${residents.conflicts} ms=${Date.now() - startedAt}`,
  );
}

async function ingestPacket(body, now, clock = () => now) {
  const startedAt = Date.now();
  const packet = parsePacket(body);
  assertPacket(packet, now);
  warnOnOffset(packet);
  const days = enumerateDays(packet.window.from, packet.window.to);
  const residentIds = await residentIdsFor(packet);
  const { presenceRows, orgDayRows, stats } = buildRows(packet, residentIds, now, days);
  await ensureIndexesOnce();
  const presence = await upsertNewer(SamsPresence, presenceRows, PRESENCE_KEY);
  presence.superseded = await supersedeUnrefreshed(packet, days);
  const orgDays = await upsertNewer(SamsOrgDay, orgDayRows, ORG_DAY_KEY);
  scheduleResolution(days);
  await logPacket(packet, now);
  const resendCleared = await clearResendIfCovered(packet, now, clock);
  const deliveredThrough = await deliveredThroughAt(now);
  const result = {
    accepted: true,
    status: "ok",
    schemaVersion: SAMS_SCHEMA_VERSION,
    window: packet.window,
    emittedAt: packet.emittedAt.toISOString(),
    presence,
    orgDays,
    residents: stats,
    resendCleared,
    deliveredThrough,
  };
  logSummary(packet, result, startedAt);
  return result;
}

module.exports = { ingestPacket, getRoster };
