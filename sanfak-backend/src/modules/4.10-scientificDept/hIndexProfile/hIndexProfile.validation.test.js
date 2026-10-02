const { upsertHIndexSchema } = require("./hIndexProfile.validation");

describe("hIndexProfile.validation", () => {
  it("Scopus URL + Scholar ko'rsatkichlari o'tadi", () => {
    const { error } = upsertHIndexSchema.validate({
      scopusUrl: "https://www.scopus.com/authid/detail.uri?authorId=123",
      scholarHIndex: 7,
      scholarCitations: 210,
    });
    expect(error).toBeUndefined();
  });

  it("Scopus ko'rsatkichlari yuborilsa o'tmaydi", () => {
    const { error } = upsertHIndexSchema.validate({
      scopusUrl: "https://www.scopus.com/pages/authors/58675540200",
      scopusHIndex: 7,
    });
    expect(error).toBeDefined();
  });

  it("faqat scholar URL o'tadi", () => {
    const { error } = upsertHIndexSchema.validate({
      scholarUrl: "https://scholar.google.com/citations?user=abc",
    });
    expect(error).toBeUndefined();
  });

  it("noto'g'ri URL o'tmaydi", () => {
    const { error } = upsertHIndexSchema.validate({ scopusUrl: "not-a-url" });
    expect(error).toBeDefined();
  });

  it("manfiy h-index o'tmaydi", () => {
    const { error } = upsertHIndexSchema.validate({ scholarHIndex: -1 });
    expect(error).toBeDefined();
  });

  it("bo'sh obyekt o'tmaydi (kamida bitta maydon)", () => {
    const { error } = upsertHIndexSchema.validate({});
    expect(error).toBeDefined();
  });
});
