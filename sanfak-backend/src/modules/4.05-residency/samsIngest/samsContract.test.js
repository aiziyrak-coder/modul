"use strict";

const C = require("./samsContract");

describe("addDays — kalendar arifmetikasi", () => {
  it.each([
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-03-01", -1, "2028-02-29"],
    ["2027-03-01", -1, "2027-02-28"],
    ["2026-09-27", -30, "2026-08-28"],
    ["2026-01-31", 1, "2026-02-01"],
  ])("%s %+d → %s", (day, n, want) => {
    expect(C.addDays(day, n)).toBe(want);
  });

  it("yaroqsiz kirish → null", () => {
    expect(C.addDays("2026/09/27", 1)).toBeNull();
    expect(C.addDays(null, 1)).toBeNull();
  });
});

describe("isDayKey — haqiqiy kalendar kuni", () => {
  it.each(["2026-09-27", "2028-02-29", "2026-12-31"])("%s — ha", (d) => {
    expect(C.isDayKey(d)).toBe(true);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-9-27", "2026-09-27T00:00", "", null, 20260927])(
    "%p — yo'q",
    (d) => {
      expect(C.isDayKey(d)).toBe(false);
    },
  );
});

describe("enumerateDays va daysInclusive", () => {
  it("oraliq ikkala chetini ham o'z ichiga oladi", () => {
    expect(C.enumerateDays("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
    ]);
    expect(C.enumerateDays("2026-09-27", "2026-09-27")).toEqual(["2026-09-27"]);
  });

  it("teskari yoki yaroqsiz oraliq → []", () => {
    expect(C.enumerateDays("2026-09-28", "2026-09-27")).toEqual([]);
    expect(C.enumerateDays("2026-02-30", "2026-03-02")).toEqual([]);
  });

  it(`uzun oraliq ${C.MAX_PACKET_DAYS} kunda kesiladi`, () => {
    const days = C.enumerateDays("2026-01-01", "2026-12-31");
    expect(days).toHaveLength(C.MAX_PACKET_DAYS);
    expect(days[0]).toBe("2026-01-01");
  });

  it("daysInclusive oy chegarasidan o'tadi", () => {
    expect(C.daysInclusive("2026-09-27", "2026-09-27")).toBe(1);
    expect(C.daysInclusive("2026-08-28", "2026-09-27")).toBe(31);
    expect(C.daysInclusive("2028-02-28", "2028-03-01")).toBe(3);
  });

  it("eng eski qabul qilinadigan kun — bugun-30", () => {
    expect(C.oldestAcceptedDay("2026-09-27")).toBe("2026-08-28");
  });
});

describe("FINAL qoidasi — nextDayStartMs / isFinalPacket", () => {
  it("kun oxiri — keyingi kunning UZ yarim tuni (UTC 19:00)", () => {
    expect(new Date(C.nextDayStartMs("2026-09-27")).toISOString()).toBe("2026-09-27T19:00:00.000Z");
  });

  it("yarim tundan keyingi snapshot — FINAL, oldingisi — yo'q", () => {
    expect(C.isFinalPacket(new Date("2026-09-27T19:00:00Z"), "2026-09-27")).toBe(true);
    expect(C.isFinalPacket("2026-09-28T01:30:00Z", "2026-09-27")).toBe(true);
    expect(C.isFinalPacket(new Date("2026-09-27T18:59:59.999Z"), "2026-09-27")).toBe(false);
  });

  it("yo'q yoki yaroqsiz qiymat — FINAL emas", () => {
    expect(C.isFinalPacket(null, "2026-09-27")).toBe(false);
    expect(C.isFinalPacket(undefined, "2026-09-27")).toBe(false);
    expect(C.isFinalPacket("salom", "2026-09-27")).toBe(false);
    expect(C.isFinalPacket(new Date("2030-01-01"), "2026-02-30x")).toBe(false);
  });
});

describe("isFinalRow — rezident × kun: IKKALA qator yakuniy", () => {
  const TICK = new Date("2026-09-27T05:00:00Z");
  const NIGHT = new Date("2026-09-27T20:30:00Z");
  const presence = (packetAt, over = {}) => ({ day: "2026-09-27", dbname: "A", packetAt, ...over });
  const org = (packetAt, over = {}) => ({ day: "2026-09-27", dbname: "A", packetAt, ...over });

  it("ikkalasi yakuniy → FINAL", () => {
    expect(C.isFinalRow(presence(NIGHT), org(NIGHT))).toBe(true);
    expect(C.isFinalRow(presence(new Date("2026-09-27T19:00:00Z")), org(NIGHT))).toBe(true);
  });

  it("klinika yakuniy, rezident qatori qisman (yakuniy paket uni qayta yozmagan) → FINAL EMAS", () => {
    expect(C.isFinalPacket(org(NIGHT).packetAt, "2026-09-27")).toBe(true);
    expect(C.isFinalRow(presence(TICK), org(NIGHT))).toBe(false);
  });

  it("rezident yakuniy, klinika qisman → FINAL EMAS", () => {
    expect(C.isFinalRow(presence(NIGHT), org(TICK))).toBe(false);
  });

  it("klinika qatori yo'q yoki boshqa kun/klinikaniki → FINAL EMAS", () => {
    expect(C.isFinalRow(presence(NIGHT), null)).toBe(false);
    expect(C.isFinalRow(null, org(NIGHT))).toBe(false);
    expect(C.isFinalRow(presence(NIGHT), org(NIGHT, { dbname: "B" }))).toBe(false);
    expect(C.isFinalRow(presence(NIGHT), org(NIGHT, { day: "2026-09-26" }))).toBe(false);
  });
});

describe("shartnoma konstantalari", () => {
  it("egasining qarorlari (Q-I=A, 31 kun, 5 daqiqa)", () => {
    expect(C.SAMS_SCHEMA_VERSION).toBe(1);
    expect(C.RECONCILE_WINDOW_DAYS).toBe(7);
    expect(C.MAX_PACKET_DAYS).toBe(31);
    expect(C.MAX_EMIT_SKEW_MS).toBe(300000);
    expect(C.MAX_EMIT_AGE_DAYS).toBe(31);
  });

  it("dbname — SAMS naqshi, ≤100 belgi", () => {
    expect(C.DBNAME_RE.test("a".repeat(100))).toBe(true);
    expect(C.DBNAME_RE.test("a".repeat(101))).toBe(false);
    expect(C.DBNAME_RE.test("org/1")).toBe(false);
    expect(C.DBNAME_RE.test("64f0c2_ab-1")).toBe(true);
  });

  it("o'lchanmaganlik sabablari — `stale` bor, `outage` YO'Q", () => {
    expect(C.UNMEASURED_REASONS).toEqual([
      "unresolved", "ambiguous", "before_horizon", "before_registration", "no_schedule", "stale",
    ]);
    expect(C.ORG_UNMEASURED_REASONS).toEqual(["before_horizon", "stale"]);
  });
});
