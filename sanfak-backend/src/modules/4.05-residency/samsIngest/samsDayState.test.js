"use strict";

const S = require("./samsDayState");

const CFG = { staleAfterMs: 30 * 60_000, closeGraceMs: 6 * 3_600_000 };
const at = (iso) => new Date(iso);
const org = (over = {}) => ({
  dbname: "A", day: "2026-09-27", measured: true, unmeasuredReason: null,
  packetAt: at("2026-09-27T04:00:00Z"), receivedAt: at("2026-09-27T04:00:10Z"), ...over,
});

describe("dayStartMs, addDays, dayRange", () => {
  it("UZ kuni boshi = oldingi UTC kunining 19:00", () => {
    expect(S.dayStartMs("2026-09-27")).toBe(Date.parse("2026-09-26T19:00:00Z"));
    expect(S.dayStartMs("2026-02-30")).toBeNaN();
  });

  it("oy va yil chegarasidan o'tadi", () => {
    expect(S.addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(S.addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(S.addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(S.addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("oraliq ikkala chegara bilan; teskari — []; 93 dan uzun — RangeError", () => {
    expect(S.dayRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(S.dayRange("2026-09-27", "2026-09-26")).toEqual([]);
    expect(S.dayRange("2026-01-01", "2026-04-03")).toHaveLength(93);
    expect(() => S.dayRange("2026-01-01", "2026-04-04")).toThrow(RangeError);
    expect(() => S.dayRange("x", "2026-04-04")).toThrow(RangeError);
  });
});

describe("isFinal — kun tugagach o'qilgan snapshot", () => {
  const end = "2026-09-27T19:00:00.000Z";
  it("aynan keyingi UZ yarim tunida — true; 1 ms oldin — false; null — false", () => {
    expect(S.isFinal(org({ packetAt: at(end) }))).toBe(true);
    expect(S.isFinal(org({ packetAt: new Date(Date.parse(end) - 1) }))).toBe(false);
    expect(S.isFinal(org({ packetAt: null }))).toBe(false);
    expect(S.isFinal(null)).toBe(false);
  });
});

describe("isStale", () => {
  const recv = Date.parse("2026-09-27T04:00:10Z");
  it("bugun: aynan 30 daqiqa — yo'q; 1 ms keyin — ha", () => {
    expect(S.isStale(org(), new Date(recv + CFG.staleAfterMs), CFG)).toBe(false);
    expect(S.isStale(org(), new Date(recv + CFG.staleAfterMs + 1), CFG)).toBe(true);
  });

  it("o'tgan kun: ertasi 05:59:59.999 UZ — yo'q; 06:00 — ha (receivedAt ahamiyatsiz)", () => {
    const past = org({ day: "2026-09-26", packetAt: at("2026-09-26T10:00:00Z"), receivedAt: at("2026-09-27T00:59:00Z") });
    expect(S.isStale(past, at("2026-09-27T00:59:59.999Z"), CFG)).toBe(false);
    expect(S.isStale(past, at("2026-09-27T01:00:00Z"), CFG)).toBe(true);
  });

  it("kelajak kun va yakuniy kun hech qachon eskirmaydi", () => {
    expect(S.isStale(org({ day: "2026-09-28" }), at("2026-09-27T12:00:00Z"), CFG)).toBe(false);
    const final = org({ day: "2026-09-20", packetAt: at("2026-09-20T20:00:00Z"), receivedAt: at("2026-09-20T20:00:00Z") });
    expect(S.isStale(final, at("2026-09-27T12:00:00Z"), CFG)).toBe(false);
  });
});

describe("deliveryState va countsForAccrual", () => {
  const now = at("2026-09-27T04:10:00Z");
  const beforeClose = at("2026-09-26T22:00:00Z");
  it.each([
    ["qator yo'q", null, now, "none"],
    ["yakuniy", org({ day: "2026-09-26", packetAt: at("2026-09-26T20:00:00Z") }), now, "final"],
    ["saqlangan stale sababi", org({ measured: false, unmeasuredReason: "stale" }), now, "stale"],
    ["hozir eskirgan (cron'lar orasi)", org({ receivedAt: at("2026-09-27T03:30:00Z") }), now, "stale"],
    ["bugungi yangi qisman", org(), now, "open"],
    ["kecha, 06:00 dan oldin", org({ day: "2026-09-26", packetAt: at("2026-09-26T12:00:00Z") }), beforeClose, "open"],
    ["kecha, 06:00 dan keyin", org({ day: "2026-09-26", packetAt: at("2026-09-26T12:00:00Z") }), now, "stale"],
  ])("%s → %s", (_l, row, when, want) => {
    expect(S.deliveryState(row, when, CFG)).toBe(want);
  });

  it("faqat ikkala qator o'lchangan VA ikkalasi yakuniy bo'lsa", () => {
    const finalAt = at("2026-09-26T20:00:00Z");
    const o = org({ day: "2026-09-26", packetAt: finalAt });
    const p = { resident: "r", dbname: "A", day: "2026-09-26", measured: true, packetAt: finalAt };
    expect(S.countsForAccrual(p, o)).toBe(true);
    expect(S.countsForAccrual({ ...p, measured: false }, o)).toBe(false);
    expect(S.countsForAccrual(p, { ...o, measured: false })).toBe(false);
    expect(S.countsForAccrual(p, { ...o, packetAt: at("2026-09-26T18:59:00Z") })).toBe(false);
    expect(S.countsForAccrual({ ...p, packetAt: at("2026-09-26T18:00:00Z") }, o)).toBe(false);
    expect(S.countsForAccrual(p, null)).toBe(false);
    expect(S.countsForAccrual(null, o)).toBe(false);
  });
});
