"use strict";

jest.mock("./samsPacket.model", () => ({ create: jest.fn(), findOne: jest.fn(), find: jest.fn() }));
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const SamsPacket = require("./samsPacket.model");
const winston = require("#shared/winston.logger");
const L = require("./samsPacketLog");

const RECEIVED = new Date("2026-09-27T05:00:00Z");
const packet = (over = {}) => ({
  schemaVersion: 1, packetId: "p-9", trigger: "tick", serverUtcOffsetMinutes: 300,
  emittedAt: new Date("2026-09-27T04:59:30Z"), window: { from: "2026-09-27", to: "2026-09-27" },
  scan: {
    tenantsScanned: 5, tenantsWithResidents: 4,
    failedTenants: [{ dbname: "C", orgTitle: "Klinika C" }],
    tenantSetChanged: { added: [{ dbname: "D", orgTitle: "" }], removed: ["E"] },
  },
  tenants: [
    { dbname: "A", people: [{ jshshir: "30101990000011" }, { jshshir: "30101990000022" }] },
    { dbname: "B", people: [{ jshshir: "30101990000033" }] },
  ],
  unresolved: ["30101990000044"],
  ambiguous: [{ jshshir: "30101990000055", dbnames: ["A", "B"] }],
  ...over,
});

describe("recordPacket", () => {
  beforeEach(() => jest.clearAllMocks());

  it("faqat sonlar va klinika havolalari yoziladi (jshshir yo'q)", async () => {
    SamsPacket.create.mockResolvedValueOnce({});
    await expect(L.recordPacket(packet(), RECEIVED)).resolves.toBe(true);
    const doc = SamsPacket.create.mock.calls[0][0];
    expect(doc).toEqual({
      receivedAt: RECEIVED, emittedAt: new Date("2026-09-27T04:59:30Z"), schemaVersion: 1,
      packetId: "p-9", trigger: "tick", serverUtcOffsetMinutes: 300,
      window: { from: "2026-09-27", to: "2026-09-27" },
      tenantsScanned: 5, tenantsWithResidents: 4, tenantCount: 2, peopleCount: 3, unresolvedCount: 1, ambiguousCount: 1,
      tenantDbnames: ["A", "B"],
      failedTenants: [{ dbname: "C", orgTitle: "Klinika C" }],
      tenantSetChanged: { added: [{ dbname: "D", orgTitle: "" }], removed: ["E"] },
    });
    expect(JSON.stringify(doc)).not.toMatch(/\d{14}/);
  });

  it("ixtiyoriy maydonlar yo'q — null / bo'sh", async () => {
    const p = packet({ packetId: undefined, trigger: undefined, serverUtcOffsetMinutes: undefined });
    p.scan = { tenantsScanned: 1, tenantsWithResidents: 1 };
    await L.recordPacket(p, RECEIVED);
    expect(SamsPacket.create.mock.calls[0][0]).toMatchObject({
      packetId: null, trigger: null, serverUtcOffsetMinutes: null, failedTenants: [], tenantSetChanged: null,
    });
  });

  it("yozish xatosi loglanadi va HECH QACHON tashlanmaydi", async () => {
    SamsPacket.create.mockRejectedValueOnce(new Error("disk full"));
    await expect(L.recordPacket(packet(), RECEIVED)).resolves.toBe(false);
    expect(winston.error).toHaveBeenCalledWith(expect.stringContaining("disk full"));
  });
});

describe("tenantChanges — ketma-ket juftlar", () => {
  const p = (id, iso, n, change = null) => ({ _id: id, receivedAt: new Date(iso), tenantsScanned: n, tenantSetChanged: change });
  const mockSeq = (before, rows) => {
    SamsPacket.findOne.mockReturnValue({ sort: () => ({ select: () => ({ lean: async () => before }) }) });
    SamsPacket.find.mockReturnValue({ sort: () => ({ select: () => ({ lean: async () => rows }) }) });
  };

  it("birinchi paket oldingisi bilan solishtiriladi; faqat farq; keyingi paket id'si", async () => {
    mockSeq(p("p0", "2026-09-26T04:00:00Z", 5), [
      p("p1", "2026-09-26T06:00:00Z", 4, { added: [], removed: ["E"] }),
      p("p2", "2026-09-26T06:15:00Z", 4),
      p("p3", "2026-09-26T06:30:00Z", 6),
    ]);
    const res = await L.tenantChanges(Date.parse("2026-09-26T05:00:00Z"));
    expect(res).toEqual([
      { packetId: "p1", at: new Date("2026-09-26T06:00:00Z"), from: 5, to: 4, added: [], removed: ["E"] },
      { packetId: "p3", at: new Date("2026-09-26T06:30:00Z"), from: 4, to: 6, added: [], removed: [] },
    ]);
    expect(SamsPacket.find).toHaveBeenCalledWith({ receivedAt: { $gte: new Date("2026-09-26T05:00:00Z") } });
  });

  it("oldingi paket yo'q va bitta paket — o'zgarish yo'q", async () => {
    mockSeq(null, [p("p1", "2026-09-26T06:00:00Z", 4)]);
    await expect(L.tenantChanges(0)).resolves.toEqual([]);
  });
});

describe("cleanWindowsSince — so'rovdan keyingi toza oynalar", () => {
  it("so'rovdan keyin qabul qilingan VA olingan, manual emas, failedTenants bo'sh", async () => {
    const since = new Date("2026-09-27T04:30:00Z");
    SamsPacket.find.mockReturnValue({ select: () => ({ lean: async () => [{ window: { from: "2026-09-21", to: "2026-09-27" } }] }) });
    await expect(L.cleanWindowsSince(since)).resolves.toEqual([{ from: "2026-09-21", to: "2026-09-27" }]);
    expect(SamsPacket.find).toHaveBeenCalledWith({
      receivedAt: { $gte: since },
      emittedAt: { $gte: since },
      trigger: { $ne: "manual" },
      "failedTenants.0": { $exists: false },
    });
  });
});
