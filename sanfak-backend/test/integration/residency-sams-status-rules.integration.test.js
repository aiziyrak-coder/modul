"use strict";

const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsPacket = require("#modules/4.05-residency/samsIngest/samsPacket.model");
const { collectWarnings } = require("#modules/4.05-residency/samsIngest/samsWarnings");
const { recordPacket } = require("#modules/4.05-residency/samsIngest/samsPacketLog");
const S = require("#modules/4.05-residency/samsIngest/samsStatus.service");
const M = require("./helpers/samsMonitor");

const { NOW, TODAY, D, ago, finalAt, orgDay, presence, withRecords, mkResident } = M;
const fin = (day) => ({ packetAt: finalAt(day), receivedAt: finalAt(day) });
const fresh = { packetAt: ago(5), receivedAt: ago(5) };

beforeAll(() => Promise.all([SamsOrgDay.init(), SamsPresence.init(), SamsPacket.init()]));

describe("hal qilinmagan — oxirgi ma'lum klinika", () => {
  it("avval A, keyin B da bo'lgan rezident bugun topilmadi — B ostida", async () => {
    const r = await mkResident();
    await orgDay("A", D(-9), fin(D(-9)));
    await orgDay("B", D(-3), fin(D(-3)));
    await presence(r, "A", D(-9), fin(D(-9)));
    await presence(r, "B", D(-3), fin(D(-3)));
    await presence(r, null, TODAY, fresh, { measured: false, unmeasuredReason: "unresolved" });
    const titles = new Map([["A", "Klinika A"], ["B", "Klinika B"]]);
    const w = await collectWarnings(TODAY, { titles });
    expect(w.unresolved.groups.map((g) => [g.dbname, g.orgTitle, g.residents.length])).toEqual([["B", "Klinika B", 1]]);
  });
});

describe("o'tgan kun drill-down — bazaviy chiziq o'sha kungacha", () => {
  it("rezident kundan KEYIN skanlagan — seriya va oxirgi yozuv kuni drill-down kuni bo'yicha", async () => {
    const r = await mkResident();
    for (let n = -15; n <= -1; n += 1) {
      const silent = n >= -9 && n <= -5;
      await orgDay("A", D(n), fin(D(n)));
      await presence(r, "A", D(n), fin(D(n)), silent ? {} : withRecords());
    }
    const res = await S.clinicDay({ dbname: "A", day: D(-5) }, { page: 1, limit: 50 }, NOW);
    expect(res.docs).toHaveLength(1);
    expect(res.docs[0].baseline).toMatchObject({ silentStreak: 5, lastRecordDay: D(-10), suspectSilent: true });
  });
});

describe("overview — tenant_set_changed", () => {
  it("ikki o'zgarish — eng so'nggisi ko'rsatiladi", async () => {
    const pkt = (n) => ({
      schemaVersion: 1, emittedAt: NOW, window: { from: TODAY, to: TODAY },
      scan: { tenantsScanned: n, tenantsWithResidents: n }, tenants: [], unresolved: [], ambiguous: [],
    });
    await recordPacket(pkt(5), ago(90));
    await recordPacket(pkt(4), ago(60));
    await recordPacket(pkt(6), ago(30));
    const { warnings } = await S.overview(NOW);
    expect(warnings.tenantSetChanged).toMatchObject({ from: 4, to: 6, at: ago(30) });
  });
});
