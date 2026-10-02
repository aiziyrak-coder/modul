"use strict";

const {
  countMissedDays,
  absenceWindow,
  windowRange,
  groupByDay,
  meetsThreshold,
} = require("./absenceStreak");

const at = (day, status, hour = 6) => ({
  date: new Date(`${day}T${String(hour).padStart(2, "0")}:00:00.000Z`),
  status,
});

describe("groupByDay", () => {
  it("bir kundagi bir nechta dars BIR kun bo'ladi", () => {
    const days = groupByDay([
      at("2026-09-01", "absent", 6),
      at("2026-09-01", "absent", 9),
      at("2026-09-01", "absent", 12),
    ]);
    expect(days.size).toBe(1);
    expect(days.get("2026-09-01").miss).toBe(true);
  });

  it("bitta darsga kelgan bo'lsa kun QOLDIRILGAN emas", () => {
    const days = groupByDay([at("2026-09-01", "absent"), at("2026-09-01", "present")]);
    expect(days.get("2026-09-01").miss).toBe(false);
  });

  it("sababi tasdiqlangan kun ham qoldirilgan emas", () => {
    const days = groupByDay([at("2026-09-01", "absent"), at("2026-09-01", "excused")]);
    expect(days.get("2026-09-01").miss).toBe(false);
  });

  it("mahalliy 02:00 (UTC 21:00, oldingi kun) O'SHA kunga tushadi", () => {
    const days = groupByDay([
      { date: new Date("2026-08-31T21:00:00.000Z"), status: "absent" },
    ]);
    expect([...days.keys()]).toEqual(["2026-09-01"]);
  });

  it("sanasi buzuq yozuv e'tiborga olinmaydi", () => {
    const days = groupByDay([
      { date: null, status: "absent" },
      { date: "salom", status: "absent" },
      at("2026-09-01", "absent"),
    ]);
    expect(days.size).toBe(1);
  });
});

describe("absenceWindow — bugundan oldingi W yopilgan kun (ABS-Q4=A)", () => {
  it("W=7: bugun kirmaydi, kecha — oxirgi kun", () => {
    expect(absenceWindow("2026-09-30", 7)).toEqual({
      windowDays: 7,
      windowFrom: "2026-09-23",
      windowTo: "2026-09-29",
    });
  });

  it("W=1 — faqat kecha", () => {
    expect(absenceWindow("2026-09-30", 1)).toMatchObject({
      windowFrom: "2026-09-29",
      windowTo: "2026-09-29",
    });
  });

  it("W=30 ishlaydi", () => {
    expect(absenceWindow("2026-09-30", 30)).toMatchObject({
      windowFrom: "2026-08-31",
      windowTo: "2026-09-29",
    });
  });

  it("yil chegarasidan o'tadi", () => {
    expect(absenceWindow("2027-01-02", 7)).toMatchObject({
      windowFrom: "2026-12-26",
      windowTo: "2027-01-01",
    });
  });

  it("o'quv yili chegarasida kesilmaydi", () => {
    expect(absenceWindow("2026-09-03", 7)).toMatchObject({
      windowFrom: "2026-08-27",
      windowTo: "2026-09-02",
    });
  });

  it.each([
    ["", 7],
    [null, 7],
    ["2026-02-30", 7],
    ["2026-9-30", 7],
    ["2026-09-30", null],
    ["2026-09-30", 0],
    ["2026-09-30", -1],
    ["2026-09-30", 2.5],
    ["2026-09-30", "7"],
    ["2026-09-30", true],
    ["2026-09-30", "salom"],
  ])("yaroqsiz (bugun=%p, W=%p) — null", (today, w) => {
    expect(absenceWindow(today, w)).toBeNull();
  });
});

describe("windowRange — so'rov chegarasi UZ yarim tunlarida (ABS-Q8=A)", () => {
  it("[windowFrom UZ 00:00, bugun UZ 00:00)", () => {
    expect(windowRange({ windowFrom: "2026-09-19", windowTo: "2026-09-25" })).toEqual({
      $gte: new Date("2026-09-18T19:00:00.000Z"),
      $lt: new Date("2026-09-25T19:00:00.000Z"),
    });
  });
});

describe("countMissedDays — oxirgi W kunda sababsiz kunlar", () => {
  const kunOra = [
    at("2026-09-21", "absent"),
    at("2026-09-22", "present"),
    at("2026-09-23", "absent"),
    at("2026-09-24", "present"),
    at("2026-09-25", "absent", 6),
    at("2026-09-25", "absent", 9),
  ];

  it.each([
    ["2026-09-25", 2],
    ["2026-09-26", 3],
    ["2026-09-28", 3],
    ["2026-09-29", 2],
  ])("kun ora (Du–Chor–Ju), bugun %s -> %i kun", (today, want) => {
    expect(countMissedDays(kunOra, { today, windowDays: 7 }).days).toBe(want);
  });

  it("kun ora: from/to — birinchi/oxirgi sanalgan kun, oyna alohida", () => {
    expect(countMissedDays(kunOra, { today: "2026-09-26", windowDays: 7 })).toEqual({
      days: 3,
      from: "2026-09-21",
      to: "2026-09-25",
      dayKeys: ["2026-09-21", "2026-09-23", "2026-09-25"],
      windowDays: 7,
      windowFrom: "2026-09-19",
      windowTo: "2026-09-25",
    });
  });

  it("ketma-ket uch kun -> 3", () => {
    const rows = ["2026-09-23", "2026-09-24", "2026-09-25"].map((d) => at(d, "absent"));
    expect(countMissedDays(rows, { today: "2026-09-26", windowDays: 7 }).days).toBe(3);
  });

  it("yozuvi yo'q kunlar (shanba-yakshanba) sanalmaydi va hech narsani uzmaydi", () => {
    const rows = ["2026-09-25", "2026-09-28", "2026-09-29"].map((d) => at(d, "absent"));
    expect(countMissedDays(rows, { today: "2026-09-30", windowDays: 7 }).days).toBe(3);
  });

  it("🔴 keyingi `present` kun NOLGA tushirmaydi (ABS-Q5=A)", () => {
    const rows = [...kunOra, at("2026-09-26", "present")];
    expect(countMissedDays(rows, { today: "2026-09-27", windowDays: 7 }).days).toBe(3);
  });

  it("aralash kunlar: absent+present va absent+excused sanalmaydi, 3 dars — 1 kun", () => {
    const rows = [
      at("2026-09-23", "absent"),
      at("2026-09-23", "present", 9),
      at("2026-09-24", "absent"),
      at("2026-09-24", "excused", 9),
      at("2026-09-25", "absent", 6),
      at("2026-09-25", "absent", 8),
      at("2026-09-25", "absent", 10),
    ];
    const r = countMissedDays(rows, { today: "2026-09-26", windowDays: 7 });
    expect(r.days).toBe(1);
    expect(r.dayKeys).toEqual(["2026-09-25"]);
  });

  it("oyna chekkalari: 22 — yo'q, 23 va 29 — bor, bugun (30) va ertaga — yo'q", () => {
    const rows = ["2026-09-22", "2026-09-23", "2026-09-29", "2026-09-30", "2026-10-01"].map((d) =>
      at(d, "absent"),
    );
    expect(countMissedDays(rows, { today: "2026-09-30", windowDays: 7 }).dayKeys).toEqual([
      "2026-09-23",
      "2026-09-29",
    ]);
  });

  it("UZ yarim tuni chegaralari (bugun 30)", () => {
    const rows = [
      { date: new Date("2026-09-22T19:00:00.000Z"), status: "absent" },
      { date: new Date("2026-09-22T18:59:59.000Z"), status: "absent" },
      { date: new Date("2026-09-29T18:59:59.000Z"), status: "absent" },
      { date: new Date("2026-09-29T19:00:00.000Z"), status: "absent" },
    ];
    expect(countMissedDays(rows, { today: "2026-09-30", windowDays: 7 }).dayKeys).toEqual([
      "2026-09-23",
      "2026-09-29",
    ]);
  });

  it("yozuvlar tartibi ahamiyatsiz", () => {
    const rows = [...kunOra].reverse();
    expect(countMissedDays(rows, { today: "2026-09-26", windowDays: 7 }).dayKeys).toEqual([
      "2026-09-21",
      "2026-09-23",
      "2026-09-25",
    ]);
  });

  it("bo'sh ro'yxat — 0 kun, oyna baribir qaytadi", () => {
    expect(countMissedDays([], { today: "2026-09-30", windowDays: 7 })).toEqual({
      days: 0,
      from: null,
      to: null,
      dayKeys: [],
      windowDays: 7,
      windowFrom: "2026-09-23",
      windowTo: "2026-09-29",
    });
  });

  it.each([
    [{ today: "2026-09-30", windowDays: 0 }],
    [{ today: "2026-09-30" }],
    [{ today: "salom", windowDays: 7 }],
    [undefined],
  ])("yaroqsiz oyna (%p) — hammasi null, hech narsa sanalmaydi", (opts) => {
    expect(countMissedDays(kunOra, opts)).toEqual({
      days: 0,
      from: null,
      to: null,
      dayKeys: [],
      windowDays: null,
      windowFrom: null,
      windowTo: null,
    });
  });
});

describe("meetsThreshold — `>=` (ABS-Q2=A)", () => {
  it.each([
    [2, 3, false],
    [3, 3, true],
    [4, 3, true],
    [1, 1, true],
    [0, 1, false],
    [6, 7, false],
  ])("%i kun, ostona %i -> %p", (days, threshold, want) => {
    expect(meetsThreshold(days, threshold)).toBe(want);
  });

  it.each([null, undefined, 0, -1, "salom", NaN])(
    "yaroqsiz ostona (%p) — hech qachon ochilmaydi",
    (threshold) => {
      expect(meetsThreshold(99, threshold)).toBe(false);
    },
  );
});
