"use strict";

const G = require("./samsDigest");

const NOW = new Date("2026-09-27T05:07:00Z");
const person = (id, isNew) => ({ resident: id, fullName: `Ism ${id}`, jshshir: `3010199000000${id}`, isNew });
const warnings = {
  unresolved: {
    count: 3,
    groups: [
      { dbname: "A", orgTitle: "Klinika A", residents: [person("1", true), person("2", true)] },
      { dbname: null, orgTitle: null, residents: [person("3", true)] },
    ],
  },
  ambiguous: { count: 1, items: [person("4", false)] },
  noSchedule: { count: 1, groups: [{ dbname: "B", orgTitle: "", residents: [person("5", true)] }] },
  inactiveUser: { count: 0, groups: [] },
  keys: ["unresolved:1", "unresolved:2", "unresolved:3", "ambiguous:4", "no_schedule:5"],
};
const content = (over = {}) => ({ today: "2026-09-27", warnings: null, gapKeys: [], last: { receivedAt: NOW }, liveness: "ok", ...over });

describe("digestDelta", () => {
  it("faqat yangi elementlar, klinika bo'yicha (nomsiz — dbname, topilmagan — noma'lum)", () => {
    const d = G.digestDelta(content({ warnings, gapKeys: ["A|2026-09-20", "B|2026-09-18"] }), { keys: ["ambiguous:4"], gapKeys: ["A|2026-09-20"] }, NOW);
    expect(d.lines).toEqual([
      "Yangi: JSHSHIR SAMS'da topilmadi — 3 (Klinika A: 2, noma'lum: 1)",
      "Yangi: smenasi yo'q — 1 (B: 1)",
      "Yetkazilmagan kunlar: 1 (eng eskisi 2026-09-18)",
    ]);
    expect(d.payload).toEqual({ keys: warnings.keys, gapKeys: ["A|2026-09-20", "B|2026-09-18"], unreadKeys: [] });
    expect(d.counts).toEqual({ unresolved: 3, ambiguous: 1, noSchedule: 1, inactiveUser: 0, newWarnings: 4, newGaps: 1, unreadClinics: 0 });
    expect(d.lines.join("\n")).not.toMatch(/\d{14}|Ism/);
  });

  it("ogohlantirishlar hisoblanmagan kun — oldingi kalitlar ko'chiriladi, qator yo'q", () => {
    const d = G.digestDelta(content(), { keys: ["unresolved:1"], gapKeys: [] }, NOW);
    expect(d.lines).toEqual([]);
    expect(d.payload.keys).toEqual(["unresolved:1"]);
    expect(G.digestDelta(content(), null, NOW).payload).toEqual({ keys: [], gapKeys: [], unreadKeys: [] });
  });

  it("jonlilik: to'xtagan va oxirgi paket ≤7 kun — qator (boshqa kun — sana bilan); 7 kundan eski — yo'q", () => {
    const at = (iso) => content({ liveness: "stale", last: { receivedAt: new Date(iso) } });
    expect(G.digestDelta(at("2026-09-25T13:15:00Z"), null, NOW).lines).toEqual([
      "SAMS'dan oxirgi paket: 2026-09-25 18:15 — bugungi davomat «o'lchanmagan»",
    ]);
    expect(G.digestDelta(at("2026-09-20T05:06:00Z"), null, NOW).lines).toEqual([]);
    expect(G.digestDelta(content({ liveness: "never", last: null }), null, NOW).lines).toEqual([]);
  });
});

describe("o'qilmagan klinikalar", () => {
  const unread = (dbnames) => dbnames.map((d) => ({ key: `failed:${d}|2026-09-27`, name: `Klinika ${d}` }));

  it("yangi kalitlar — bitta qator (≤5 nom), payload va son; oldingi yig'mada bo'lgani — yo'q", () => {
    const d = G.digestDelta(content({ unread: unread(["A", "B"]) }), null, NOW);
    expect(d.lines).toEqual(["Bugun o'qilmagan klinikalar: 2 (Klinika A, Klinika B)"]);
    expect(d.payload.unreadKeys).toEqual(["failed:A|2026-09-27", "failed:B|2026-09-27"]);
    expect(d.counts.unreadClinics).toBe(2);
    const many = G.digestDelta(content({ unread: unread(["A", "B", "C", "D", "E", "F"]) }), null, NOW);
    expect(many.lines).toEqual(["Bugun o'qilmagan klinikalar: 6 (Klinika A, Klinika B, Klinika C, Klinika D, Klinika E, …)"]);
    expect(G.digestDelta(content({ unread: unread(["A"]) }), { unreadKeys: ["failed:A|2026-09-27"] }, NOW).lines).toEqual([]);
  });

  it("unreadClinics (sof): jonli klinikaning bugungi qatori yo'q/eskirgan + failedTenants; tushgan va yangi klinika — yo'q", () => {
    const cfg = { staleAfterMs: 30 * 60_000, closeGraceMs: 6 * 3_600_000 };
    const row = (minutesAgo) => ({ day: "2026-09-27", measured: true, packetAt: new Date(NOW.getTime() - minutesAgo * 60_000), receivedAt: new Date(NOW.getTime() - minutesAgo * 60_000) });
    const snap = {
      today: "2026-09-27",
      clinics: [
        { dbname: "A", orgTitle: "Klinika A", live: true },
        { dbname: "B", orgTitle: "", live: true },
        { dbname: "C", orgTitle: "Klinika C", live: true },
        { dbname: "D", orgTitle: "Klinika D", live: false },
      ],
      rowsByClinic: new Map([["A", new Map([["2026-09-27", row(5)]])], ["C", new Map([["2026-09-27", row(40)]])]]),
      lastPacket: { failedTenants: [{ dbname: "E", orgTitle: "Klinika E" }, { dbname: "A", orgTitle: "Klinika A" }] },
    };
    expect(G.unreadClinics(snap, NOW, cfg)).toEqual([
      { key: "failed:B|2026-09-27", name: "B" },
      { key: "failed:C|2026-09-27", name: "Klinika C" },
      { key: "failed:E|2026-09-27", name: "Klinika E" },
    ]);
  });
});

describe("livenessOf", () => {
  const cfg = { staleAfterMs: 30 * 60_000 };
  it("ok / stale / never", () => {
    expect(G.livenessOf({ receivedAt: new Date(NOW.getTime() - 30 * 60_000) }, NOW, cfg)).toBe("ok");
    expect(G.livenessOf({ receivedAt: new Date(NOW.getTime() - 30 * 60_000 - 1) }, NOW, cfg)).toBe("stale");
    expect(G.livenessOf(null, NOW, cfg)).toBe("never");
  });
});
