const {
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyPaginateSchema,
} = require("./examSpecialty.validation");

describe("examSpecialty.validation", () => {
  describe("createSpecialtySchema", () => {
    it("code majburiy", () => {
      const { error } = createSpecialtySchema.validate({ name: "Terapiya" });
      expect(error).toBeDefined();
    });

    it("to'g'ri payload o'tadi (status default optional)", () => {
      const { error, value } = createSpecialtySchema.validate({
        code: "3210100",
        name: "Terapiya",
        regStart: "2026-03-01",
        regEnd: "2026-03-31",
        status: "open",
      });
      expect(error).toBeUndefined();
      expect(value.code).toBe("3210100");
    });

    it("noto'g'ri status rad etiladi", () => {
      const { error } = createSpecialtySchema.validate({
        code: "3210100",
        status: "archived",
      });
      expect(error).toBeDefined();
    });
  });

  describe("updateSpecialtySchema", () => {
    it("bo'sh obyekt rad etiladi (min 1)", () => {
      const { error } = updateSpecialtySchema.validate({});
      expect(error).toBeDefined();
    });

    it("faqat status yangilash mumkin (Switch toggle)", () => {
      const { error } = updateSpecialtySchema.validate({ status: "closed" });
      expect(error).toBeUndefined();
    });
  });

  describe("specialtyPaginateSchema", () => {
    it("page/limit majburiy", () => {
      const { error } = specialtyPaginateSchema.validate({ status: "open" });
      expect(error).toBeDefined();
    });
  });
});
