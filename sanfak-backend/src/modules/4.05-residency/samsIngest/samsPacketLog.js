"use strict";

const winston = require("#shared/winston.logger");
const SamsPacket = require("./samsPacket.model");

const orgRef = (o) => ({ dbname: o.dbname, orgTitle: o.orgTitle || "" });

function tenantSetOf(change) {
  if (!change) return null;
  return { added: (change.added || []).map(orgRef), removed: [...(change.removed || [])] };
}

function scanFields(scan = {}) {
  return {
    tenantsScanned: scan.tenantsScanned ?? 0,
    tenantsWithResidents: scan.tenantsWithResidents ?? 0,
    failedTenants: (scan.failedTenants || []).map(orgRef),
    tenantSetChanged: tenantSetOf(scan.tenantSetChanged),
  };
}

function countFields({ tenants = [], unresolved = [], ambiguous = [] }) {
  return {
    tenantDbnames: [...new Set(tenants.map((t) => t.dbname))].sort(),
    tenantCount: tenants.length,
    peopleCount: tenants.reduce((sum, t) => sum + (t.people?.length ?? 0), 0),
    unresolvedCount: unresolved.length,
    ambiguousCount: ambiguous.length,
  };
}

function toPacketDoc(packet, receivedAt) {
  return {
    receivedAt,
    emittedAt: packet.emittedAt,
    schemaVersion: packet.schemaVersion,
    packetId: packet.packetId ?? null,
    trigger: packet.trigger ?? null,
    serverUtcOffsetMinutes: packet.serverUtcOffsetMinutes ?? null,
    window: { from: packet.window.from, to: packet.window.to },
    ...scanFields(packet.scan),
    ...countFields(packet),
  };
}

async function recordPacket(packet, receivedAt) {
  try {
    await SamsPacket.create(toPacketDoc(packet, receivedAt));
    return true;
  } catch (err) {
    winston.error(`[4.5:SAMS] paket jurnali yozilmadi: ${err.message}`);
    return false;
  }
}

const latestPacket = () => SamsPacket.findOne().sort({ receivedAt: -1 }).lean();

async function cleanWindowsSince(since) {
  const rows = await SamsPacket.find({
    receivedAt: { $gte: since },
    emittedAt: { $gte: since },
    trigger: { $ne: "manual" },
    "failedTenants.0": { $exists: false },
  })
    .select("window -_id")
    .lean();
  return rows.map((r) => r.window);
}

const CHANGE_FIELDS = "receivedAt tenantsScanned tenantSetChanged";

async function tenantChanges(sinceMs) {
  const since = new Date(sinceMs);
  const [before, rows] = await Promise.all([
    SamsPacket.findOne({ receivedAt: { $lt: since } }).sort({ receivedAt: -1 }).select(CHANGE_FIELDS).lean(),
    SamsPacket.find({ receivedAt: { $gte: since } }).sort({ receivedAt: 1 }).select(CHANGE_FIELDS).lean(),
  ]);
  const seq = before ? [before, ...rows] : rows;
  const changes = [];
  for (let i = 1; i < seq.length; i += 1) {
    const [prev, cur] = [seq[i - 1], seq[i]];
    if (prev.tenantsScanned === cur.tenantsScanned) continue;
    changes.push({
      packetId: String(cur._id),
      at: cur.receivedAt,
      from: prev.tenantsScanned,
      to: cur.tenantsScanned,
      added: cur.tenantSetChanged?.added ?? [],
      removed: cur.tenantSetChanged?.removed ?? [],
    });
  }
  return changes;
}

module.exports = { recordPacket, latestPacket, cleanWindowsSince, tenantChanges, toPacketDoc };
