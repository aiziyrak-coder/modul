const { createSchema } = require("./orgType.validation");

describe("orgType.validation — createSchema", () => {
  it("to'g'ri obyekt qabul qilinadi", () => {
    const { error } = createSchema.validate({ title: "Tibbiyot muassasasi" });
    expect(error).toBeUndefined();
  });

  it("active ixtiyoriy — bo'lsa ham qabul qilinadi", () => {
    const { error } = createSchema.validate({ title: "Tibbiyot muassasasi", active: true });
    expect(error).toBeUndefined();
  });

  it("title majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createSchema.validate({ active: true });
    expect(error).toBeDefined();
  });

  it("bo'sh string title RAD etiladi (min 1)", () => {
    const { error } = createSchema.validate({ title: "" });
    expect(error).toBeDefined();
  });
});
