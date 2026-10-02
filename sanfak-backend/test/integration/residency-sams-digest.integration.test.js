"use strict";

const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsAlert = require("#modules/4.05-residency/samsIngest/samsAlert.model");
const SamsPacket = require("#modules/4.05-residency/samsIngest/samsPacket.model");
const Notification = require("#system/notification/notification.model");
const { recordPacket } = require("#modules/4.05-residency/samsIngest/samsPacketLog");
const { maybeSendDigest } = require("#modules/4.05-residency/samsIngest/samsMonitorTick");
const M = require("./helpers/samsMonitor");

const { NOW, TODAY, D, MIN, finalAt, orgDay, mkOffice } = M;
const TEN = new Date(NOW.getTime() + 7 * MIN);
const fin = (day) => ({ packetAt: finalAt(day), receivedAt: finalAt(day) });
const digests = () => Notification.find({ eventType: "residency_sams_digest" }).lean();
const ref = (dbname) => ({ dbname, orgTitle: `Klinika ${dbname}` });

async function ticks(from, to, { tenants = [], failed = [] } = {}) {
  for (let t = from.getTime(); t <= to.getTime(); t += 15 * MIN) {
    const at = new Date(t);
    await recordPacket({
      schemaVersion: 1, emittedAt: at, trigger: "tick", window: { from: TODAY, to: TODAY },
      scan: { tenantsScanned: 2, tenantsWithResidents: tenants.length, failedTenants: failed },
      tenants: tenants.map((dbname) => ({ dbname, people: [] })), unresolved: [], ambiguous: [],
    }, at);
  }
}

beforeAll(() => Promise.all([SamsOrgDay.init(), SamsAlert.init(), SamsPacket.init()]));

describe("o'qilmayotgan klinikalar", () => {
  beforeEach(async () => {
    await mkOffice(1);
    for (const dbname of ["A", "B"]) for (let n = -3; n <= -1; n += 1) await orgDay(dbname, D(n), fin(D(n)));
  });

  it("hamma tenant tun bo'yi o'qilmaydi — 10:07 yig'masi aytadi (jonlilik ok, teshik yo'q)", async () => {
    await ticks(new Date(`${TODAY}T01:45:00+05:00`), NOW, { failed: [ref("A"), ref("B")] });
    await expect(maybeSendDigest(TEN)).resolves.toBe("sent");
    const [sent] = await digests();
    expect(sent.body).toBe("Bugun o'qilmagan klinikalar: 2 (Klinika A, Klinika B)");
    expect(sent.metadata.counts).toMatchObject({ unreadClinics: 2, newGaps: 0 });
    expect((await SamsAlert.findOne({ kind: "digest" }).lean()).payload.unreadKeys).toEqual([`failed:A|${TODAY}`, `failed:B|${TODAY}`]);
  });

  it("bitta klinika o'qiladi — faqat ikkinchisi; paketlar to'xtagan bo'lsa — faqat jonlilik qatori", async () => {
    await orgDay("A", TODAY, { packetAt: new Date(NOW.getTime() - 5 * MIN), receivedAt: new Date(NOW.getTime() - 5 * MIN) });
    await ticks(new Date(`${TODAY}T09:00:00+05:00`), NOW, { tenants: ["A"], failed: [ref("B")] });
    await maybeSendDigest(TEN);
    expect((await digests())[0].body).toBe("Bugun o'qilmagan klinikalar: 1 (Klinika B)");

    const later = new Date(TEN.getTime() + 24 * 60 * MIN);
    await expect(maybeSendDigest(later)).resolves.toBe("sent");
    const next = (await digests()).find((n) => n.metadata.digestDay === D(1));
    expect(next.body).toBe(`Yetkazilmagan kunlar: 2 (eng eskisi ${TODAY})\nSAMS'dan oxirgi paket: ${TODAY} 10:00 — bugungi davomat «o'lchanmagan»`);
  });
});

describe("delta qoidalari", () => {
  const at = (days) => new Date(TEN.getTime() + days * 24 * 60 * MIN);
  const unresolvedOn = (r, day, stamp) => M.presence(r, null, day, stamp, { measured: false, unmeasuredReason: "unresolved" });

  it("bugun qator yo'q kun ogohlantirish kalitlarini ko'chiradi — ertasi davom etgan ogohlantirish «Yangi» emas", async () => {
    await mkOffice(1);
    const r = await M.mkResident();
    const stamp = (day) => ({ packetAt: new Date(`${day}T09:00:00+05:00`), receivedAt: new Date(`${day}T09:00:00+05:00`) });
    await orgDay("A", TODAY, stamp(TODAY));
    await unresolvedOn(r, TODAY, stamp(TODAY));
    await maybeSendDigest(TEN);
    expect((await digests())[0].body).toBe("Yangi: JSHSHIR SAMS'da topilmadi — 1 (noma'lum: 1)");

    await maybeSendDigest(at(1));
    expect((await SamsAlert.findOne({ day: D(1) }).lean()).payload.keys).toEqual([`unresolved:${r._id}`]);

    await orgDay("A", D(2), stamp(D(2)));
    await unresolvedOn(r, D(2), stamp(D(2)));
    await maybeSendDigest(at(2));
    const third = (await digests()).find((n) => n.metadata.digestDay === D(2));
    expect(third.body).toBe(`Yetkazilmagan kunlar: 1 (eng eskisi ${D(1)})`);
  });

  it("tushib qolgan klinikaning teshiklari yig'maga kirmaydi", async () => {
    await mkOffice(1);
    for (let n = -3; n <= -1; n += 1) await orgDay("A", D(n), fin(D(n)));
    await orgDay("A", TODAY, { packetAt: new Date(NOW.getTime() - 5 * MIN), receivedAt: new Date(NOW.getTime() - 5 * MIN) });
    await orgDay("B", D(-6), { packetAt: new Date(`${D(-6)}T09:00:00+05:00`), receivedAt: new Date(`${D(-6)}T09:00:00+05:00`) });
    await expect(maybeSendDigest(TEN)).resolves.toBe("empty");
    expect(await digests()).toEqual([]);
  });
});
