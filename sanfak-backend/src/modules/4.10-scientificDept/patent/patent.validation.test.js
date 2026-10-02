const { createPatentSchema } = require("./patent.validation");

describe("patent.validation", () => {
  const valid = {
    title: "Yangi diagnostika qurilmasi",
    patentType: "invention",
    registrationNumber: "FAP 01829",
    academicYear: "2025/2026",
  };

  it("to'liq payload o'tadi", () => {
    const { error } = createPatentSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it("noto'g'ri patent turi o'tmaydi", () => {
    const { error } = createPatentSchema.validate({ ...valid, patentType: "trademark" });
    expect(error).toBeDefined();
  });

  it("patent turisiz o'tadi (Turi formadan olib tashlangan)", () => {
    const { error } = createPatentSchema.validate({ ...valid, patentType: undefined });
    expect(error).toBeUndefined();
  });

  it("bo'sh patent turi o'tmaydi (enum'ga yetib bormasin)", () => {
    const { error } = createPatentSchema.validate({ ...valid, patentType: "" });
    expect(error).toBeDefined();
  });

  it("ishlanma nomisiz o'tmaydi", () => {
    const { error } = createPatentSchema.validate({ ...valid, title: undefined });
    expect(error).toBeDefined();
  });
});
