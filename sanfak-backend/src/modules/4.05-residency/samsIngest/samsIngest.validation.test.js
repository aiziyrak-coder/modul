"use strict";

const { parsePacket } = require("./samsIngest.validation");

const PIN = "12345678901234";
const record = (over = {}) => ({
  attendId: "a1", date: "2026-09-27", accessTime: "08:01", exitTime: "14:00",
  deviceType: [{ device: 1, type: 1 }], lated: 0, earlyLeft: null, ...over,
});
const person = (over = {}) => ({
  jshshir: PIN, userId: "u1", hasShift: true, since: "2026-09-01",
  lastActive: "2026-09-27 08:00", active: true, records: [record()], ...over,
});
const dayEntry = (day) => ({
  day, rosterScanCount: 1, expectedResidents: 1, scannedResidents: 1,
  deviceMix: { hikvision: 1, mobile: 0, server: 0, in: 1, out: 0 },
});
const tenant = (over = {}) => ({
  orgId: "o1", dbname: "clinicA", orgTitle: "Klinika A", horizon: "2026-09-01",
  days: [dayEntry("2026-09-26"), dayEntry("2026-09-27")], people: [person()], ...over,
});
const buildPacket = (over = {}) => ({
  schemaVersion: 1, emittedAt: "2026-09-27T05:00:00.000Z",
  window: { from: "2026-09-26", to: "2026-09-27" },
  scan: { tenantsScanned: 1, tenantsWithResidents: 1 },
  tenants: [tenant()], unresolved: [], ambiguous: [], ...over,
});
const reasonOf = (body) => {
  try {
    parsePacket(body);
    return null;
  } catch (err) {
    return err.meta.reason;
  }
};

describe("to'g'ri paket", () => {
  it("o'tadi, `emittedAt` — Date", () => {
    const p = parsePacket(buildPacket());
    expect(p.emittedAt).toBeInstanceOf(Date);
    expect(p.tenants[0].people[0].records[0].attendId).toBe("a1");
  });

  it("nullable maydonlar: horizon/since null, orgTitle null → \"\", device null", () => {
    const p = parsePacket(buildPacket({
      tenants: [tenant({
        horizon: null, orgTitle: null,
        people: [person({ since: null, records: [record({ deviceType: [{ device: null, type: null }] })] })],
      })],
    }));
    expect(p.tenants[0].horizon).toBeNull();
    expect(p.tenants[0].orgTitle).toBe("");
    expect(p.tenants[0].people[0].since).toBeNull();
    expect(p.tenants[0].people[0].records[0].deviceType).toEqual([{ device: null, type: null }]);
  });

  it("ixtiyoriy qo'shimcha maydonlar e'lon qilingan va SAQLANADI", () => {
    const p = parsePacket(buildPacket({
      packetId: "p-1", trigger: "reconcile", serverUtcOffsetMinutes: 300,
      scan: {
        tenantsScanned: 2, tenantsWithResidents: 1, failedTenants: [{ dbname: "clinicB", orgTitle: "B" }],
        tenantSetChanged: { added: [{ dbname: "clinicC", orgTitle: "" }], removed: ["clinicD"] },
      },
      unresolvedReasons: [{ jshshir: PIN, reason: "wrong_type", dbname: "clinicB", orgTitle: null }],
      ambiguous: [{ jshshir: "22345678901234", dbnames: ["clinicA"], userCount: 2 }],
    }));
    expect(p).toMatchObject({ packetId: "p-1", trigger: "reconcile", serverUtcOffsetMinutes: 300 });
    expect(p.scan.failedTenants).toHaveLength(1);
    expect(p.scan.tenantSetChanged.removed).toEqual(["clinicD"]);
    expect(p.unresolvedReasons[0].reason).toBe("wrong_type");
    expect(p.ambiguous[0]).toEqual({ jshshir: "22345678901234", dbnames: ["clinicA"], userCount: 2 });
  });
});

describe("versiya va noma'lum kalitlar", () => {
  it.each([[{ schemaVersion: 2 }], [{ schemaVersion: "1" }], [{}], [null], [[]]])(
    "%p → unsupported_schema_version (supported [1])",
    (body) => {
      let err;
      try {
        parsePacket(body);
      } catch (e) {
        err = e;
      }
      expect(err.statusCode).toBe(400);
      expect(err.meta).toEqual({ reason: "unsupported_schema_version", supported: [1] });
    },
  );

  it("noma'lum OBYEKT kalitlari har darajada tashlanadi", () => {
    const t = { ...tenant(), foo: 1, people: [{ ...person(), baz: 2, records: [{ ...record(), qux: 3 }] }] };
    const p = parsePacket({ ...buildPacket({ tenants: [t] }), bar: true });
    expect(p.bar).toBeUndefined();
    expect(p.tenants[0].foo).toBeUndefined();
    expect(p.tenants[0].people[0].baz).toBeUndefined();
    expect(p.tenants[0].people[0].records[0].qux).toBeUndefined();
  });

  it("yaroqsiz yozuv TASHLANMAYDI — butun paket `contract`", () => {
    const body = buildPacket({ tenants: [tenant({ people: [person({ records: [record(), record({ attendId: 5 })] })] })] });
    expect(reasonOf(body)).toBe("contract");
  });
});

describe("contract — takrorlar va noto'g'ri qiymatlar", () => {
  const withPeople = (people) => buildPacket({ tenants: [tenant({ people })] });
  it.each([
    ["takror kun", buildPacket({ tenants: [tenant({ days: [dayEntry("2026-09-27"), dayEntry("2026-09-27")] })] })],
    ["takror dbname", buildPacket({ tenants: [tenant(), tenant()] })],
    ["takror jshshir (tenant ichida)", withPeople([person(), person({ userId: "u2" })])],
    ["takror attendId", withPeople([person({ records: [record(), record({ date: "2026-09-26" })] })])],
    ["takror unresolved", buildPacket({ unresolved: [PIN, PIN] })],
    ["13 raqamli jshshir", withPeople([person({ jshshir: "1234567890123" })])],
    ["dbname '/' bilan", buildPacket({ tenants: [tenant({ dbname: "org/1" })] })],
    ["kun 2026-13-01", buildPacket({ window: { from: "2026-13-01", to: "2026-09-27" } })],
    ["kun 2026-02-30", withPeople([person({ records: [record({ date: "2026-02-30" })] })])],
    ["horizon yo'q", buildPacket({ tenants: [(({ horizon, ...t }) => t)(tenant())] })],
    ["since yo'q", withPeople([(({ since, ...p }) => p)(person())])],
    ["hasShift yo'q", withPeople([(({ hasShift, ...p }) => p)(person())])],
    ["noma'lum trigger", buildPacket({ trigger: "cron" })],
    ["ambiguous dbnames bo'sh", buildPacket({ ambiguous: [{ jshshir: PIN, dbnames: [] }] })],
    ["qurilma 100", withPeople([person({ records: [record({ deviceType: [{ device: 100, type: 1 }] })] })])],
    ["emittedAt ISO emas", buildPacket({ emittedAt: 1790000000000 })],
  ])("%s", (_label, body) => {
    expect(reasonOf(body)).toBe("contract");
  });

  it("tafsilotda qiymat (jshshir) YO'Q — faqat yo'l va tur", () => {
    let err;
    try {
      parsePacket(withPeople([person({ jshshir: "9876543210987" })]));
    } catch (e) {
      err = e;
    }
    expect(err.detail).toBe("tenants.0.people.0.jshshir (string.pattern.base)");
    expect(JSON.stringify(err)).not.toContain("9876543210987");
  });
});
