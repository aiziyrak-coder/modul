"use strict";

const SamsOrgDay = require("#modules/4.05-residency/samsIngest/samsOrgDay.model");
const SamsPresence = require("#modules/4.05-residency/samsIngest/samsPresence.model");
const SamsAlert = require("#modules/4.05-residency/samsIngest/samsAlert.model");
const Notification = require("#system/notification/notification.model");
const { deliverySnapshot, computeResendFrom } = require("#modules/4.05-residency/samsIngest/samsDelivery");
const { personBaselines } = require("#modules/4.05-residency/samsIngest/samsBaseline");
const { recordPacket } = require("#modules/4.05-residency/samsIngest/samsPacketLog");
const { maybeSendDigest, runSamsMonitorTick } = require("#modules/4.05-residency/samsIngest/samsMonitorTick");
const M = require("./helpers/samsMonitor");

const { NOW, TODAY, D, MIN, ago, finalAt, partialAt, orgDay, presence, withRecords, mkResident, mkOffice } = M;
const fin = (day) => ({ packetAt: finalAt(day), receivedAt: finalAt(day) });
const part = (day) => ({ packetAt: partialAt(day), receivedAt: partialAt(day) });

beforeAll(() => Promise.all([SamsOrgDay.init(), SamsPresence.init(), SamsAlert.init()]));

describe("I8 — watermark, teshiklar, resendFrom", () => {
  beforeEach(async () => {
    for (let n = -10; n <= -1; n += 1) if (n !== -4 && n !== -3) await orgDay("A", D(n), fin(D(n)));
    await orgDay("A", D(-3), part(D(-3)));
    await orgDay("A", TODAY, { packetAt: ago(5), receivedAt: ago(5) });
    await orgDay("B", D(-8), fin(D(-8)));
    await orgDay("B", D(-5), part(D(-5)));
  });

  it("jonli klinikalar bo'yicha aniq watermark; tushgan klinika ro'yxatda, lekin watermark'ni ushlamaydi", async () => {
    const snap = await deliverySnapshot(NOW);
    expect(snap.watermark).toEqual({ deliveredThrough: D(-5), resendFrom: D(-4), gapDays: 2, oldestGap: D(-4) });
    const [a, b] = ["A", "B"].map((d) => snap.clinics.find((c) => c.dbname === d));
    expect(a).toMatchObject({ live: true, firstDay: D(-10), lastDay: TODAY, deliveredThrough: D(-5), orgTitle: "Klinika A" });
    expect(a.gaps).toEqual([{ day: D(-4), delivery: "none" }, { day: D(-3), delivery: "stale" }]);
    expect(b).toMatchObject({ live: false, deliveredThrough: D(-8) });
    expect(b.gaps).toHaveLength(7);
    await expect(computeResendFrom(NOW)).resolves.toBe(D(-4));
  });

  it("oyna so'rovi {dbname:1, day:1} indeksidan (IXSCAN)", async () => {
    const plan = await SamsOrgDay.find({ dbname: { $in: ["A", "B"] }, day: { $gte: D(-46), $lte: TODAY } }).explain("queryPlanner");
    const text = JSON.stringify(plan.queryPlanner.winningPlan);
    expect(text).toContain("IXSCAN");
    expect(text).toContain("dbname_day_unique");
  });

  it("teshik yopilgach (resend paketi) watermark kechaga chiqadi, resendFrom null", async () => {
    await orgDay("A", D(-4), fin(D(-4)));
    await SamsOrgDay.updateOne({ dbname: "A", day: D(-3) }, { $set: fin(D(-3)) });
    await expect(computeResendFrom(NOW)).resolves.toBeNull();
    expect((await deliverySnapshot(NOW)).watermark.deliveredThrough).toBe(D(-1));
  });
});

describe("I9 — kishi bazaviy chizig'i (haqiqiy $size)", () => {
  it("12 kun skanladi, keyin 3 kun jim — shubhali; o'lik klinika kuni hisobga olinmaydi", async () => {
    const [silent, steady] = await Promise.all([mkResident(), mkResident()]);
    for (let n = -16; n <= -1; n += 1) {
      const dead = n === -2;
      await orgDay("A", D(n), fin(D(n)), dead ? { scannedResidents: 0 } : {});
      await presence(silent, "A", D(n), fin(D(n)), n <= -5 ? withRecords() : {});
      await presence(steady, "A", D(n), fin(D(n)), dead ? {} : withRecords(2));
    }
    const res = await personBaselines([silent._id, String(steady._id)], { to: D(-1) });
    expect(res.get(String(silent._id))).toMatchObject({
      silentStreak: 3, lastRecordDay: D(-5), baselineRate: 1, eligibleDays: 15, daysWithRecords: 12, suspectSilent: true,
    });
    expect(res.get(String(steady._id))).toMatchObject({ silentStreak: 0, rate: 1, suspectSilent: false, eligibleDays: 15 });
  });
});

describe("§5.1 — kunlik yig'ma", () => {
  let office;
  beforeEach(async () => {
    office = await mkOffice(2);
    const r = await mkResident();
    await orgDay("A", TODAY, { packetAt: ago(3), receivedAt: ago(3) });
    await orgDay("A", D(-2), part(D(-2)));
    await presence(r, null, TODAY, { packetAt: ago(3), receivedAt: ago(3) }, { measured: false, unmeasuredReason: "unresolved" });
  });
  const digests = () => Notification.find({ eventType: "residency_sams_digest" }).lean();
  const TEN = new Date(NOW.getTime() + 7 * MIN);

  it("10:07 da ikki tik — har xodimga aniq bitta; 09:59 da hech narsa", async () => {
    await expect(maybeSendDigest(new Date(NOW.getTime() - MIN))).resolves.toBe("not_due");
    await runSamsMonitorTick(TEN);
    await runSamsMonitorTick(TEN);
    const sent = await digests();
    expect(sent.map((n) => String(n.user)).sort()).toEqual(office.map((u) => String(u._id)).sort());
    expect(sent[0]).toMatchObject({ link: "/residency/sams-holati", channels: ["inApp"] });
    expect(sent[0].body).toBe("Yangi: JSHSHIR SAMS'da topilmadi — 1 (noma'lum: 1)\nYetkazilmagan kunlar: 2 (eng eskisi 2026-09-25)");
    expect(await SamsAlert.findOne({ key: `digest:${TODAY}` }).lean()).toMatchObject({ sent: true, day: TODAY });
  });

  it("ertasi kuni faqat yangilari; parallel band qilish — bitta g'olib", async () => {
    await maybeSendDigest(TEN);
    const tomorrow = new Date(TEN.getTime() + 24 * 60 * MIN);
    await orgDay("A", D(1), { packetAt: tomorrow, receivedAt: tomorrow });
    await presence(await mkResident(), "A", D(1), { packetAt: tomorrow, receivedAt: tomorrow }, { measured: false, unmeasuredReason: "no_schedule" });
    const both = await Promise.all([maybeSendDigest(tomorrow), maybeSendDigest(tomorrow)]);
    expect(both.filter((s) => s === "sent")).toHaveLength(1);
    const next = (await digests()).filter((n) => n.metadata.digestDay === D(1));
    expect(next).toHaveLength(2);
    expect(next[0].body).toBe("Yangi: smenasi yo'q — 1 (Klinika A: 1)\nYetkazilmagan kunlar: 1 (eng eskisi 2026-09-27)");
  });
});

describe("§5.1 — tenant_set_changed", () => {
  it("5 → 4 — bitta xabar har xodimga; qayta ishga tushirish — yo'q", async () => {
    await mkOffice(2);
    const pkt = (n) => ({ schemaVersion: 1, emittedAt: new Date(), window: { from: TODAY, to: TODAY }, scan: { tenantsScanned: n, tenantsWithResidents: n }, tenants: [], unresolved: [], ambiguous: [] });
    await recordPacket(pkt(5), ago(60));
    await recordPacket({ ...pkt(4), scan: { tenantsScanned: 4, tenantsWithResidents: 4, tenantSetChanged: { added: [], removed: ["E"] } } }, ago(45));
    await recordPacket(pkt(4), ago(30));
    await runSamsMonitorTick(NOW);
    await runSamsMonitorTick(NOW);
    const sent = await Notification.find({ eventType: "residency_sams_tenants_changed" }).lean();
    expect(sent).toHaveLength(2);
    expect(sent[0].body).toBe("Oldin 5, hozir 4 (09:15). Klinika turi, faolligi yoki o'chirilgani SAMS administratori bilan tekshirilsin.");
    expect(sent.map((n) => n.metadata)).toEqual(Array(2).fill({ at: ago(45), from: 5, to: 4, digestDay: TODAY }));
    expect(await SamsAlert.findOne({ kind: "tenants" }).lean()).toMatchObject({ sent: true, payload: { from: 5, to: 4, removed: ["E"] } });
  });
});
