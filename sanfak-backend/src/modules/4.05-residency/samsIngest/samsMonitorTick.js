"use strict";

const mongoose = require("mongoose");
const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { uzDayKey, UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");
const { officeUserIds } = require("#modules/4.05-residency/_services/officeRecipients");
const { EVENTS, LINKS } = require("#modules/4.05-residency/_services/residentNotify");
const SamsAlert = require("./samsAlert.model");
const { markStaleDays } = require("./samsFreshness");
const { tenantChanges, latestPacket } = require("./samsPacketLog");
const { digestContent, digestDelta, livenessOf, tenantChangeText, DIGEST_TITLE } = require("./samsDigest");
const { monitorConfig, TENANT_LOOKBACK_HOURS, LIVENESS_DIGEST_DAYS } = require("./samsMonitorConfig");
const { resumePendingResolutions } = require("#modules/4.05-residency/residencySamsOutage/outageResolution");

const DUPLICATE_KEY = 11000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const uzHour = (now) => new Date(now.getTime() + UZ_OFFSET_MINUTES * 60_000).getUTCHours();

async function claim(doc) {
  try {
    await SamsAlert.create(doc);
    return true;
  } catch (err) {
    if (err?.code === DUPLICATE_KEY) return false;
    throw err;
  }
}

const markSent = (key) => SamsAlert.updateOne({ key }, { $set: { sent: true } });

async function dispatchInApp(recipients, payload) {
  await Promise.all(
    recipients.map((userId) =>
      dispatch({ ...payload, userId, overrideChannels: { inApp: true } }).catch((err) =>
        winston.warn(`[4.5:SAMS] ${payload.eventType} yuborilmadi user=${userId}: ${err.message}`),
      ),
    ),
  );
}

async function alertTenantChanges(now) {
  const changes = await tenantChanges(now.getTime() - TENANT_LOOKBACK_HOURS * HOUR_MS);
  if (changes.length === 0) return 0;
  const recipients = await officeUserIds();
  if (recipients.length === 0) return 0;
  let sent = 0;
  for (const change of changes) {
    const key = `tenants:${change.packetId}`;
    const day = uzDayKey(change.at);
    const payload = { from: change.from, to: change.to, at: change.at, added: change.added, removed: change.removed };
    if (!(await claim({ key, kind: "tenants", day, payload }))) continue;
    await dispatchInApp(recipients, {
      eventType: EVENTS.SAMS_TENANTS_CHANGED,
      ...tenantChangeText(change, now),
      link: LINKS.SAMS_STATUS,
      metadata: { at: change.at, from: change.from, to: change.to, digestDay: day },
    });
    await markSent(key);
    sent += 1;
  }
  return sent;
}

async function previousDigest(today) {
  const prev = await SamsAlert.findOne({ kind: "digest", day: { $lt: today } }).sort({ createdAt: -1 }).lean();
  return prev?.payload ?? null;
}

async function maybeSendDigest(now) {
  const cfg = monitorConfig();
  if (uzHour(now) < cfg.digestHour) return "not_due";
  const today = uzDayKey(now);
  const key = `digest:${today}`;
  if (await SamsAlert.exists({ key })) return "done";
  const prev = await previousDigest(today);
  const content = await digestContent({ now, cfg, prevKeys: new Set(prev?.keys ?? []) });
  const delta = digestDelta(content, prev, now);
  const recipients = delta.lines.length ? await officeUserIds() : [];
  if (delta.lines.length && recipients.length === 0) return "no_recipients";
  if (!(await claim({ key, kind: "digest", day: today, payload: delta.payload, sent: false }))) return "lost";
  if (delta.lines.length === 0) return "empty";
  await dispatchInApp(recipients, {
    eventType: EVENTS.SAMS_DIGEST,
    title: DIGEST_TITLE,
    body: delta.lines.join("\n"),
    link: LINKS.SAMS_STATUS,
    metadata: { digestDay: today, counts: delta.counts },
  });
  await markSent(key);
  return "sent";
}

async function checkLiveness(now) {
  const last = await latestPacket();
  const state = livenessOf(last, now, monitorConfig());
  if (state === "stale" && now.getTime() - new Date(last.receivedAt).getTime() <= LIVENESS_DIGEST_DAYS * DAY_MS) {
    winston.warn(`[4.5:SAMS] SAMS paketlari to'xtadi: oxirgi qabul ${new Date(last.receivedAt).toISOString()}`);
  }
  const failed = state === "ok" ? (last.failedTenants ?? []).map((f) => f.dbname) : [];
  if (failed.length) winston.warn(`[4.5:SAMS] oxirgi paketda o'qilmagan klinikalar: ${failed.length} (${failed.join(",")})`);
  return { state, failed: failed.length };
}

const STEPS = [
  ["stale", markStaleDays],
  ["tenants", alertTenantChanges],
  ["digest", maybeSendDigest],
  ["liveness", checkLiveness],
  ["outages", resumePendingResolutions],
];

const isObject = (r) => Boolean(r) && typeof r === "object";
const fmtStale = (r) => (isObject(r) ? `${r.orgDays}/${r.presence}` : String(r));
const fmtLiveness = (r) => (isObject(r) ? `${r.state} failed=${r.failed}` : String(r));

let running = false;

async function runSamsMonitorTick(now = new Date()) {
  if (mongoose.connection.readyState !== 1 || running) return false;
  running = true;
  const startedAt = Date.now();
  try {
    const out = {};
    let ok = true;
    for (const [name, step] of STEPS) {
      try {
        out[name] = await step(now);
      } catch (err) {
        ok = false;
        out[name] = "error";
        winston.error(`[4.5:SAMS] monitor ${name} yiqildi: ${err.message}`);
      }
    }
    winston.info(
      `[4.5:SAMS] monitor stale=${fmtStale(out.stale)} tenants=${out.tenants} digest=${out.digest} ` +
        `liveness=${fmtLiveness(out.liveness)} ms=${Date.now() - startedAt}`,
    );
    return ok;
  } finally {
    running = false;
  }
}

module.exports = { runSamsMonitorTick, alertTenantChanges, maybeSendDigest, checkLiveness, claim, uzHour };
