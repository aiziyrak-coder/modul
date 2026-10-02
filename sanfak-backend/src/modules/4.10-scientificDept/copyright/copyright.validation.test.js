const { createCopyrightSchema } = require("./copyright.validation");

describe("copyright.validation", () => {
  const valid = {
    title: "Talabalar reytingi axborot tizimi",
    authors: "Karimov A.B., Toshmatov B.K.",
    institutionName: "FJSTI",
    registrationNumber: "DGU 08444",
    academicYear: "2025/2026",
  };

  it("to'liq payload o'tadi", () => {
    const { error } = createCopyrightSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it("material nomisiz o'tmaydi", () => {
    const { error } = createCopyrightSchema.validate({ ...valid, title: undefined });
    expect(error).toBeDefined();
  });

  it("mualliflarsiz ham o'tadi (ixtiyoriy)", () => {
    const { error } = createCopyrightSchema.validate({
      title: "Dastur",
      registrationNumber: "DGU 001",
    });
    expect(error).toBeUndefined();
  });
});
