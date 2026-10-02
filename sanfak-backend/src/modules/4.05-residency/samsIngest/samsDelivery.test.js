"use strict";

jest.mock("./samsOrgDay.model", () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock("./samsPacketLog", () => ({ latestPacket: jest.fn() }));

const SamsOrgDay = require("./samsOrgDay.model");
const { latestPacket } = require("./samsPacketLog");
const { addDays } = require("./samsContract");
const Dl = require("./samsDelivery");

const CFG = { staleAfterMs: 30 * 60_000, closeGraceMs: 6 * 3_600_000, resendMaxDays: 30 };
const NOW = new Date("2026-09-27T05:00:00Z");
const D = (n) => addDays("2026-09-27", n);
const final = (d) => ({ day: d, measured: true, packetAt: new Date(`${addDays(d, 1)}T01:30:00+05:00`), receivedAt: new Date(`${addDays(d, 1)}T01:30:05+05:00`) });
const partial = (d) => ({ day: d, measured: true, packetAt: new Date(`${d}T17:00:00+05:00`), receivedAt: new Date(`${d}T17:00:05+05:00`) });
const byDay = (rows) => new Map(rows.map((r) => [r.day, r]));
const finals = (from, to) => { const out = []; for (let n = from; n <= to; n += 1) out.push(final(D(n))); return out; };
const clinic = (rows, over = {}) =>
  Dl.summarizeClinic({ dbname: "A", byDay: byDay(rows), meta: { firstDay: D(-10), orgTitle: "Klinika A", ...over }, now: over.now ?? NOW, cfg: CFG });

describe("summarizeClinic", () => {
  it("uzluksiz yakuniy — watermark kecha, teshik yo'q, qayta so'rov yo'q", () => {
    const c = clinic([...finals(-10, -1), partial(D(0))]);
    expect(c).toMatchObject({ deliveredThrough: D(-1), gaps: [], resendFrom: null, live: true, lastDay: undefined });
  });

  it("o'rtadagi teshik: watermark teshikdan oldingi kun; teshik holati none/stale", () => {
    const rows = [...finals(-10, -6), partial(D(-5)), ...finals(-3, -1)];
    const c = clinic(rows);
    expect(c.gaps).toEqual([{ day: D(-5), delivery: "stale" }, { day: D(-4), delivery: "none" }]);
    expect([c.deliveredThrough, c.resendFrom]).toEqual([D(-6), D(-5)]);
  });

  it("bugun yangi klinika — kecha yetkazilgan hisoblanadi (kutiladigan kun yo'q)", () => {
    expect(clinic([partial(D(0))], { firstDay: D(0) })).toMatchObject({ deliveredThrough: D(-1), gaps: [] });
  });

  it("yakuniy kun umuman yo'q — floor−1; eski firstDay 30 kunda kesiladi", () => {
    const c = clinic([partial(D(0))], { firstDay: D(-60) });
    expect(c.gaps).toHaveLength(30);
    expect(c.gaps[0].day).toBe(D(-30));
    expect([c.deliveredThrough, c.resendFrom]).toEqual([D(-31), D(-30)]);
  });

  it("kecha 06:00 dan OLDIN ochiq — watermark ushlanadi, lekin qayta so'ralmaydi", () => {
    const beforeClose = new Date("2026-09-26T20:00:00Z");
    const c = clinic([...finals(-10, -2), partial(D(-1))], { now: beforeClose });
    expect(c.gaps).toEqual([{ day: D(-1), delivery: "open" }]);
    expect([c.deliveredThrough, c.resendFrom]).toEqual([D(-2), null]);
  });

  it("jonli: oxirgi qabul ≤ 2 kun (oyna tashqarisidagi oxirgi kun ham hisobga olinadi)", () => {
    expect(clinic(finals(-10, -4)).live).toBe(false);
    expect(clinic(finals(-10, -4), { lastReceivedAt: new Date(NOW.getTime() - 3_600_000) }).live).toBe(true);
    expect(clinic([]).live).toBe(false);
  });

  it("jonli faqat roster doirasida: yangi paket, lekin doirada yo'q — jonli emas", () => {
    const rows = [...finals(-10, -1), partial(D(0))];
    const at = (scope) => Dl.summarizeClinic({ dbname: "A", byDay: byDay(rows), meta: { firstDay: D(-10) }, now: NOW, cfg: CFG, scope });
    expect(at(new Set(["B"])).live).toBe(false);
    expect(at(new Set(["A", "B"])).live).toBe(true);
    expect(at(null).live).toBe(true);
  });
});

describe("rosterScope — oxirgi paketning tenant bloklari + o'qilmaganlar", () => {
  it("paket yo'q yoki maydonsiz eski yozuv — null; aks holda birlashma", () => {
    expect(Dl.rosterScope(null)).toBeNull();
    expect(Dl.rosterScope({ failedTenants: [{ dbname: "B" }] })).toBeNull();
    expect([...Dl.rosterScope({ tenantDbnames: ["A"], failedTenants: [{ dbname: "B" }] })]).toEqual(["A", "B"]);
    expect([...Dl.rosterScope({ tenantDbnames: [] })]).toEqual([]);
  });
});

describe("globalWatermark", () => {
  const s = (over) => ({ live: true, deliveredThrough: D(-1), resendFrom: null, gaps: [], ...over });

  it("faqat jonli klinikalar; minimum; resendFrom = watermark+1", () => {
    const w = Dl.globalWatermark([
      s({ deliveredThrough: D(-4), resendFrom: D(-3), gaps: [{ day: D(-3) }, { day: D(-1) }] }),
      s({ deliveredThrough: D(-2), resendFrom: D(-1), gaps: [{ day: D(-1) }] }),
      s({ live: false, deliveredThrough: D(-20), resendFrom: D(-19), gaps: [{ day: D(-19) }] }),
    ], NOW, CFG);
    expect(w).toEqual({ deliveredThrough: D(-4), resendFrom: D(-3), gapDays: 2, oldestGap: D(-3) });
  });

  it("yopilish muddati kelmagan kecha (01:00 UZ) — watermark ushlanadi, lekin gapDays/oldestGap ga kirmaydi", () => {
    const beforeClose = new Date("2026-09-26T20:00:00Z");
    const c = clinic([...finals(-10, -2), partial(D(-1))], { now: beforeClose });
    expect(Dl.globalWatermark([c], beforeClose, CFG)).toEqual({ deliveredThrough: D(-2), resendFrom: null, gapDays: 0, oldestGap: null });
  });

  it("hammasi yetkazilgan — resendFrom null; jonli klinika yo'q — hammasi null", () => {
    expect(Dl.globalWatermark([s({})], NOW, CFG)).toEqual({ deliveredThrough: D(-1), resendFrom: null, gapDays: 0, oldestGap: null });
    expect(Dl.globalWatermark([s({ live: false })], NOW, CFG)).toEqual({ deliveredThrough: null, resendFrom: null, gapDays: 0, oldestGap: null });
  });

  it("B o'qilmagan yangi bo'lak — B teshiklari resendFrom ni o'zi qaytaradi", () => {
    const a = clinic(finals(-10, -1));
    const b = Dl.summarizeClinic({
      dbname: "B", byDay: byDay([...finals(-10, -4), partial(D(-3)), partial(D(-2)), partial(D(-1))]),
      meta: { firstDay: D(-10) }, now: NOW, cfg: CFG,
    });
    expect(Dl.globalWatermark([a, b], NOW, CFG)).toMatchObject({ deliveredThrough: D(-4), resendFrom: D(-3), gapDays: 3 });
  });
});

describe("gapsInRange — /days", () => {
  it("firstDay dan oldin not_started (teshik emas); bugun — hech qachon teshik; eski teshik ham ko'rinadi", () => {
    const days = [D(-40), D(-39), D(-38), D(-1), D(0)];
    const { entries, gaps } = Dl.gapsInRange({
      byDay: byDay([final(D(-38)), partial(D(0))]), meta: { firstDay: D(-39) }, days, now: NOW, cfg: CFG,
    });
    expect(entries.map((e) => e.delivery)).toEqual(["not_started", "none", "final", "none", "open"]);
    expect(gaps).toEqual([{ day: D(-39), delivery: "none" }, { day: D(-1), delivery: "none" }]);
  });
});

describe("computeWatermark — o'qish", () => {
  const seed = (rows) => {
    const dbnames = [...new Set(rows.map((r) => r.dbname))];
    SamsOrgDay.aggregate
      .mockResolvedValueOnce(dbnames.map((d) => ({ _id: d, firstDay: D(-3) })))
      .mockResolvedValueOnce(dbnames.map((d) => ({ _id: d, lastDay: D(0), orgTitle: d, lastReceivedAt: NOW })));
    SamsOrgDay.find.mockReturnValue({ select: () => ({ lean: async () => rows }) });
  };
  beforeEach(() => latestPacket.mockResolvedValue(null));

  it("meta (ikki DISTINCT_SCAN) + oyna qatorlari (bugun-46..bugun, $in)", async () => {
    seed([{ dbname: "A", ...final(D(-3)) }, { dbname: "A", ...partial(D(-2)) }]);
    await expect(Dl.computeWatermark(NOW)).resolves.toEqual({ deliveredThrough: D(-3), resendFrom: D(-2) });
    expect(SamsOrgDay.find).toHaveBeenCalledWith({ dbname: { $in: ["A"] }, day: { $gte: D(-46), $lte: D(0) } });
    expect(SamsOrgDay.aggregate.mock.calls[0][0][0]).toEqual({ $sort: { dbname: 1, day: 1 } });
  });

  it("oxirgi paketda yo'q klinika (roster rezidentini yo'qotgan) watermark va resendFrom ni ushlamaydi", async () => {
    const rows = [
      ...[-3, -2, -1].map((n) => ({ dbname: "A", ...final(D(n)) })),
      { dbname: "B", ...final(D(-3)) }, { dbname: "B", ...partial(D(-2)) },
    ];
    seed(rows);
    latestPacket.mockResolvedValueOnce({ tenantDbnames: ["A"], failedTenants: [] });
    const snap = await Dl.deliverySnapshot(NOW);
    expect(snap.clinics.map((c) => [c.dbname, c.live])).toEqual([["A", true], ["B", false]]);
    expect(snap.watermark).toEqual({ deliveredThrough: D(-1), resendFrom: null, gapDays: 0, oldestGap: null });
    expect(snap.lastPacket).toEqual({ tenantDbnames: ["A"], failedTenants: [] });
    seed(rows);
    latestPacket.mockResolvedValueOnce({ tenantDbnames: ["A"], failedTenants: [{ dbname: "B" }] });
    await expect(Dl.computeWatermark(NOW)).resolves.toEqual({ deliveredThrough: D(-3), resendFrom: D(-2) });
  });
});
