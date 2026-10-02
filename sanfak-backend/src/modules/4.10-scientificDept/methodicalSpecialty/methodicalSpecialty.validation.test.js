const {
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyQuerySchema,
} = require("./methodicalSpecialty.validation");

describe("Ixtisoslik lug'ati — validatsiya", () => {
  it("shifr va nom bilan o'tadi", () => {
    const { error, value } = createSpecialtySchema.validate({
      code: "14.00.02",
      name: "Terapiya",
    });
    expect(error).toBeUndefined();
    expect(value.code).toBe("14.00.02");
  });

  it.each(["code", "name"])("%s majburiy", (field) => {
    const body = { code: "14.00.02", name: "Terapiya" };
    delete body[field];
    expect(createSpecialtySchema.validate(body).error).toBeDefined();
  });

  it("shifrda MASKA yo'q — turli ko'rinish qabul qilinadi", () => {
    ["14.00.02", "3210100", "A-15", "УТ-26/1"].forEach((code) => {
      const { error } = createSpecialtySchema.validate({ code, name: "Terapiya" });
      expect(error).toBeUndefined();
    });
  });

  it("bo'sh shifr rad etiladi", () => {
    expect(createSpecialtySchema.validate({ code: "  ", name: "Terapiya" }).error).toBeDefined();
  });

  it("nom 2 belgidan qisqa bo'lmaydi", () => {
    expect(createSpecialtySchema.validate({ code: "1", name: "T" }).error).toBeDefined();
  });

  it("bo'shliqlar tozalanadi", () => {
    const { value } = createSpecialtySchema.validate({ code: " 14.00.02 ", name: " Terapiya " });
    expect(value).toEqual({ code: "14.00.02", name: "Terapiya" });
  });

  it("begona maydon rad etiladi (allowlist)", () => {
    const { error } = createSpecialtySchema.validate({
      code: "1",
      name: "Terapiya",
      createdBy: "6a59d4b607edd11d93b7becd",
    });
    expect(error).toBeDefined();
  });

  it("update: kamida bitta maydon kerak", () => {
    expect(updateSpecialtySchema.validate({}).error).toBeDefined();
    expect(updateSpecialtySchema.validate({ name: "Kardiologiya" }).error).toBeUndefined();
  });

  it("update: `active` bilan yashirish/qaytarish mumkin", () => {
    expect(updateSpecialtySchema.validate({ active: false }).error).toBeUndefined();
  });

  it("query: qidiruv va faollik filtri", () => {
    expect(specialtyQuerySchema.validate({ search: "терап", active: true }).error).toBeUndefined();
    expect(specialtyQuerySchema.validate({ page: 1 }).error).toBeDefined();
  });
});
