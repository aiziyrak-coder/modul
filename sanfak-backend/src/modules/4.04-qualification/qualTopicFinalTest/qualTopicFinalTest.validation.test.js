const {
  findSchema,
  paginateSchema,
  updateSchema,
} = require("./qualTopicFinalTest.validation");

describe("qualTopicFinalTest.validation — language filtri (D-014)", () => {
  test("findSchema: language='' qabul qilinadi (GET filtri)", () => {
    const { error } = findSchema.validate({ language: "" });
    expect(error).toBeUndefined();
  });

  test("paginateSchema: language='' qabul qilinadi", () => {
    const { error } = paginateSchema.validate({ language: "" });
    expect(error).toBeUndefined();
  });

  test("updateSchema: question='' HALI HAM rad etiladi (model required:true — D-014 qamrovida EMAS)", () => {
    const { error } = updateSchema.validate({ question: "" });
    expect(error).toBeDefined();
  });
});
