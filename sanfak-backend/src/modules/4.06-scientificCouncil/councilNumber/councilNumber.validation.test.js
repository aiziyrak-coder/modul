const {
  createNumberSchema,
  updateNumberSchema,
} = require("./councilNumber.validation");
const service = require("./councilNumber.service");

const OID = "507f1f77bcf86cd799439011";

describe("councilNumber.validation", () => {
  test("raqam + biriktirilgan ixtisosliklar qabul qilinadi", () => {
    const { error } = createNumberSchema.validate({
      number: "DSc.03/30.12.2019.Tib.50.01",
      specialties: [OID, "507f1f77bcf86cd799439012"],
    });
    expect(error).toBeUndefined();
  });

  test("ixtisosliksiz ham yaratish mumkin (keyin biriktiriladi)", () => {
    const { error } = createNumberSchema.validate({ number: "DSc.03" });
    expect(error).toBeUndefined();
  });

  test("raqamsiz rad etiladi", () => {
    const { error } = createNumberSchema.validate({ specialties: [OID] });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/number/);
  });

  test("ixtisoslik id ObjectId bo'lmasa rad etiladi", () => {
    const { error } = createNumberSchema.validate({
      number: "DSc.03",
      specialties: ["salom"],
    });
    expect(error).toBeDefined();
  });

  test("bo'sh update payload rad etiladi", () => {
    expect(updateNumberSchema.validate({}).error).toBeDefined();
  });

  test("biriktirishni butunlay bo'shatish mumkin ([] — hammasini uzish)", () => {
    const { error } = updateNumberSchema.validate({ specialties: [] });
    expect(error).toBeUndefined();
  });
});

describe("councilNumber.service.buildFilter", () => {
  test("default — faqat FAOLlar", () => {
    expect(service.buildFilter({})).toEqual({ active: true });
  });

  test("`all` — barchasi", () => {
    expect(service.buildFilter({ all: true })).toEqual({});
  });

  test("qidiruv kengash RAQAMI bo'yicha", () => {
    const f = service.buildFilter({ search: "DSc", all: true });
    expect(f.number).toBeInstanceOf(RegExp);
  });
});
