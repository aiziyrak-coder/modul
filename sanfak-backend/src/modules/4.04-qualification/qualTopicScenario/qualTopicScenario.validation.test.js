const { findSchema, updateSchema } = require("./qualTopicScenario.validation");

describe("qualTopicScenario.validation — language filtri (D-014)", () => {
  test("findSchema: language='' qabul qilinadi (GET filtri)", () => {
    const { error } = findSchema.validate({ language: "" });
    expect(error).toBeUndefined();
  });

  test("updateSchema: title='' HALI HAM rad etiladi (model required:true — D-014 qamrovida EMAS)", () => {
    const { error } = updateSchema.validate({ title: "" });
    expect(error).toBeDefined();
  });

  test("updateSchema: text='' HALI HAM rad etiladi (model required:true)", () => {
    const { error } = updateSchema.validate({ text: "" });
    expect(error).toBeDefined();
  });
});
