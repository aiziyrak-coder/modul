"use strict";

const SamsOrgDay = require("./samsOrgDay.model");
const SamsPresence = require("./samsPresence.model");
const SamsPacket = require("./samsPacket.model");
const SamsAlert = require("./samsAlert.model");

const pathsOf = (M) => Object.keys(M.schema.paths);
const enumOf = (M, p) => M.schema.path(p).enumValues;
const indexes = (M) => M.schema.indexes().map(([fields, opts]) => ({ fields, ...opts }));

describe("C1 — residencySamsOrgDay", () => {
  it("maydonlar: packetAt (= emittedAt) va receivedAt (qabul) alohida", () => {
    expect(pathsOf(SamsOrgDay)).toEqual(expect.arrayContaining([
      "dbname", "day", "orgTitle", "orgId", "measured", "unmeasuredReason", "packetAt", "receivedAt",
      "rosterScanCount", "expectedResidents", "scannedResidents", "deviceMix",
    ]));
    expect(SamsOrgDay.schema.path("packetAt").instance).toBe("Date");
    expect(SamsOrgDay.schema.path("receivedAt").instance).toBe("Date");
  });

  it("sabab enumida `stale`; unique {dbname:1, day:1}", () => {
    expect(enumOf(SamsOrgDay, "unmeasuredReason")).toEqual(expect.arrayContaining(["stale", null]));
    expect(indexes(SamsOrgDay)).toContainEqual(expect.objectContaining({ fields: { dbname: 1, day: 1 }, unique: true }));
  });
});

describe("C2 — residencySamsPresence", () => {
  it("maydonlar (nomlari: samsUserActive, ambiguousDbnames, records[])", () => {
    expect(pathsOf(SamsPresence)).toEqual(expect.arrayContaining([
      "resident", "day", "dbname", "measured", "unmeasuredReason", "hasShift", "samsUserActive",
      "ambiguousDbnames", "records", "recordCount", "packetAt", "receivedAt",
    ]));
    const rec = SamsPresence.schema.path("records").schema;
    expect(Object.keys(rec.paths)).toEqual(expect.arrayContaining(["accessTime", "exitTime", "deviceType"]));
  });

  it("sabablar eksport qilingan; `stale` bor, `outage` YO'Q (o'qishda qo'llanadi)", () => {
    expect(SamsPresence.UNMEASURED_REASONS).toEqual(expect.arrayContaining(["unresolved", "ambiguous", "no_schedule", "before_horizon", "stale"]));
    expect(SamsPresence.UNMEASURED_REASONS).not.toContain("outage");
    expect(enumOf(SamsPresence, "unmeasuredReason")).toEqual(expect.arrayContaining(["stale", null]));
  });

  it("indekslar: {resident:1, day:1} unique VA {dbname:1, day:1} STANDART nom (qayta e'lon qilinmaydi)", () => {
    const ix = indexes(SamsPresence);
    expect(ix).toContainEqual(expect.objectContaining({ fields: { resident: 1, day: 1 }, unique: true }));
    const byClinic = ix.filter((i) => i.fields.dbname === 1 && i.fields.day === 1);
    expect(byClinic).toHaveLength(1);
    expect(byClinic[0].name).toBeUndefined();
  });
});

describe("SAMS ingest modellari", () => {
  const TTL = 90 * 24 * 60 * 60;

  it("residencySamsPacket — {receivedAt:1} TTL 90 kun; jshshir maydoni yo'q", () => {
    expect(indexes(SamsPacket)).toContainEqual(expect.objectContaining({ fields: { receivedAt: 1 }, expireAfterSeconds: TTL }));
    expect(pathsOf(SamsPacket).filter((p) => /jshshir/i.test(p))).toEqual([]);
    expect(pathsOf(SamsPacket)).toEqual(expect.arrayContaining(["tenantsScanned", "packetId", "serverUtcOffsetMinutes", "tenantSetChanged", "tenantDbnames"]));
  });

  it("residencySamsPacket.tenantDbnames standartsiz — maydonsiz yozuv «doira noma'lum» (bo'sh ro'yxat emas)", () => {
    expect(new SamsPacket({}).tenantDbnames).toBeUndefined();
    expect(new SamsPacket({ tenantDbnames: [] }).tenantDbnames).toEqual([]);
  });

  it("residencySamsAlert — unique key (qulf), {createdAt:1} TTL 90 kun, {kind:1, createdAt:-1}", () => {
    expect(SamsAlert.schema.path("key").options.unique).toBe(true);
    const ix = indexes(SamsAlert);
    expect(ix).toContainEqual(expect.objectContaining({ fields: { createdAt: 1 }, expireAfterSeconds: TTL }));
    expect(ix).toContainEqual(expect.objectContaining({ fields: { kind: 1, createdAt: -1 } }));
    expect(enumOf(SamsAlert, "kind")).toEqual(["digest", "tenants"]);
  });
});
