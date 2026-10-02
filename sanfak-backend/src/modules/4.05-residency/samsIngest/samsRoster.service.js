"use strict";

const winston = require("#shared/winston.logger");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { PIN_RE } = require("#modules/4.05-residency/_services/residentAccount");
const { uzDayKey } = require("#modules/4.05-residency/_services/uzDay");
const SamsSyncState = require("./samsSyncState.model");
const {
  SAMS_SCHEMA_VERSION,
  RECONCILE_WINDOW_DAYS,
  addDays,
  enumerateDays,
  isDayKey,
  oldestAcceptedDay,
} = require("./samsContract");

const { SYNC_STATE_KEY } = SamsSyncState;

const rosterFilter = () => ({
  program: "ordinatura",
  active: true,
  status: { $in: [Resident.STATUS_IN_STUDY, null] },
  jshshir: { $regex: PIN_RE },
});

function effectiveResendFrom(stored, today) {
  if (!isDayKey(stored)) return null;
  const oldest = oldestAcceptedDay(today);
  if (stored < oldest) return oldest;
  return stored > today ? today : stored;
}

const readState = () => SamsSyncState.findOne({ key: SYNC_STATE_KEY }).lean();

const earlierDay = (a, b) => {
  if (!a) return b ?? null;
  return b && b < a ? b : a;
};

async function watermarkOf(now) {
  try {
    return await require("./samsDelivery").computeWatermark(now);
  } catch (err) {
    winston.error(`[residency-sams] roster: watermark hisoblanmadi: ${err.message}`);
    return { deliveredThrough: null, resendFrom: null };
  }
}

async function getRoster(now) {
  const today = uzDayKey(now);
  const [docs, state, watermark] = await Promise.all([
    Resident.find(rosterFilter()).select("jshshir -_id").lean(),
    readState(),
    watermarkOf(now),
  ]);
  const jshshirs = [...new Set(docs.map((d) => d.jshshir))].sort();
  return {
    schemaVersion: SAMS_SCHEMA_VERSION,
    serverTime: now.toISOString(),
    today,
    window: { from: addDays(today, -(RECONCILE_WINDOW_DAYS - 1)), to: today },
    resendFrom: earlierDay(effectiveResendFrom(state?.resendFrom ?? null, today), watermark.resendFrom),
    deliveredThrough: watermark.deliveredThrough,
    jshshirs,
  };
}

const canDeliverResend = (packet) =>
  packet.trigger !== "manual" && (packet.scan?.failedTenants?.length ?? 0) === 0;

const coversDays = (windows, from, to) =>
  enumerateDays(from, to).every((day) => windows.some((w) => w.from <= day && day <= w.to));

const readAfter = (packet, now, requestedAt) => now >= requestedAt && packet.emittedAt >= requestedAt;

async function cleanWindowsSince(since) {
  try {
    return await require("./samsPacketLog").cleanWindowsSince(since);
  } catch (err) {
    winston.error(`[residency-sams] resend: paket jurnali o'qilmadi: ${err.message}`);
    return [];
  }
}

async function stampRequest(state, packet, now, observedAt) {
  const at = new Date(Math.max(now.getTime(), packet.emittedAt.getTime() + 1, observedAt.getTime()));
  const clearedAt = state.resendClearedAt ?? null;
  await SamsSyncState.updateOne(
    { key: SYNC_STATE_KEY, resendFrom: state.resendFrom, resendRequestedAt: null, resendClearedAt: clearedAt },
    { $set: { resendRequestedAt: at } },
  );
  return false;
}

async function clearResendIfCovered(packet, now, clock = () => now) {
  if (!canDeliverResend(packet)) return false;
  const state = await readState();
  const today = uzDayKey(now);
  const effective = effectiveResendFrom(state?.resendFrom, today);
  if (!effective) return false;
  const requestedAt = state.resendRequestedAt ?? null;
  if (!requestedAt) return stampRequest(state, packet, now, clock());
  if (!readAfter(packet, now, requestedAt)) return false;
  const windows = [packet.window, ...(await cleanWindowsSince(requestedAt))];
  if (!coversDays(windows, effective, today)) return false;
  const res = await SamsSyncState.updateOne(
    { key: SYNC_STATE_KEY, resendFrom: state.resendFrom, resendRequestedAt: requestedAt },
    { $set: { resendFrom: null, resendRequestedAt: null, resendClearedAt: now } },
  );
  return res.modifiedCount === 1;
}

module.exports = { rosterFilter, getRoster, effectiveResendFrom, earlierDay, coversDays, clearResendIfCovered };
