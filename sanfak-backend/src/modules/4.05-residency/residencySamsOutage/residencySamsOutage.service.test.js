"use strict";

const { assertRange, listFilter, MAX_SPAN_DAYS } = require("./residencySamsOutage.service");

const TODAY = "2026-09-27";
const reasonOf = (range) => {
  try {
    assertRange(range, TODAY);
    return null;
  } catch (err) {
    expect(err.statusCode).toBe(400);
    return err.meta.reason;
  }
};

describe("assertRange — from <= to <= bugun, ≤366 kun", () => {
  it("to'g'ri oraliqlar", () => {
    expect(reasonOf({ from: "2026-09-27", to: "2026-09-27" })).toBeNull();
    expect(reasonOf({ from: "2025-09-27", to: "2026-09-27" })).toBeNull();
  });

  it.each([
    ["from > to", { from: "2026-09-21", to: "2026-09-20" }],
    ["kelajak", { from: "2026-09-27", to: "2026-09-28" }],
    ["367 kun", { from: "2025-09-26", to: "2026-09-27" }],
  ])("%s → outage_range_invalid", (_l, range) => {
    expect(reasonOf(range)).toBe("outage_range_invalid");
  });

  it("chegara — 366 kun", () => {
    expect(MAX_SPAN_DAYS).toBe(366);
  });
});

describe("listFilter — holat va kesishish", () => {
  it.each([
    [{}, { cancelledAt: null }],
    [{ status: "active" }, { cancelledAt: null }],
    [{ status: "cancelled" }, { cancelledAt: { $ne: null } }],
    [{ status: "all" }, {}],
  ])("%p → %p", (q, want) => {
    expect(listFilter(q)).toEqual(want);
  });

  it("from/to — oyna so'ralgan oraliqqa kamida bir kun tegadi", () => {
    expect(listFilter({ status: "all", from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: { $lte: "2026-09-30" },
      to: { $gte: "2026-09-01" },
    });
    expect(listFilter({ status: "all", from: "2026-09-01" })).toEqual({ to: { $gte: "2026-09-01" } });
  });
});
