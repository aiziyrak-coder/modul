"use strict";

const {
  DAY_RE,
  isCalendarDay,
  todayUz,
  academicYearLastDay,
  announceableRange,
  isDayOpen,
} = require("./sessionDay");

describe("isCalendarDay — shakl VA mavjudlik", () => {
  test.each(["2026-09-27", "2028-02-29", "2026-12-31", "2027-01-01"])("%s — haqiqiy kun", (s) => {
    expect(isCalendarDay(s)).toBe(true);
  });

  test.each([
    ["2026-02-30", "mavjud emas"],
    ["2027-02-29", "kabisa emas"],
    ["2026-2-3", "nolsiz"],
    ["26-09-27", "ikki xonali yil"],
    ["2026-13-01", "13-oy"],
    ["2026-09-27T00:00:00Z", "vaqt bilan"],
    [" 2026-09-27", "bosh probel"],
    [20260927, "son"],
    [null, "null"],
  ])("%p — rad (%s)", (s) => {
    expect(isCalendarDay(s)).toBe(false);
  });

  test("DAY_RE faqat shaklni tekshiradi (mavjudlik — isCalendarDay)", () => {
    expect(DAY_RE.test("2026-02-30")).toBe(true);
    expect(DAY_RE.test("2026-00-10")).toBe(false);
  });
});

describe("todayUz — UTC+5", () => {
  test("UTC 19:30 — UZ bo'yicha allaqachon ertangi kun", () => {
    expect(todayUz(new Date("2026-09-26T19:30:00Z"))).toBe("2026-09-27");
    expect(todayUz(new Date("2026-09-26T18:59:59Z"))).toBe("2026-09-26");
  });

  test("soat modul darajasida muzlamagan — ikki xil `now`, ikki xil natija", () => {
    expect(todayUz(new Date("2026-10-01T10:00:00Z"))).toBe("2026-10-01");
    expect(todayUz(new Date("2026-10-02T10:00:00Z"))).toBe("2026-10-02");
    expect(todayUz()).toBe(new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10));
  });
});

describe("academicYearLastDay — 31-avgust", () => {
  test.each([
    ["2026-09-01", "2027-08-31"],
    ["2027-01-15", "2027-08-31"],
    ["2027-08-31", "2027-08-31"],
    ["2027-09-01", "2028-08-31"],
  ])("%s → %s", (day, last) => {
    expect(academicYearLastDay(day)).toBe(last);
  });
});

describe("announceableRange — bugundan o'quv yili oxirigacha", () => {
  test("UTC oy tuzog'i: 31-avgust 20:00Z = UZ 1-sentabr → YANGI o'quv yili", () => {
    expect(announceableRange(new Date("2026-08-31T20:00:00Z"))).toEqual({ from: "2026-09-01", to: "2027-08-31" });
  });

  test("31-avgust UZ kunduzi — oyna bir kunlik", () => {
    expect(announceableRange(new Date("2027-08-31T10:00:00Z"))).toEqual({ from: "2027-08-31", to: "2027-08-31" });
  });

  test("har chaqiruvda hisoblanadi", () => {
    expect(announceableRange(new Date("2026-10-01T10:00:00Z")).from).toBe("2026-10-01");
    expect(announceableRange(new Date("2026-10-05T10:00:00Z")).from).toBe("2026-10-05");
  });
});

describe("isDayOpen — bugun va kelajak ochiq", () => {
  const now = new Date("2026-09-27T10:00:00Z");
  test.each([
    ["2026-09-26", false],
    ["2026-09-27", true],
    ["2026-09-28", true],
    [null, false],
  ])("%p → %p", (day, open) => {
    expect(isDayOpen(day, now)).toBe(open);
  });

  test("UZ yarim tuni chegarasi (UTC 19:00)", () => {
    expect(isDayOpen("2026-09-27", new Date("2026-09-27T18:59:59Z"))).toBe(true);
    expect(isDayOpen("2026-09-27", new Date("2026-09-27T19:00:00Z"))).toBe(false);
  });
});
