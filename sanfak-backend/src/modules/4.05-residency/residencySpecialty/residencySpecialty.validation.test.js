"use strict";

const { createSchema, updateSchema } = require("./residencySpecialty.validation");

const base = { title: "Kardiologiya", program: "ordinatura" };
const errOf = (schema, obj) => schema.validate(obj).error;

describe("residencySpecialty.validation — studyPeriod (MD-12)", () => {
  test.each([1, 2, 3, 10])("%s yil — QABUL", (n) => {
    expect(errOf(createSchema, { ...base, studyPeriod: n })).toBeUndefined();
  });

  test.each([
    [2.5, "kasr yil ma'nosiz"],
    [0.5, "kasr + chegaradan tashqari"],
    [1.1, "kasr"],
  ])("%s — RAD (%s)", (n) => {
    expect(errOf(createSchema, { ...base, studyPeriod: n })).toBeDefined();
  });

  test.each([0, 11, -1])("%s — RAD (1..10 chegarasi)", (n) => {
    expect(errOf(createSchema, { ...base, studyPeriod: n })).toBeDefined();
  });

  test("null — QABUL (muddat belgilanmagan)", () => {
    expect(errOf(createSchema, { ...base, studyPeriod: null })).toBeUndefined();
  });

  test("umuman yuborilmasa — QABUL", () => {
    expect(errOf(createSchema, base)).toBeUndefined();
  });

  test("tahrirlashda ham butun son majburlanadi", () => {
    expect(errOf(updateSchema, { studyPeriod: 2.5 })).toBeDefined();
    expect(errOf(updateSchema, { studyPeriod: 2 })).toBeUndefined();
  });

  test("⚠️ `5` QABUL qilinadi — server '0,5 -> 5' buzilishini USHLAY OLMAYDI", () => {
    expect(errOf(createSchema, { ...base, studyPeriod: 5 })).toBeUndefined();
  });
});
