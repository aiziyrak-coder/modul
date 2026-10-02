"use strict";

const {
  yearScoreOf,
  yearScorePath,
  rankingSort,
  resolveScoreYear,
} = require("./yearScore");
const { currentAcademicYear } = require("./academicYearWindow");

const YIL = currentAcademicYear();

describe("yearScoreOf — uchala o'qish shakli", () => {
  test("lean obyekt", () => {
    expect(yearScoreOf({ scoresByYear: { "2025/2026": 80 } }, "2025/2026")).toBe(80);
  });

  test("🔴 mongoose Map (kontroller aynan shuni beradi)", () => {
    const doc = { scoresByYear: new Map([["2025/2026", 80]]) };
    expect(yearScoreOf(doc, "2025/2026")).toBe(80);
  });

  test.each([
    ["maydon yo'q", {}],
    ["null", { scoresByYear: null }],
    ["hujjatning o'zi yo'q", undefined],
    ["yil kaliti yo'q", { scoresByYear: { "2024/2025": 5 } }],
    ["bo'sh Map", { scoresByYear: new Map() }],
  ])("%s → 0", (_name, gifted) => {
    expect(yearScoreOf(gifted, YIL)).toBe(0);
  });

  test("son bo'lmagan qiymat → 0 (NaN tarqalmasin)", () => {
    expect(yearScoreOf({ scoresByYear: { [YIL]: "80" } }, YIL)).toBe(0);
  });

  test("0 ball — haqiqiy qiymat, yo'qlikdan farq qilmasa ham xato bermaydi", () => {
    expect(yearScoreOf({ scoresByYear: { [YIL]: 0 } }, YIL)).toBe(0);
  });

  test("yil berilmasa JORIY yil olinadi", () => {
    expect(yearScoreOf({ scoresByYear: { [YIL]: 42 } })).toBe(42);
  });

  test("🔴 `totalScore` ni O'QIMAYDI — umrbod ball yil baliga sizmaydi", () => {
    expect(yearScoreOf({ totalScore: 999, scoresByYear: { "2025/2026": 999 } }, YIL)).toBe(0);
  });
});

describe("yearScorePath", () => {
  test("mongo nuqtali yo'li", () => {
    expect(yearScorePath("2026/2027")).toBe("scoresByYear.2026/2027");
  });

  test("yil berilmasa joriy yil", () => {
    expect(yearScorePath()).toBe(`scoresByYear.${YIL}`);
  });
});

describe("rankingSort — TARTIB BARQAROR bo'lishi shart", () => {
  test("asosiy kalit — shu yilgi ball", () => {
    expect(rankingSort("2026/2027")["scoresByYear.2026/2027"]).toBe(-1);
  });

  test("🔴 ikkita ZAXIRA kalit bor", () => {
    const s = rankingSort("2026/2027");
    expect(Object.keys(s)).toEqual(["scoresByYear.2026/2027", "totalScore", "fullName"]);
    expect(s.totalScore).toBe(-1);
    expect(s.fullName).toBe(1);
  });

  test("kalitlar TARTIBI muhim — ball birinchi", () => {
    expect(Object.keys(rankingSort(YIL))[0]).toBe(`scoresByYear.${YIL}`);
  });
});

describe("resolveScoreYear — `?scoreYear=`", () => {
  test.each([
    ["kanonik slash", "2025/2026", "2025/2026"],
    ["tire imlosi ham (saqlangan snapshotlarda uchraydi)", "2025-2026", "2025/2026"],
    ["bo'shliqlar bilan", "  2024 / 2025 ", "2024/2025"],
  ])("%s", (_name, raw, expected) => {
    expect(resolveScoreYear(raw)).toBe(expected);
  });

  test.each([
    ["berilmagan", undefined],
    ["null", null],
    ["bo'sh satr", ""],
    ["`all` sentineli", "all"],
    ["hex `_id`", "69df7a8f94bda50c83a1d3f1"],
    ["yaroqsiz", "2026"],
  ])("%s → JORIY yil", (_name, raw) => {
    expect(resolveScoreYear(raw)).toBe(YIL);
  });

  test("🔴 hex QABUL QILINMAYDI — bu ref emas, XARITA KALITI", () => {
    expect(resolveScoreYear("69df7a8f94bda50c83a1d3f1")).toBe(YIL);
  });
});
