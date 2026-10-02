"use strict";

const {
  classify,
  inScope,
  buildPlan,
  parseArgs,
  exitCodeFor,
  toHundredScale,
} = require("./migrate-45-lesson-score-100");

const CUT = new Date("2026-10-05T04:00:00Z");
const BEFORE = new Date(CUT.getTime() - 1);
const AFTER = new Date(CUT.getTime() + 1);

describe("toHundredScale", () => {
  test.each([
    [0, 0],
    [0.7, 7],
    [7.25, 72.5],
    [7.333, 73.33],
    [7.12345, 71.23],
    [8, 80],
    [10, 100],
  ])("%p → %p", (v, expected) => {
    expect(toHundredScale(v)).toBe(expected);
  });
});

describe("classify", () => {
  test.each([
    [null, "skip"],
    [undefined, "skip"],
    ["8", "skip"],
    [0, "zero"],
    [0.5, "legacy"],
    [10, "legacy"],
    [-1, "anomaly"],
    [11, "anomaly"],
    [10.01, "anomaly"],
    [Number.NaN, "anomaly"],
    [Number.POSITIVE_INFINITY, "anomaly"],
  ])("%p → %s", (score, kind) => {
    expect(classify(score)).toBe(kind);
  });
});

describe("inScope — kesim (LSC-Q7=A)", () => {
  test("kesimsiz (dry-run) — hammasi qamrovda", () => {
    expect(inScope({ scoredAt: AFTER }, "scoredAt", null)).toBe(true);
  });

  test.each([
    ["freym, scoredAt null", { scoredAt: null }, "scoredAt", true],
    ["freym, scoredAt yo'q", {}, "scoredAt", true],
    ["freym, kesimdan oldin", { scoredAt: BEFORE }, "scoredAt", true],
    ["freym, aynan kesimda", { scoredAt: CUT }, "scoredAt", false],
    ["freym, kesimdan keyin", { scoredAt: AFTER }, "scoredAt", false],
    ["qator, scoreRev null", { scoreRev: null }, "scoreRev", true],
    ["qator, kesimdan oldin (ms)", { scoreRev: BEFORE.getTime() }, "scoreRev", true],
    ["qator, aynan kesimda (ms)", { scoreRev: CUT.getTime() }, "scoreRev", false],
    ["qator, kesimdan keyin (ms)", { scoreRev: AFTER.getTime() }, "scoreRev", false],
    ["o'qib bo'lmaydigan revizya — chetda (xavfsiz tomon)", { scoreRev: { x: 1 } }, "scoreRev", false],
  ])("%s → %p", (_label, doc, field, expected) => {
    expect(inScope(doc, field, CUT)).toBe(expected);
  });
});

describe("buildPlan", () => {
  const docs = () => ({
    attendances: [
      { _id: "a1", score: 8, scoreRev: null, status: "present", deletedAt: null, session: "s1" },
      { _id: "a2", score: 7.25, status: "absent", deletedAt: new Date("2026-09-01"), session: null },
      { _id: "a3", score: 0 },
      { _id: "a4", score: 12 },
      { _id: "a5", score: 9, scoreRev: AFTER.getTime() },
      { _id: "a6", score: 85, scoreRev: AFTER.getTime() },
      { _id: "a7", score: 6, session: null, updatedAt: AFTER },
      { _id: "a8", score: null },
    ],
    rosters: [
      { _id: "r1", score: 9, scoredAt: BEFORE, outcome: "present", cancelledAt: null },
      { _id: "r2", score: 6, scoredAt: null, outcome: "absent", cancelledAt: BEFORE },
      { _id: "r3", score: 8, scoredAt: AFTER, outcome: "present" },
    ],
  });

  test("reja: freymlar AVVAL, eski → ×10; nol, anomaliya va kesimdan keyingisi rejada YO'Q", () => {
    const { entries } = buildPlan(docs(), CUT);
    expect(entries).toEqual([
      { coll: "rosters", _id: "r1", old: 9, next: 90 },
      { coll: "rosters", _id: "r2", old: 6, next: 60 },
      { coll: "attendances", _id: "a1", old: 8, next: 80 },
      { coll: "attendances", _id: "a2", old: 7.25, next: 72.5 },
      { coll: "attendances", _id: "a7", old: 6, next: 60 },
    ]);
  });

  test("statistika: sanoqlar, namunalar, bo'linma, chetlangan ≤ 10, kesimdan keyin tegilgan qo'lda qator", () => {
    const { stats } = buildPlan(docs(), CUT);
    expect(stats.attendances).toMatchObject({
      scored: 7, legacy: 3, zero: 1, anomaly: 1, anomalies: ["attendances:a4:12"],
      excluded: 2, excludedLow: 1, excludedLowList: ["attendances:a5:9"],
      split: { deleted: 1, notPresent: 2 }, touched: 1, touchedList: ["attendances:a7:6"],
      score: { min: 0, max: 85 },
    });
    expect(stats.rosters).toMatchObject({
      scored: 3, legacy: 2, excluded: 1, excludedLowList: ["rosters:r3:8"],
      split: { cancelled: 1, notPresent: 1 },
    });
  });

  test("kesimsiz (dry-run) — kesimdan keyingilar ham tasniflanadi, chetlangan 0", () => {
    const { entries, stats } = buildPlan(docs(), null);
    expect(entries.map((e) => e._id)).toEqual(["r1", "r2", "r3", "a1", "a2", "a5", "a7"]);
    expect(stats.attendances).toMatchObject({ excluded: 0, anomaly: 2, touched: 0 });
  });
});

describe("parseArgs", () => {
  const NOW = new Date("2026-10-06T00:00:00Z");
  const parse = (...argv) => parseArgs(argv, NOW);

  test("bayroqsiz — dry-run, xato yo'q", () => {
    expect(parse()).toMatchObject({ apply: false, cutoff: null, anomalies: "refuse", error: null });
  });

  test("to'liq --apply", () => {
    const a = parse("--apply", "--graded-before=2026-10-05T04:12:00+05:00", "--anomalies=keep", "--db=demo");
    expect(a).toMatchObject({ apply: true, anomalies: "keep", dbName: "demo", error: null });
    expect(a.cutoff.toISOString()).toBe("2026-10-04T23:12:00.000Z");
  });

  test.each([
    ["--apply kesimsiz", ["--apply"], /MAJBURIY/],
    ["--apply + --revert", ["--apply", "--revert=x.json", "--graded-before=2026-10-05T04:12:00Z"], /birga/],
    ["vaqt zonasiz kesim", ["--graded-before=2026-10-05T04:12:00"], /vaqt zonasi/],
    ["faqat sana", ["--graded-before=2026-10-05"], /vaqt zonasi/],
    ["kelajakdagi kesim", ["--graded-before=2026-10-07T00:00:00Z"], /kelajakda/],
    ["--anomalies=<boshqa>", ["--anomalies=convert"], /faqat =keep/],
    ["noma'lum bayroq (typo)", ["--aply"], /noma'lum bayroq: --aply/],
    ["olib tashlangan --resume", ["--resume"], /noma'lum bayroq/],
  ])("%s — usage xatosi", (_label, argv, re) => {
    expect(parse(...argv).error).toMatch(re);
  });
});

describe("exitCodeFor", () => {
  const applied = (other = []) => ({ refused: null, applied: { other } });

  test.each([
    ["dry-run", { refused: null, applied: null }, 0],
    ["toza --apply", applied(), 0],
    ["raced", applied(["attendances:x:7"]), 1],
    ["anomaliya radi", { refused: { code: "anomalies", exit: 1 } }, 1],
    ["sentinel radi", { refused: { code: "already_applied", exit: 2 } }, 2],
    ["toza --revert", { refused: null, reverted: { other: [] } }, 0],
    ["--revert, tahrirlangani tegilmadi", { refused: null, reverted: { other: ["rosters:y:85"] } }, 1],
  ])("%s → %p", (_label, result, code) => {
    expect(exitCodeFor(result)).toBe(code);
  });
});
