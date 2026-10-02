"use strict";

const { nextDayStartMs } = require("./samsContract");

function measure({ day, horizon, since, hasShift }) {
  if (!horizon || day <= horizon) return { measured: false, reason: "before_horizon" };
  if (!since || day <= since) return { measured: false, reason: "before_registration" };
  if (!hasShift) return { measured: false, reason: "no_schedule" };
  return { measured: true, reason: null };
}

const dbnamesOf = (entry) => {
  if (entry.kind === "tenant") return [entry.tenant.dbname];
  return entry.kind === "ambiguous" ? entry.dbnames : [];
};

function indexIdentities(packet) {
  const seen = new Map();
  const conflicted = new Set();
  const add = (jshshir, entry) => {
    const prev = seen.get(jshshir);
    if (prev) {
      conflicted.add(jshshir);
      const dbnames = [...new Set([...dbnamesOf(prev), ...dbnamesOf(entry)])];
      seen.set(jshshir, { kind: "ambiguous", dbnames });
      return;
    }
    seen.set(jshshir, entry);
  };
  for (const tenant of packet.tenants) {
    for (const person of tenant.people) add(person.jshshir, { kind: "tenant", tenant, person });
  }
  for (const jshshir of packet.unresolved) add(jshshir, { kind: "unresolved" });
  for (const a of packet.ambiguous) add(a.jshshir, { kind: "ambiguous", dbnames: a.dbnames });
  return { seen, conflicts: conflicted.size };
}

const toStoredRecord = (r) => ({
  attendId: r.attendId,
  accessTime: r.accessTime || null,
  exitTime: r.exitTime || null,
  deviceType: r.deviceType.map((d) => ({ device: d.device ?? null, type: d.type ?? null })),
  lated: r.lated ?? null,
  earlyLeft: r.earlyLeft ?? null,
});

function groupRecordsByDate(records) {
  const byDate = new Map();
  for (const r of records) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(toStoredRecord(r));
  }
  return byDate;
}

const stamp = (ctx) => ({ packetAt: ctx.packetAt, receivedAt: ctx.receivedAt });

function personRows(tenant, person, ctx) {
  const byDate = groupRecordsByDate(person.records);
  return ctx.days.map((day) => {
    const records = byDate.get(day) || [];
    const m = measure({ day, horizon: tenant.horizon, since: person.since, hasShift: person.hasShift });
    return {
      resident: ctx.residentId,
      day,
      dbname: tenant.dbname,
      samsUserId: person.userId,
      measured: m.measured,
      unmeasuredReason: m.reason,
      ambiguousDbnames: [],
      hasShift: person.hasShift,
      samsSince: person.since,
      samsUserActive: person.active ?? null,
      lastActive: person.lastActive || null,
      records,
      recordCount: records.length,
      ...stamp(ctx),
    };
  });
}

function identityRows(entry, ctx) {
  const ambiguousDbnames = entry.kind === "ambiguous" ? [...entry.dbnames].sort() : [];
  return ctx.days.map((day) => ({
    resident: ctx.residentId,
    day,
    dbname: null,
    samsUserId: null,
    measured: false,
    unmeasuredReason: entry.kind,
    ambiguousDbnames,
    hasShift: null,
    samsSince: null,
    samsUserActive: null,
    lastActive: null,
    records: [],
    recordCount: 0,
    ...stamp(ctx),
  }));
}

function orgDayRows(tenants, ctx) {
  return tenants.flatMap((t) =>
    t.days.map((d) => {
      const measured = Boolean(t.horizon) && d.day > t.horizon;
      return {
        dbname: t.dbname,
        day: d.day,
        orgId: t.orgId,
        orgTitle: t.orgTitle || "",
        horizon: t.horizon,
        measured,
        unmeasuredReason: measured ? null : "before_horizon",
        rosterScanCount: d.rosterScanCount,
        expectedResidents: d.expectedResidents,
        scannedResidents: d.scannedResidents,
        deviceMix: { ...d.deviceMix },
        ...stamp(ctx),
      };
    }),
  );
}

function supersedeFilter(packet, days) {
  const dbnames = packet.tenants.map((t) => t.dbname);
  if (dbnames.length === 0 || days.length === 0) return null;
  const emittedMs = packet.emittedAt.getTime();
  return {
    dbname: { $in: dbnames },
    day: { $in: days },
    measured: true,
    $or: days.map((day) => ({ day, packetAt: { $lt: new Date(Math.min(emittedMs, nextDayStartMs(day))) } })),
  };
}

function buildRows(packet, residentIdByJshshir, receivedAt, days) {
  const { seen, conflicts } = indexIdentities(packet);
  const base = { days, packetAt: packet.emittedAt, receivedAt };
  const presenceRows = [];
  const stats = { written: 0, unknown: 0, conflicts };
  for (const [jshshir, entry] of seen) {
    const residentId = residentIdByJshshir.get(jshshir);
    if (!residentId) {
      stats.unknown += 1;
      continue;
    }
    stats.written += 1;
    const ctx = { ...base, residentId };
    const rows = entry.kind === "tenant" ? personRows(entry.tenant, entry.person, ctx) : identityRows(entry, ctx);
    presenceRows.push(...rows);
  }
  return { presenceRows, orgDayRows: orgDayRows(packet.tenants, base), stats };
}

module.exports = { buildRows, measure, indexIdentities, supersedeFilter };
