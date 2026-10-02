"use strict";

const {
  academicYearOf,
  currentAcademicYear,
  START_MONTH,
} = require("./academicYearWindow");

describe("academicYearOf — sentabr–avgust oynasi", () => {
  test.each([
    ["1-sentabr — YANGI yil boshlanadi", new Date(2026, 8, 1), "2026/2027"],
    ["31-avgust — hali ESKI yil", new Date(2026, 7, 31), "2025/2026"],
    ["dekabr", new Date(2026, 11, 15), "2026/2027"],
    ["yanvar — o'tgan sentabrdan boshlangan yil", new Date(2027, 0, 15), "2026/2027"],
    ["iyun", new Date(2027, 5, 1), "2026/2027"],
  ])("%s", (_name, date, expected) => {
    expect(academicYearOf(date)).toBe(expected);
  });

  test("🔴 chegara — 31-avgust va 1-sentabr TURLI yillarga tushadi", () => {
    expect(academicYearOf(new Date(2026, 7, 31, 23, 59, 59))).toBe("2025/2026");
    expect(academicYearOf(new Date(2026, 8, 1, 0, 0, 0))).toBe("2026/2027");
  });

  test("jonli ma'lumotning AYNAN taqsimoti (o'lchangan 2026-09-09)", () => {
    expect(academicYearOf(new Date(2026, 7, 14))).toBe("2025/2026");
    expect(academicYearOf(new Date(2026, 8, 3))).toBe("2026/2027");
  });

  test("ISO satr ham qabul qilinadi (createdAt lean() dan satr bo'lib kelishi mumkin)", () => {
    expect(academicYearOf("2026-12-15T10:00:00.000Z")).toBe("2026/2027");
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["bo'sh satr", ""],
    ["yaroqsiz sana", "kecha"],
    ["Invalid Date", new Date("x")],
  ])("%s → null (yiqilmaydi)", (_name, input) => {
    expect(academicYearOf(input)).toBeNull();
  });

  test("format KANONIK — slash, 9 belgi", () => {
    const y = academicYearOf(new Date(2026, 8, 1));
    expect(y).toMatch(/^\d{4}\/\d{4}$/);
    expect(y).toHaveLength(9);
  });
});

describe("currentAcademicYear", () => {
  test("`now` berilsa o'shani ishlatadi", () => {
    expect(currentAcademicYear(new Date(2025, 9, 1))).toBe("2025/2026");
  });

  test("argumentsiz — bugungi sana bo'yicha, formati to'g'ri", () => {
    expect(currentAcademicYear()).toMatch(/^\d{4}\/\d{4}$/);
  });

  test("START_MONTH = 9 (sentabr) — qoida BITTA joyda", () => {
    expect(START_MONTH).toBe(9);
  });
});
