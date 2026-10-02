"use strict";

const { uzDayKey, UZ_OFFSET_MINUTES } = require("#modules/4.05-residency/_services/uzDay");
const { deliverySnapshot } = require("./samsDelivery");
const { collectWarnings, referenceDay, newKeys } = require("./samsWarnings");
const { deliveryState, isOverdue } = require("./samsDayState");
const { LIVENESS_DIGEST_DAYS } = require("./samsMonitorConfig");

const DAY_MS = 86_400_000;
const UNKNOWN_CLINIC = "noma'lum";
const UNREAD_NAMES = 5;

function uzClock(at, now) {
  const local = new Date(new Date(at).getTime() + UZ_OFFSET_MINUTES * 60_000).toISOString();
  const hhmm = local.slice(11, 16);
  return uzDayKey(at) === uzDayKey(now) ? hhmm : `${local.slice(0, 10)} ${hhmm}`;
}

function livenessOf(last, now, cfg) {
  if (!last) return "never";
  return now.getTime() - new Date(last.receivedAt).getTime() <= cfg.staleAfterMs ? "ok" : "stale";
}

const orgLabel = (g) => (g.dbname ? g.orgTitle || g.dbname : UNKNOWN_CLINIC);

function groupedLine(label, block) {
  const parts = block.groups
    .map((g) => ({ name: orgLabel(g), n: g.residents.filter((r) => r.isNew).length }))
    .filter((p) => p.n > 0);
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (total === 0) return null;
  return `Yangi: ${label} — ${total} (${parts.map((p) => `${p.name}: ${p.n}`).join(", ")})`;
}

function warningLines(w) {
  if (!w) return [];
  const ambiguous = w.ambiguous.items.filter((i) => i.isNew).length;
  return [
    groupedLine("JSHSHIR SAMS'da topilmadi", w.unresolved),
    ambiguous ? `Yangi: JSHSHIR bir necha klinikada — ${ambiguous}` : null,
    groupedLine("smenasi yo'q", w.noSchedule),
    groupedLine("SAMS'da nofaol", w.inactiveUser),
  ].filter(Boolean);
}

function gapLine(newGapKeys) {
  if (newGapKeys.length === 0) return null;
  const oldest = newGapKeys.map((k) => k.split("|")[1]).sort()[0];
  return `Yetkazilmagan kunlar: ${newGapKeys.length} (eng eskisi ${oldest})`;
}

function unreadLine(unread, prevKeys) {
  const fresh = unread.filter((u) => !prevKeys.has(u.key));
  if (fresh.length === 0) return null;
  const names = fresh.slice(0, UNREAD_NAMES).map((u) => u.name);
  const more = fresh.length > UNREAD_NAMES ? ", …" : "";
  return `Bugun o'qilmagan klinikalar: ${fresh.length} (${names.join(", ")}${more})`;
}

function livenessLine(content, now) {
  const { last, liveness } = content;
  if (liveness !== "stale" || now.getTime() - new Date(last.receivedAt).getTime() > LIVENESS_DIGEST_DAYS * DAY_MS) return null;
  return `SAMS'dan oxirgi paket: ${uzClock(last.receivedAt, now)} — bugungi davomat «o'lchanmagan»`;
}

function unreadClinics(snap, now, cfg) {
  const names = new Map(snap.clinics.filter((c) => c.live).map((c) => [c.dbname, c.orgTitle]));
  for (const f of snap.lastPacket?.failedTenants ?? []) if (!names.has(f.dbname)) names.set(f.dbname, f.orgTitle);
  return [...names]
    .filter(([dbname]) => ["none", "stale"].includes(deliveryState(snap.rowsByClinic.get(dbname)?.get(snap.today), now, cfg)))
    .map(([dbname, title]) => ({ key: `failed:${dbname}|${snap.today}`, name: title || dbname }));
}

async function digestContent({ now, cfg, prevKeys }) {
  const snap = await deliverySnapshot(now);
  const rows = [...snap.rowsByClinic.values()].flatMap((byDay) => [...byDay.values()]);
  const titles = new Map(snap.clinics.map((c) => [c.dbname, c.orgTitle]));
  const warningsDue = referenceDay(snap.today, rows) === snap.today;
  const warnings = warningsDue ? await collectWarnings(snap.today, { titles, prevKeys }) : null;
  const gapKeys = snap.clinics
    .filter((c) => c.live)
    .flatMap((c) => c.gaps.filter((g) => isOverdue(g.day, now, cfg)).map((g) => `${c.dbname}|${g.day}`));
  const last = snap.lastPacket;
  const liveness = livenessOf(last, now, cfg);
  const unread = liveness === "ok" ? unreadClinics(snap, now, cfg) : [];
  return { today: snap.today, warnings, gapKeys, unread, last, liveness };
}

const warningCounts = (w) => ({
  unresolved: w ? w.unresolved.count : 0,
  ambiguous: w ? w.ambiguous.count : 0,
  noSchedule: w ? w.noSchedule.count : 0,
  inactiveUser: w ? w.inactiveUser.count : 0,
});

function digestDelta(content, prev, now) {
  const prevKeys = new Set(prev?.keys ?? []);
  const warnKeys = content.warnings ? content.warnings.keys : [...prevKeys];
  const newGapKeys = newKeys(content.gapKeys, new Set(prev?.gapKeys ?? []));
  const unread = content.unread ?? [];
  const lines = [
    ...warningLines(content.warnings),
    gapLine(newGapKeys),
    unreadLine(unread, new Set(prev?.unreadKeys ?? [])),
    livenessLine(content, now),
  ].filter(Boolean);
  return {
    lines,
    payload: { keys: warnKeys, gapKeys: content.gapKeys, unreadKeys: unread.map((u) => u.key) },
    counts: {
      ...warningCounts(content.warnings),
      newWarnings: content.warnings ? newKeys(warnKeys, prevKeys).length : 0,
      newGaps: newGapKeys.length,
      unreadClinics: unread.length,
    },
  };
}

const DIGEST_TITLE = "SAMS davomati — kunlik yig'ma";

function tenantChangeText(change, now) {
  return {
    title: "SAMS: skanerlanadigan klinikalar soni o'zgardi",
    body:
      `Oldin ${change.from}, hozir ${change.to} (${uzClock(change.at, now)}). ` +
      "Klinika turi, faolligi yoki o'chirilgani SAMS administratori bilan tekshirilsin.",
  };
}

module.exports = { digestContent, digestDelta, unreadClinics, livenessOf, tenantChangeText, uzClock, DIGEST_TITLE };
