"use strict";

const { uzDayKey, isSameUzDay, uzDaysBetween, UZ_OFFSET_MINUTES } = require("./uzDay");

describe("uzDayKey", () => {
  it("UTC+5 ga suriladi", () => {
    expect(UZ_OFFSET_MINUTES).toBe(300);
  });

  it("`<input type=\"date\">` yuborgan UTC yarim tuni AYNI kunda qoladi", () => {
    expect(uzDayKey("2026-08-20T00:00:00.000Z")).toBe("2026-08-20");
  });

  it("mahalliy kechqurun — hali o'sha kun", () => {
    expect(uzDayKey("2026-08-20T18:00:00.000Z")).toBe("2026-08-20");
  });

  it("mahalliy tun (00:00–05:00) ERTASI kunga tegishli", () => {
    expect(uzDayKey("2026-08-20T21:00:00.000Z")).toBe("2026-08-21");
  });

  it("kun chegarasi: mahalliy 00:00", () => {
    expect(uzDayKey("2026-08-20T19:00:00.000Z")).toBe("2026-08-21");
    expect(uzDayKey("2026-08-20T18:59:00.000Z")).toBe("2026-08-20");
  });

  it("Date obyekti ham qabul qilinadi", () => {
    expect(uzDayKey(new Date("2026-08-20T10:00:00.000Z"))).toBe("2026-08-20");
  });

  it.each([null, undefined, "", "shunchaki-matn", NaN])("yaroqsiz %p -> null", (v) => {
    expect(uzDayKey(v)).toBeNull();
  });
});

describe("isSameUzDay", () => {
  it("bir xil mahalliy kun -> true", () => {
    expect(isSameUzDay("2026-08-20T00:00:00.000Z", "2026-08-20T18:00:00.000Z")).toBe(true);
  });

  it("tunda yuklangan O'SHA KUNGI ish kechikkan SANALMAYDI", () => {
    const workDate = "2026-08-21T00:00:00.000Z";
    const uploadedAt = "2026-08-20T21:00:00.000Z";
    expect(isSameUzDay(workDate, uploadedAt)).toBe(true);
  });

  it("boshqa kun -> false", () => {
    expect(isSameUzDay("2026-08-19T00:00:00.000Z", "2026-08-20T10:00:00.000Z")).toBe(false);
  });

  it("kechagi ish bugun yuklansa -> false (kechikkan)", () => {
    expect(isSameUzDay("2026-08-20T00:00:00.000Z", "2026-08-21T10:00:00.000Z")).toBe(false);
  });

  it("yaroqsiz sana -> false", () => {
    expect(isSameUzDay("yomon", "2026-08-20T10:00:00.000Z")).toBe(false);
    expect(isSameUzDay(null, null)).toBe(false);
  });
});

describe("uzDaysBetween", () => {
  const SWEEP = new Date("2031-09-23T03:00:00Z");
  it.each([
    ["bir lahza", "2031-09-23T03:00:00Z", 0],
    ["19-sana UZ 23:59:59 — 4 kun", "2031-09-19T18:59:59Z", 4],
    ["20-sana UZ 00:00 (bir soniya keyin) — 3 kun", "2031-09-19T19:00:00Z", 3],
    ["08:00:05 da ochilgan — 71.9986 soat bo'lsa ham 3-kun", "2031-09-20T03:00:05Z", 3],
  ])("%s", (_label, created, days) => {
    expect(uzDaysBetween(new Date(created), SWEEP)).toBe(days);
  });

  it("teskari tartib — manfiy; yaroqsiz sana — NaN", () => {
    expect(uzDaysBetween(SWEEP, new Date("2031-09-20T03:00:00Z"))).toBe(-3);
    for (const bad of [null, undefined, "", "yaroqsiz"]) expect(uzDaysBetween(bad, SWEEP)).toBeNaN();
    expect(uzDaysBetween(SWEEP, null)).toBeNaN();
  });
});
