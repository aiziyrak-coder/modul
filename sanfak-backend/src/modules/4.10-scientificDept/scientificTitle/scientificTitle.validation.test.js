const { createTitleSchema } = require("./scientificTitle.validation");

describe("scientificTitle.validation", () => {
  const valid = {
    titleType: "dotsent",
    specialty: "Ichki kasalliklar",
    diplomaSeries: "DTS",
    diplomaNumber: "004521",
    academicYear: "2025/2026",
  };

  it("to'liq payload o'tadi", () => {
    const { error } = createTitleSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it("admin ma'lumotnomasidan kelgan istalgan nom o'tadi", () => {
    const { error } = createTitleSchema.validate({ ...valid, titleType: "Fan nomzodi" });
    expect(error).toBeUndefined();
  });

  it("bo'sh qiymat o'tmaydi", () => {
    expect(createTitleSchema.validate({ ...valid, titleType: "" }).error).toBeDefined();
    expect(
      createTitleSchema.validate({ ...valid, titleType: undefined }).error,
    ).toBeDefined();
  });

  it("diplom raqamisiz o'tmaydi", () => {
    const { error } = createTitleSchema.validate({ ...valid, diplomaNumber: undefined });
    expect(error).toBeDefined();
  });
});
