const User = require("./user.model");
const { createSchema, updateSchema } = require("./user.validation");

const MODEL_ENUM = User.schema.path("employmentType").enumValues;

const okCreate = (value) =>
  createSchema.validate({ firstName: "A", lastName: "B", ...value }).error === undefined;
const okUpdate = (value) => updateSchema.validate(value).error === undefined;

describe("user.employmentType — model ↔ Joi pariteti", () => {
  test("model enumi: ikki qiymat + `null` (belgilanmagan holat)", () => {
    expect(MODEL_ENUM).toEqual(["asosiy", "orindosh", null]);
  });

  test('"asosiy" 4.03 dagi enum bilan BIR XIL yozilgan (kelajakda birlashtirish uchun)', () => {
    expect(MODEL_ENUM).toContain("asosiy");
  });

  test("model enumidagi HAR qiymatni Joi ham qabul qiladi", () => {
    for (const value of MODEL_ENUM.filter(Boolean)) {
      expect(okCreate({ employmentType: value })).toBe(true);
      expect(okUpdate({ employmentType: value })).toBe(true);
    }
  });

  test("enumda YO'Q qiymat ikkala sxemada ham RAD etiladi", () => {
    expect(okCreate({ employmentType: "ichki_sovmestitel" })).toBe(false);
    expect(okUpdate({ employmentType: "notogri" })).toBe(false);
  });

  test("`null` va bo'sh satr QABUL qilinadi — tanlovni bekor qilish uchun", () => {
    expect(okUpdate({ employmentType: null })).toBe(true);
    expect(okUpdate({ employmentType: "" })).toBe(true);
  });

  test("maydon IXTIYORIY — eski so'rovlar buzilmaydi", () => {
    expect(okCreate({})).toBe(true);
    expect(okUpdate({ firstName: "A" })).toBe(true);
  });

  test("default — `null` (belgilanmagan), `asosiy` EMAS", () => {
    expect(User.schema.path("employmentType").defaultValue).toBeNull();
  });
});
