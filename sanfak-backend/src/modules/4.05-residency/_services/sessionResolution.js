"use strict";

const winston = require("#shared/winston.logger");
const Session = require("#modules/4.05-residency/residencySession/residencySession.model");
const Roster = require("#modules/4.05-residency/residencySession/residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");
const { getOrCreate } = require("#modules/4.05-residency/residencySetting/residencySetting.service");
const { addDays } = require("#modules/4.05-residency/samsIngest/samsContract");
const { runExpulsionCheck } = require("./expulsionCheck");
const { todayUz } = require("./sessionDay");
const defaultFactsPort = require("./samsFactsPort");
const { approvedExcuseQuery } = require("./approvedExcuses");
const { resolveEntry, RESOLVER_VERSION, RESOLUTION_WINDOW_DAYS } = require("./sessionResolver");
const { applyResult, copiesFrameScore } = require("./sessionProjection");
const { syncSessionRoster } = require("./sessionRosterSync");

const { SESSION_CANCELLED } = Session;
const { FRAME_VOID } = Roster;
const RECOUNT_SOURCE = "sams";
const MAX_REPAIR_DEPTH = 3;
const NO_FACTS = Object.freeze({ presence: new Map(), outages: [] });

const summary = (extra = {}) => ({
  entries: 0,
  changed: 0,
  stale: 0,
  conflicts: 0,
  repaired: 0,
  errors: 0,
  recounted: 0,
  skipped: null,
  affected: [],
  ...extra,
});

const outsideWindow = (day, now) => day < addDays(todayUz(now), -RESOLUTION_WINDOW_DAYS);

const cancelledMs = (f) => (f.cancelledAt ? new Date(f.cancelledAt).getTime() : Number.MAX_SAFE_INTEGER);

function planFrames(frames) {
  const byResident = new Map();
  for (const f of frames) {
    const key = String(f.resident);
    if (!byResident.has(key)) byResident.set(key, []);
    byResident.get(key).push(f);
  }
  const plans = [];
  for (const group of byResident.values()) {
    const [main, ...rest] = [...group].sort((a, b) => cancelledMs(b) - cancelledMs(a));
    plans.push({ frame: main, main: true });
    for (const f of rest) if (f.outcome !== FRAME_VOID) plans.push({ frame: f, main: false });
  }
  return plans;
}

const groupBy = (docs, key) => {
  const map = new Map();
  for (const d of docs) {
    const k = String(d[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(d);
  }
  return map;
};

function loadExcuses(residentIds) {
  return ResidentApplication.find(approvedExcuseQuery(residentIds))
    .select("resident reason fromDate toDate reviewedBy createdAt")
    .sort({ createdAt: 1 })
    .lean();
}

async function loadContext(session, o) {
  const filter = { session: session._id, ...(o.residentIds ? { resident: { $in: o.residentIds } } : {}) };
  const frames = await Roster.find(filter).lean();
  const ids = [...new Set(frames.map((f) => String(f.resident)))];
  const live = (await Resident.find({ _id: { $in: ids } }).select("_id").lean()).map((r) => r._id);
  const liveSet = new Set(live.map(String));
  const [facts, excuses] = await Promise.all([
    o.cancelled ? NO_FACTS : o.factsPort.loadSessionFacts({ day: session.day, residentIds: live }),
    o.cancelled ? [] : loadExcuses(live),
  ]);
  return {
    ...o,
    session,
    rev: o.now.getTime(),
    plans: planFrames(frames.filter((f) => liveSet.has(String(f.resident)))),
    facts,
    excusesBy: groupBy(excuses, "resident"),
  };
}

function resolveFrame(ctx, frame) {
  const key = String(frame.resident);
  return resolveEntry({
    session: { day: ctx.session.day, cancelled: ctx.cancelled },
    entry: { withdrawn: Boolean(frame.cancelledAt) },
    facts: ctx.facts.presence.get(key) ?? null,
    outages: ctx.facts.outages,
    excuses: ctx.excusesBy.get(key) ?? [],
    now: ctx.now,
    fallbackWindow: ctx.window,
  });
}

const settledVoid = (frame, result) =>
  result.outcome === FRAME_VOID &&
  frame.outcome === FRAME_VOID &&
  frame.outcomeReason === result.reason &&
  frame.resolverVersion === RESOLVER_VERSION;

function casFrame(frame, result, ctx) {
  return Roster.findOneAndUpdate(
    {
      _id: frame._id,
      cancelledAt: frame.cancelledAt ?? null,
      $or: [{ resolvedRev: null }, { resolvedRev: { $lte: ctx.rev } }],
    },
    {
      $set: {
        outcome: result.outcome,
        outcomeReason: result.reason,
        samsFirstIn: result.samsFirstIn,
        samsLastOut: result.samsLastOut,
        lateMinutes: result.lateMinutes,
        devices: result.devices,
        excuseApplication: result.excuse?._id ?? null,
        resolvedAt: ctx.now,
        resolvedRev: ctx.rev,
        resolverVersion: RESOLVER_VERSION,
      },
    },
    { new: true, runValidators: true },
  ).lean();
}

async function linkRow(entry, rowId) {
  if (String(entry.attendance ?? null) === String(rowId ?? null)) return;
  await Roster.updateOne({ _id: entry._id, resolvedRev: entry.resolvedRev }, { $set: { attendance: rowId ?? null } });
}

async function repairAfter(ctx, entry, out) {
  if (!out.changed && !out.stale) return null;
  const fresh = await Roster.findById(entry._id).select("resolvedRev").lean();
  const rev = fresh?.resolvedRev ?? null;
  if (out.changed) return rev > ctx.rev ? rev : null;
  return rev === ctx.rev ? ctx.rev : null;
}

const currentRow = (ctx, entry) =>
  Attendance.findOne({ session: ctx.session._id, resident: entry.resident }, null, { includeDeleted: true }).lean();

async function withFrameScore(entry) {
  const fresh = await Roster.findById(entry._id).select("score").lean();
  return { ...entry, score: fresh?.score ?? null };
}

async function projectFrame(ctx, entry, result) {
  const row = await currentRow(ctx, entry);
  const scored = copiesFrameScore(result, row) ? await withFrameScore(entry) : entry;
  const out = await applyResult({ session: ctx.session, entry: scored, result, row, rev: ctx.rev, now: ctx.now });
  if (!out.stale) await linkRow(entry, out.rowId);
  return { ...out, repairAfter: await repairAfter(ctx, entry, out) };
}

async function lostVoid(ctx, frame, result) {
  if (result.outcome !== FRAME_VOID) return null;
  const fresh = await Roster.findById(frame._id).select("outcome resolvedRev").lean();
  if (!fresh || fresh.outcome === FRAME_VOID) return null;
  return fresh.resolvedRev ?? ctx.rev;
}

async function runPlan(ctx, { frame, main }) {
  const result = resolveFrame(ctx, frame);
  const entry = settledVoid(frame, result) ? frame : await casFrame(frame, result, ctx);
  if (!entry) return { stale: true, repairAfter: await lostVoid(ctx, frame, result) };
  if (!main) return {};
  return projectFrame(ctx, entry, result);
}

async function runPlanIsolated(ctx, plan) {
  try {
    return await runPlan(ctx, plan);
  } catch (err) {
    winston.error(
      `[4.5 sessionResolution] freym yechilmadi session=${ctx.session._id} resident=${plan.frame.resident}: ${err.message}`,
    );
    return { error: true };
  }
}

function tally(acc, out, resident) {
  if (out.error) {
    acc.errors += 1;
    acc.affected.add(String(resident));
  }
  if (out.stale) acc.stale += 1;
  if (out.changed) acc.changed += 1;
  if (out.skipped) acc.conflicts += 1;
  if (out.affectsHours) acc.affected.add(String(resident));
  if (out.repairAfter) {
    acc.superseded.push(resident);
    acc.maxRev = Math.max(acc.maxRev, out.repairAfter);
  }
}

async function resolveFrames(ctx) {
  const acc = { changed: 0, stale: 0, conflicts: 0, errors: 0, affected: new Set(), superseded: [], maxRev: ctx.rev };
  for (const plan of ctx.plans) {
    tally(acc, await runPlanIsolated(ctx, plan), plan.frame.resident);
  }
  return acc;
}

async function cancelledMeanwhile(ctx) {
  if (ctx.cancelled || !ctx.plans.length) return false;
  return Boolean(await Session.exists({ _id: ctx.session._id, status: SESSION_CANCELLED }));
}

async function repair(ctx, acc) {
  const all = await cancelledMeanwhile(ctx);
  if (!all && !acc.superseded.length) return null;
  if (ctx.depth >= MAX_REPAIR_DEPTH) {
    winston.warn(
      `[4.5 sessionResolution] tuzatish chegarasi (${MAX_REPAIR_DEPTH}) — qator freymdan orqada qolishi mumkin ` +
        `session=${ctx.session._id} cancelled=${all} residents=${acc.superseded.join(",")}`,
    );
    return null;
  }
  return resolveSession(ctx.session._id, {
    now: new Date(acc.maxRev + 1),
    force: true,
    residentIds: all ? null : acc.superseded,
    factsPort: ctx.factsPort,
    recount: false,
    depth: ctx.depth + 1,
  });
}

async function repairIsolated(ctx, acc) {
  try {
    return await repair(ctx, acc);
  } catch (err) {
    acc.errors += 1;
    winston.error(`[4.5 sessionResolution] tuzatish o'tishi yiqildi session=${ctx.session._id}: ${err.message}`);
    return null;
  }
}

async function recount(residentIds, now) {
  let done = 0;
  for (const id of residentIds) {
    try {
      await runExpulsionCheck(id, { source: RECOUNT_SOURCE, now });
      done += 1;
    } catch (err) {
      winston.error(`[4.5 sessionResolution] qayta hisob yiqildi resident=${id}: ${err.message}`);
    }
  }
  return done;
}

async function openSession(sessionId, o) {
  const session = await Session.findById(sessionId).lean();
  if (!session) return { skipped: "not_found" };
  const cancelled = session.status === SESSION_CANCELLED;
  if (!o.force && !cancelled && outsideWindow(session.day, o.now)) return { skipped: "window" };
  return { session, cancelled, skipped: null };
}

const DEFAULTS = Object.freeze({ force: false, residentIds: null, factsPort: defaultFactsPort, recount: true, depth: 0 });

const planScope = (residentIds, synced) => (synced?.withdrawn ? null : residentIds);

async function resolveSession(sessionId, opts = {}) {
  const o = { ...DEFAULTS, now: new Date(), ...opts };
  const { session, cancelled, skipped } = await openSession(sessionId, o);
  if (skipped) return summary({ skipped });
  const settings = await getOrCreate();
  const window = { from: settings.workDayFrom, to: settings.workDayTo };
  const synced = cancelled ? null : await syncSessionRoster(session, { now: o.now, window });
  const ctx = await loadContext(session, { ...o, residentIds: planScope(o.residentIds, synced), cancelled, window });
  const acc = await resolveFrames(ctx);
  const fixed = await repairIsolated(ctx, acc);
  const affected = [...new Set([...acc.affected, ...(fixed?.affected ?? [])])];
  return summary({
    entries: ctx.plans.length,
    changed: acc.changed,
    stale: acc.stale,
    conflicts: acc.conflicts,
    repaired: fixed ? fixed.entries + fixed.repaired : 0,
    errors: acc.errors + (fixed?.errors ?? 0),
    recounted: o.recount ? await recount(affected, opts.now) : 0,
    affected,
  });
}

function merge(total, r) {
  for (const k of ["entries", "changed", "stale", "conflicts", "repaired", "errors"]) total[k] += r[k];
  if (!r.skipped) total.sessions += 1;
}

async function resolveSessionDays(days, opts = {}) {
  const o = { now: new Date(), ...opts, recount: false };
  const total = { ...summary(), sessions: 0 };
  const affected = new Set();
  for (const day of [...new Set(days)].sort()) {
    const sessions = await Session.find({ day }).select("_id").lean();
    for (const { _id } of sessions) {
      try {
        const r = await resolveSession(_id, o);
        merge(total, r);
        r.affected.forEach((id) => affected.add(String(id)));
      } catch (err) {
        total.errors += 1;
        winston.error(`[4.5 sessionResolution] sessiya yechilmadi session=${_id}: ${err.message}`);
      }
    }
  }
  total.affected = [...affected];
  total.recounted = await recount(total.affected, opts.now);
  return total;
}

module.exports = { resolveSession, resolveSessionDays, RECOUNT_SOURCE };
