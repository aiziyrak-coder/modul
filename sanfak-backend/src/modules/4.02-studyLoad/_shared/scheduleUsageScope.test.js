"use strict";

const { startYearOf, usageScopeOfSchedule } = require("./scheduleUsageScope");

describe("startYearOf", () => {
  test.each([
    ["2027/2028", 2027],
    ["2027", 2027],
    [2026, 2026],
    ["2025/2026 o'quv yili", 2025],
    ["", null],
    [null, null],
    [undefined, null],
    ["yil", null],
  ])("%p → %p", (input, expected) => {
    expect(startYearOf(input)).toBe(expected);
  });
});

describe("usageScopeOfSchedule", () => {
  test("jadvaldan academicYear/year/direction qamrovi", () => {
    expect(
      usageScopeOfSchedule({ academicYear: "ay1", year: "2027/2028", direction: "dir1" }),
    ).toEqual({ academicYear: "ay1", year: 2027, direction: "dir1" });
  });
  test("bo'sh jadval → hammasi null (chaqiruvchi keng sanaydi)", () => {
    expect(usageScopeOfSchedule(null)).toEqual({ academicYear: null, year: null, direction: null });
  });
});
