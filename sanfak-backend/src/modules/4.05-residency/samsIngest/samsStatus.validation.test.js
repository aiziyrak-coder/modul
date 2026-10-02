"use strict";

const V = require("./samsStatus.validation");
const { resolveRange } = require("./samsStatus.service");

const OPTS = { abortEarly: false, convert: true };
const errs = (schema, value) => (schema.validate(value, OPTS).error?.details ?? []).map((d) => d.type);

describe("kun, dbname, rezident", () => {
  it.each([
    ["2026-9-1", "string.pattern.base"],
    ["2026-02-30", "any.invalid"],
    ["2026-13-01", "any.invalid"],
  ])("warnings day=%s → %s", (day, type) => {
    expect(errs(V.warningsQuery, { day })).toContain(type);
  });

  it("yaroqli qiymatlar; noma'lum kalit — 400", () => {
    expect(errs(V.warningsQuery, { day: "2028-02-29" })).toEqual([]);
    expect(errs(V.warningsQuery, { day: "2026-09-27", x: 1 })).toEqual(["object.unknown"]);
    expect(errs(V.overviewQuery, { from: "2026-09-01" })).toEqual(["object.unknown"]);
    expect(errs(V.clinicDayParams, { dbname: "clinic_A-1", day: "2026-09-27" })).toEqual([]);
    expect(errs(V.clinicDayParams, { dbname: "a b", day: "2026-09-27" })).toEqual(["string.pattern.base"]);
    expect(errs(V.clinicDayParams, { dbname: "x".repeat(101), day: "2026-09-27" })).toEqual(["string.pattern.base"]);
    expect(errs(V.residentParams, { resident: "507f1f77bcf86cd799439011" })).toEqual([]);
    expect(errs(V.residentParams, { resident: "507f1f77bcf86cd79943901z" })).toEqual(["string.hex"]);
    expect(errs(V.baselineQuery, { to: "2026-09-27", from: "2026-09-01" })).toEqual(["object.unknown"]);
  });
});

describe("oraliq va sahifalash", () => {
  it("from > to; 63 kun — 400; 62 kun va bittasi berilgan — Joi o'tkazadi", () => {
    expect(errs(V.daysQuery, { from: "2026-09-27", to: "2026-09-26" })).toEqual(["range.order"]);
    expect(errs(V.daysQuery, { from: "2026-07-27", to: "2026-09-27" })).toEqual(["range.span"]);
    expect(errs(V.daysQuery, { from: "2026-07-28", to: "2026-09-27" })).toEqual([]);
    expect(errs(V.daysQuery, { from: "2026-01-01" })).toEqual([]);
    expect(V.daysQuery.validate({ from: "2026-09-27", to: "2026-09-26" }).error.message).toContain("`from`");
  });

  it("page ≥ 1; 1 ≤ limit ≤ 200; standart 1/50", () => {
    expect(V.pageQuery.validate({}).value).toEqual({ page: 1, limit: 50 });
    expect(errs(V.pageQuery, { limit: 201 })).toEqual(["number.max"]);
    expect(errs(V.pageQuery, { limit: 0, page: 0 })).toEqual(["number.min", "number.min"]);
    expect(errs(V.pageQuery, { limit: 200 })).toEqual([]);
  });

  it("resolveRange: standart bugun-29..bugun; bugundan kech, >62 kun, teskari — 400 range_invalid", () => {
    expect(resolveRange({}, "2026-09-27")).toEqual({ from: "2026-08-29", to: "2026-09-27" });
    expect(resolveRange({ to: "2026-09-10" }, "2026-09-27")).toEqual({ from: "2026-08-12", to: "2026-09-10" });
    for (const q of [{ to: "2026-09-28" }, { from: "2026-07-01" }, { from: "2026-09-28" }]) {
      expect(() => resolveRange(q, "2026-09-27")).toThrow(expect.objectContaining({ statusCode: 400, meta: { reason: "range_invalid" } }));
    }
  });
});
