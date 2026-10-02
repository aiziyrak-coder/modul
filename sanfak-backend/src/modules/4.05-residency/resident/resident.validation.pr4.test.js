"use strict";

const {
  createResidentSchema,
  updateResidentSchema,
} = require("./resident.validation");

const base = (over = {}) => ({
  program: "ordinatura",
  fullName: "TEST Aliyev Alisher",
  ...over,
});

const check = (schema, body) => schema.validate(body, { abortEarly: false });
const ok = (schema, body) => !check(schema, body).error;
const msg = (schema, body) => check(schema, body).error?.message ?? "";

describe("D-10 — F.I.Sh uzunligi", () => {
  it("300 belgi qabul qilinadi", () => {
    expect(ok(createResidentSchema, base({ fullName: "A".repeat(300) }))).toBe(true);
  });

  it("301 belgi RAD etiladi (jonli o'lchovda aynan shuncha saqlangan edi)", () => {
    expect(ok(createResidentSchema, base({ fullName: "A".repeat(301) }))).toBe(false);
  });
});

describe("D-10 — e-pochta formati", () => {
  it("to'g'ri manzil o'tadi", () => {
    expect(ok(createResidentSchema, base({ email: "ism@fjsti.uz" }))).toBe(true);
  });

  it("`abc` RAD etiladi va xabar o'zbekcha", () => {
    const m = msg(createResidentSchema, base({ email: "abc" }));
    expect(m).toMatch(/E-pochta manzili noto'g'ri/);
  });

  it("bo'sh satr va null «tozalash» sifatida o'tadi", () => {
    expect(ok(createResidentSchema, base({ email: "" }))).toBe(true);
    expect(ok(createResidentSchema, base({ email: null }))).toBe(true);
  });

  it("institut ichki domeni TLD lug'ati sababli rad etilmaydi", () => {
    expect(ok(createResidentSchema, base({ email: "xodim@fjsti.local" }))).toBe(true);
  });
});

describe("D-10 — pasport JUFTLIGI", () => {
  it("to'liq juftlik o'tadi", () => {
    expect(
      ok(createResidentSchema, base({ passportSeria: "AB", passportNumber: "1234567" })),
    ).toBe(true);
  });

  it("ikkalasi ham berilmasa o'tadi", () => {
    expect(ok(createResidentSchema, base())).toBe(true);
  });

  it("ikkalasi ham bo'sh satr bo'lsa o'tadi (tozalash yo'li)", () => {
    expect(
      ok(createResidentSchema, base({ passportSeria: "", passportNumber: "" })),
    ).toBe(true);
  });

  it("faqat seriya — RAD etiladi (jonli o'lchangan holat)", () => {
    const m = msg(createResidentSchema, base({ passportSeria: "AB" }));
    expect(m).toMatch(/birga to'ldirilishi kerak/);
  });

  it("🔴 seriya bor, raqam `null` — RAD etiladi (`.and()` buni O'TKAZARDI)", () => {
    const m = msg(
      createResidentSchema,
      base({ passportSeria: "AB", passportNumber: null }),
    );
    expect(m).toMatch(/birga to'ldirilishi kerak/);
  });

  it("🔴 seriya bor, raqam bo'sh satr — RAD etiladi", () => {
    expect(
      ok(createResidentSchema, base({ passportSeria: "AB", passportNumber: "" })),
    ).toBe(false);
  });

  it("faqat raqam — RAD etiladi (teskari yo'nalish ham)", () => {
    expect(
      ok(createResidentSchema, base({ passportNumber: "1234567" })),
    ).toBe(false);
  });

  it("tahrirlash sxemasida ham ayni qoida", () => {
    expect(ok(updateResidentSchema, { passportSeria: "AB" })).toBe(false);
    expect(ok(updateResidentSchema, { passportSeria: "AB", passportNumber: "1234567" })).toBe(true);
  });
});

describe("D-10 — pasport FORMATI", () => {
  it("kichik harfli seriya rad etiladi", () => {
    expect(
      ok(createResidentSchema, base({ passportSeria: "ab", passportNumber: "1234567" })),
    ).toBe(false);
  });

  it("6 raqamli raqam rad etiladi", () => {
    expect(
      ok(createResidentSchema, base({ passportSeria: "AB", passportNumber: "123456" })),
    ).toBe(false);
  });

  it("xabar o'zbekcha va namuna ko'rsatadi", () => {
    const m = msg(createResidentSchema, base({ passportSeria: "A1", passportNumber: "1234567" }));
    expect(m).toMatch(/2 ta katta lotin harfi/);
  });
});
