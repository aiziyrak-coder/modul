"use strict";

const {
  studentSchema,
  updateSchema,
} = require("./giftedStudent.validation");

const base = (over = {}) => ({ fullName: "TEST Aliyev Sardor", ...over });

const check = (schema, body) => schema.validate(body, { abortEarly: false });
const ok = (schema, body) => !check(schema, body).error;
const msg = (schema, body) => check(schema, body).error?.message ?? "";

describe("D-53 — F.I.Sh uzunligi", () => {
  it("300 belgi qabul qilinadi", () => {
    expect(ok(studentSchema, base({ fullName: "A".repeat(300) }))).toBe(true);
  });

  it("301 belgi RAD etiladi (jonli o'lchovda 213 belgi saqlangan edi)", () => {
    expect(ok(studentSchema, base({ fullName: "A".repeat(301) }))).toBe(false);
  });
});

describe("D-51 — pasport formati", () => {
  it("to'g'ri juftlik o'tadi", () => {
    expect(
      ok(studentSchema, base({ passportSeria: "AB", passportNumber: "1234567" })),
    ).toBe(true);
  });

  it("🔴 jonli o'lchangan holat — `A` + `123` RAD etiladi", () => {
    expect(
      ok(studentSchema, base({ passportSeria: "A", passportNumber: "123" })),
    ).toBe(false);
  });

  it("kichik harf rad etiladi va xabar o'zbekcha", () => {
    const m = msg(studentSchema, base({ passportSeria: "ab", passportNumber: "1234567" }));
    expect(m).toMatch(/2 ta katta lotin harfi/);
  });

  it("raqamli seriya rad etiladi", () => {
    expect(
      ok(studentSchema, base({ passportSeria: "A1", passportNumber: "1234567" })),
    ).toBe(false);
  });

  it("8 raqamli raqam rad etiladi", () => {
    expect(
      ok(studentSchema, base({ passportSeria: "AB", passportNumber: "12345678" })),
    ).toBe(false);
  });
});

describe("D-51 — pasport JUFTLIGI", () => {
  it("ikkalasi ham berilmasa o'tadi", () => {
    expect(ok(studentSchema, base())).toBe(true);
  });

  it("ikkalasi ham bo'sh satr bo'lsa o'tadi (tozalash yo'li)", () => {
    expect(ok(studentSchema, base({ passportSeria: "", passportNumber: "" }))).toBe(true);
  });

  it("faqat seriya — RAD etiladi", () => {
    const m = msg(studentSchema, base({ passportSeria: "AB" }));
    expect(m).toMatch(/birga to'ldirilishi kerak/);
  });

  it("🔴 seriya bor, raqam `null` — RAD etiladi (`.and()` buni O'TKAZARDI)", () => {
    expect(
      ok(studentSchema, base({ passportSeria: "AB", passportNumber: null })),
    ).toBe(false);
  });

  it("faqat raqam — RAD etiladi", () => {
    expect(ok(studentSchema, base({ passportNumber: "1234567" }))).toBe(false);
  });

  it("tahrirlash sxemasida ham ayni qoida", () => {
    expect(ok(updateSchema, { passportSeria: "AB" })).toBe(false);
    expect(ok(updateSchema, { passportSeria: "AB", passportNumber: "1234567" })).toBe(true);
  });
});
