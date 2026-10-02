"use strict";

const { predictDraft } = require("./recount-45-unexcused-hours");

const inStudy = (extra = {}) => ({ active: true, status: "oquvda", ...extra });
const flagged = (extra = {}) => inStudy({ expulsionOrderCreated: true, ...extra });

describe("P6a — o'zgarmagan qoidalar", () => {
  test.each([
    ["72+, hujjatsiz", inStudy(), 72, null, "open"],
    ["72+, ochiq hujjat bor", inStudy(), 80, { origin: "tizim" }, null],
    ["72-, ochiq `tizim`", inStudy(), 10, { origin: "tizim" }, "cancel"],
    ["72-, `meros`", flagged(), 10, { origin: "meros" }, null],
    ["72-, hujjatsiz eski bayroq", flagged(), 10, null, "cancel"],
    ["nofaol", { active: false, status: "oquvda" }, 90, null, null],
  ])("%s", (_label, r, hours, open, expected) => {
    expect(predictDraft(r, hours, open)).toBe(expected);
  });
});

describe("P6a-2 — imzolangan buyruq", () => {
  test.each([
    ["72+", flagged(), 90, null],
    ["72-", flagged(), 10, null],
    ["72-, adashgan ochiq loyiha bilan", flagged(), 10, { origin: "tizim" }],
  ])("%s — hech narsa", (_label, r, hours, open) => {
    expect(predictDraft(r, hours, open, { signed: true })).toBeNull();
  });
});

describe("P6a-2 — rad etish belgi chizig'i", () => {
  test("to'sadi, bayroq yo'q — hech narsa", () => {
    expect(predictDraft(inStudy(), 72, null, { watermark: true })).toBeNull();
  });

  test("to'sadi, eskirgan bayroq — bayroq tozalanadi (`cancel`)", () => {
    expect(predictDraft(flagged(), 72, null, { watermark: true })).toBe("cancel");
  });

  test("72 dan past — belgi chizig'i ahamiyatsiz (odatiy bekor qilish)", () => {
    expect(predictDraft(flagged(), 10, null, { watermark: true })).toBe("cancel");
  });
});
