"use strict";

const {
  createResidentSchema,
  updateResidentSchema,
} = require("./resident.validation");

const base = { program: "ordinatura", fullName: "Test Talaba" };
const errOf = (schema, obj) => schema.validate(obj).error;

describe("resident.validation — JSHSHIR naqshi (MD-20)", () => {
  test("aniq 14 raqam QABUL qilinadi", () => {
    expect(errOf(createResidentSchema, { ...base, jshshir: "12345678901234" })).toBeUndefined();
  });

  test.each([
    ["1234567890123", "13 raqam"],
    ["123456789012", "12 raqam — jonli bazada AYNAN shunday 2 ta yozuv bor"],
    ["123456789012345", "15 raqam"],
    ["123", "juda qisqa"],
    ["1234567890123a", "harf aralashgan"],
    ["3357 2533 0000", "bo'shliq bilan"],
    ["1234-5678-9012", "tire bilan"],
  ])("%s RAD etiladi (%s)", (bad) => {
    expect(errOf(createResidentSchema, { ...base, jshshir: bad })).toBeDefined();
  });

  test("xato xabari tushunarli", () => {
    const e = errOf(createResidentSchema, { ...base, jshshir: "123" });
    expect(e.message).toContain("14 raqam");
  });
});

describe("resident.validation — JSHSHIR ixtiyoriyligi SAQLANADI", () => {
  test("umuman yuborilmasa — QABUL", () => {
    expect(errOf(createResidentSchema, base)).toBeUndefined();
  });

  test("null — QABUL", () => {
    expect(errOf(createResidentSchema, { ...base, jshshir: null })).toBeUndefined();
  });

  test("bo'sh satr — QABUL (controller `clean()` uni null qiladi)", () => {
    expect(errOf(createResidentSchema, { ...base, jshshir: "" })).toBeUndefined();
  });
});

describe("resident.validation — TAHRIRLASHDA ham majburlanadi", () => {
  test("update: 12 raqam RAD etiladi", () => {
    expect(errOf(updateResidentSchema, { jshshir: "335725330000" })).toBeDefined();
  });

  test("update: 14 raqam QABUL", () => {
    expect(errOf(updateResidentSchema, { jshshir: "12345678901234" })).toBeUndefined();
  });

  test("update: null bilan tozalash mumkin", () => {
    expect(errOf(updateResidentSchema, { jshshir: null })).toBeUndefined();
  });
});
