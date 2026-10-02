"use strict";

const {
  reviewProofSchema: activityReviewProof,
} = require("../activityPlan/activityPlan.validation");
const {
  reviewProofSchema: dissertationReviewProof,
} = require("../dissertationPlan/dissertationPlan.validation");
const { returnSchema } = require("../dailyLog/dailyLog.validation");

const errOf = (schema, obj) => schema.validate(obj).error;

describe.each([
  ["activityPlan", activityReviewProof],
  ["dissertationPlan", dissertationReviewProof],
])("%s — bajaruvni qaytarishda SABAB majburiy (MD-28)", (_name, schema) => {
  test("sababsiz rad etish — RAD (ilgari bir bosishda o'tib ketardi)", () => {
    const e = errOf(schema, { decision: "rejected" });
    expect(e).toBeDefined();
    expect(e.message).toContain("sabab");
  });

  test.each([[""], ["   "]])("bo'sh sabab %p — RAD", (comment) => {
    expect(errOf(schema, { decision: "rejected", comment })).toBeDefined();
  });

  test("sabab bilan — QABUL", () => {
    expect(
      errOf(schema, { decision: "rejected", comment: "Hujjat o'qilmadi, qayta yuklang" }),
    ).toBeUndefined();
  });

  test("TASDIQLASHDA izoh ixtiyoriy QOLADI (mavjud oqim buzilmasin)", () => {
    expect(errOf(schema, { decision: "approved" })).toBeUndefined();
    expect(errOf(schema, { decision: "approved", comment: "" })).toBeUndefined();
    expect(errOf(schema, { decision: "approved", comment: null })).toBeUndefined();
    expect(errOf(schema, { decision: "approved", comment: "Yaxshi" })).toBeUndefined();
  });

  test("juda uzun sabab — RAD (1000 belgi chegarasi)", () => {
    expect(
      errOf(schema, { decision: "rejected", comment: "x".repeat(1001) }),
    ).toBeDefined();
  });
});

describe("kundalik — sabab ALLAQACHON majburiy edi (o'zgarmagani qulflanadi)", () => {
  test("sababsiz qaytarish — RAD", () => {
    expect(errOf(returnSchema, {})).toBeDefined();
  });

  test("sabab bilan — QABUL", () => {
    expect(errOf(returnSchema, { reason: "Tavsif yetarli emas" })).toBeUndefined();
  });
});
