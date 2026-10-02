"use strict";

const winston = require("#shared/winston.logger");
const { isDayKey } = require("#modules/4.05-residency/samsIngest/samsContract");
const resolution = require("./sessionResolution");

const TAG = "[4.5 samsPresenceSync]";

let pending = null;
let running = null;

const emptySummary = () => ({ runs: 0, days: 0, sessions: 0, changed: 0, recounted: 0, errors: 0 });
const span = (days) => `${days[0]}..${days[days.length - 1]} (${days.length})`;

function enqueue(scope) {
  const days = Array.isArray(scope?.days) ? scope.days.filter(isDayKey) : [];
  if (!days.length) return false;
  pending = pending ?? { normal: new Set(), forced: new Set(), done: [] };
  const forced = scope.force === true;
  const target = forced ? pending.forced : pending.normal;
  for (const day of days) target.add(day);
  if (typeof scope.onDone === "function") pending.done.push({ forced, fn: scope.onDone });
  return true;
}

function addInto(total, r, days) {
  total.runs += 1;
  total.days += days;
  total.sessions += r?.sessions ?? 0;
  total.changed += r?.changed ?? 0;
  total.recounted += r?.recounted ?? 0;
  total.errors += r?.errors ?? 0;
}

const recountFailures = (r) => Math.max(0, (r?.affected?.length ?? 0) - (r?.recounted ?? 0));

async function runPass(days, force, total) {
  if (!days.length) return 0;
  try {
    const r = await resolution.resolveSessionDays(days, { force });
    const errors = (r?.errors ?? 0) + recountFailures(r);
    addInto(total, { ...r, errors }, days.length);
    return errors;
  } catch (err) {
    total.errors += 1;
    winston.error(`${TAG} yechim o'tishi yiqildi force=${force} days=${span(days)}: ${err.message}`);
    return 1;
  }
}

async function runBatch(batch, total) {
  const forcedErrors = await runPass([...batch.forced].sort(), true, total);
  const normal = [...batch.normal].filter((d) => forcedErrors > 0 || !batch.forced.has(d)).sort();
  const normalErrors = await runPass(normal, false, total);
  return { forced: forcedErrors === 0, normal: forcedErrors + normalErrors === 0 };
}

async function notifyDone(done, ok) {
  for (const { forced, fn } of done) {
    try {
      await fn(forced ? ok.forced : ok.normal);
    } catch (err) {
      winston.error(`${TAG} onDone yiqildi: ${err.message}`);
    }
  }
}

async function drain() {
  const total = emptySummary();
  while (pending) {
    const batch = pending;
    pending = null;
    let ok = { forced: false, normal: false };
    try {
      ok = await runBatch(batch, total);
    } finally {
      await notifyDone(batch.done, ok);
    }
  }
  winston.info(
    `${TAG} yechim: runs=${total.runs} days=${total.days} sessions=${total.sessions} ` +
      `changed=${total.changed} recounted=${total.recounted} errors=${total.errors}`,
  );
  return total;
}

function kick() {
  running = drain()
    .catch((err) => {
      winston.error(`${TAG} drenaj yiqildi: ${err.message}`);
      return { ...emptySummary(), errors: 1 };
    })
    .finally(() => {
      running = null;
      if (pending) kick();
    });
  return running;
}

function scheduleSessionResolution(scope) {
  try {
    if (!enqueue(scope)) return running ?? Promise.resolve(emptySummary());
    return running ?? kick();
  } catch (err) {
    winston.error(`${TAG} rejalashtirilmadi: ${err.message}`);
    return Promise.resolve({ ...emptySummary(), errors: 1 });
  }
}

async function _idle() {
  while (running) await running;
}

module.exports = { scheduleSessionResolution, _idle };
