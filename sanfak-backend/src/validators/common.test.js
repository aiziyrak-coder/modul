const Joi = require("joi");
const {
  optionalString,
  optionalObjectId,
  optionalEnum,
  optionalNumber,
  optionalBoolean,
  optionalDate,
  academicYearInput,
} = require("./common");

describe("common.js — optionalString", () => {
  const schema = Joi.object({ field: optionalString() });

  test("bo'sh satr qabul qilinadi", () => {
    expect(schema.validate({ field: "" }).error).toBeUndefined();
  });

  test("null qabul qilinadi", () => {
    expect(schema.validate({ field: null }).error).toBeUndefined();
  });

  test("maydon umuman yuborilmasa ham xato yo'q", () => {
    expect(schema.validate({}).error).toBeUndefined();
  });

  test("haqiqiy qiymat saqlanadi", () => {
    const { error, value } = schema.validate({ field: "Aziz" });
    expect(error).toBeUndefined();
    expect(value.field).toBe("Aziz");
  });

  test("qo'shimcha cheklov (.email()) haqiqiy qiymat uchun saqlanadi", () => {
    const emailSchema = Joi.object({ field: optionalString(Joi.string().email()) });
    expect(emailSchema.validate({ field: "not-an-email" }).error).toBeDefined();
    expect(emailSchema.validate({ field: "" }).error).toBeUndefined();
    expect(emailSchema.validate({ field: "a@b.com" }).error).toBeUndefined();
  });

  test("qo'shimcha cheklov (.valid()) ro'yxatdan tashqari qiymatni hali ham rad etadi", () => {
    const enumSchema = Joi.object({ field: optionalString(Joi.string().valid("a", "b")) });
    expect(enumSchema.validate({ field: "zzz" }).error).toBeDefined();
    expect(enumSchema.validate({ field: "" }).error).toBeUndefined();
    expect(enumSchema.validate({ field: "a" }).error).toBeUndefined();
  });
});

describe("common.js — optionalObjectId", () => {
  const schema = Joi.object({ ref: optionalObjectId() });

  test("bo'sh satr qabul qilinadi VA qiymat null'ga aylanadi (Mongoose CastError oldini olish)", () => {
    const { error, value } = schema.validate({ ref: "" });
    expect(error).toBeUndefined();
    expect(value.ref).toBeNull();
  });

  test("null to'g'ridan-to'g'ri qabul qilinadi", () => {
    const { error, value } = schema.validate({ ref: null });
    expect(error).toBeUndefined();
    expect(value.ref).toBeNull();
  });

  test("haqiqiy ObjectId satri o'zgarmasdan saqlanadi", () => {
    const id = "64f1c2b8e1b1c8a1d4e5f6a7";
    const { error, value } = schema.validate({ ref: id });
    expect(error).toBeUndefined();
    expect(value.ref).toBe(id);
  });

  test("maydon umuman yuborilmasa natijada kalit qo'shilmaydi (update'da eski qiymat buzilmasin)", () => {
    const { error, value } = schema.validate({});
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "ref")).toBe(false);
  });

  test("ObjectId pattern bilan birga ishlatilganda ham \"\" null'ga aylanadi", () => {
    const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message("ObjectId bo'lishi kerak");
    const refSchema = Joi.object({ ref: optionalObjectId(objectId) });

    const empty = refSchema.validate({ ref: "" });
    expect(empty.error).toBeUndefined();
    expect(empty.value.ref).toBeNull();

    const bad = refSchema.validate({ ref: "not-hex" });
    expect(bad.error).toBeDefined();
  });
});

describe("common.js — optionalEnum", () => {
  const schema = Joi.object({ kind: optionalEnum(Joi.string().valid("a", "b")) });

  test("bo'sh satr qabul qilinadi VA natijada kalit umuman qo'shilmaydi", () => {
    const { error, value } = schema.validate({ kind: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "kind")).toBe(false);
  });

  test("null ham xuddi shunday — kalit olib tashlanadi", () => {
    const { error, value } = schema.validate({ kind: null });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "kind")).toBe(false);
  });

  test("maydon umuman yuborilmasa ham xato yo'q", () => {
    expect(schema.validate({}).error).toBeUndefined();
  });

  test("ro'yxatdagi haqiqiy qiymat saqlanadi", () => {
    const { error, value } = schema.validate({ kind: "a" });
    expect(error).toBeUndefined();
    expect(value.kind).toBe("a");
  });

  test("ro'yxatdan tashqari qiymat hali ham RAD ETILADI (400)", () => {
    const { error } = schema.validate({ kind: "zzz" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/must be one of/);
  });
});

describe("common.js — optionalNumber", () => {
  const schema = Joi.object({ n: optionalNumber() });

  test("bo'sh satr qabul qilinadi VA natijada kalit umuman qo'shilmaydi", () => {
    const { error, value } = schema.validate({ n: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "n")).toBe(false);
  });

  test("null ham xuddi shunday — kalit olib tashlanadi", () => {
    const { error, value } = schema.validate({ n: null });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "n")).toBe(false);
  });

  test("maydon umuman yuborilmasa ham xato yo'q", () => {
    expect(schema.validate({}).error).toBeUndefined();
  });

  test("haqiqiy son (shu jumladan 0) saqlanadi", () => {
    expect(schema.validate({ n: 5 }).value.n).toBe(5);
    expect(schema.validate({ n: 0 }).value.n).toBe(0);
  });

  test("noto'g'ri qiymat (raqam emas) hali ham RAD ETILADI", () => {
    const { error } = schema.validate({ n: "abc" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/must be a number/);
  });
});

describe("common.js — optionalBoolean", () => {
  const schema = Joi.object({ b: optionalBoolean() });

  test("bo'sh satr qabul qilinadi VA kalit olib tashlanadi", () => {
    const { error, value } = schema.validate({ b: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "b")).toBe(false);
  });

  test("false qiymat saqlanadi (\"bo'sh\" bilan aralashtirilmaydi)", () => {
    const { error, value } = schema.validate({ b: false });
    expect(error).toBeUndefined();
    expect(value.b).toBe(false);
  });

  test("true qiymat saqlanadi", () => {
    expect(schema.validate({ b: true }).value.b).toBe(true);
  });

  test("noto'g'ri qiymat hali ham RAD ETILADI", () => {
    const { error } = schema.validate({ b: "zzz" });
    expect(error).toBeDefined();
  });
});

describe("common.js — optionalDate", () => {
  const schema = Joi.object({ d: optionalDate() });

  test("bo'sh satr qabul qilinadi VA kalit olib tashlanadi", () => {
    const { error, value } = schema.validate({ d: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "d")).toBe(false);
  });

  test("haqiqiy sana saqlanadi", () => {
    const { error, value } = schema.validate({ d: "2024-01-01" });
    expect(error).toBeUndefined();
    expect(value.d).toBeInstanceOf(Date);
  });

  test("noto'g'ri sana hali ham RAD ETILADI", () => {
    const { error } = schema.validate({ d: "not-a-date" });
    expect(error).toBeDefined();
  });
});

describe("D-074 anti-degenerat — required maydon hamon RAD ETADI", () => {
  test("Joi.number().required() — \"\" RAD ETILADI", () => {
    const { error } = Joi.object({ n: Joi.number().required() }).validate({ n: "" });
    expect(error).toBeDefined();
  });

  test("Joi.boolean().required() — \"\" RAD ETILADI", () => {
    const { error } = Joi.object({ b: Joi.boolean().required() }).validate({ b: "" });
    expect(error).toBeDefined();
  });

  test("Joi.date().required() — \"\" RAD ETILADI", () => {
    const { error } = Joi.object({ d: Joi.date().required() }).validate({ d: "" });
    expect(error).toBeDefined();
  });
});

describe("common.js — academicYearInput", () => {
  const schema = Joi.object({ academicYear: academicYearInput.required() });

  test("24 xonali hex ObjectId qabul qilinadi", () => {
    const { error } = schema.validate({
      academicYear: "64f1c2b8e1b1c8a1d4e5f6a7",
    });
    expect(error).toBeUndefined();
  });

  test("legacy \"YYYY-YYYY\" format qabul qilinadi (Joi darajasida)", () => {
    const { error } = schema.validate({ academicYear: "2024-2025" });
    expect(error).toBeUndefined();
  });

  test("legacy \"YYYY/YYYY\" format qabul qilinadi", () => {
    const { error } = schema.validate({ academicYear: "2024/2025" });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri format (na ObjectId, na yil) RAD ETILADI", () => {
    const { error } = schema.validate({ academicYear: "zzz" });
    expect(error).toBeDefined();
  });

  test("required — kalit yo'q bo'lsa RAD ETILADI", () => {
    const { error } = schema.validate({});
    expect(error).toBeDefined();
  });
});
