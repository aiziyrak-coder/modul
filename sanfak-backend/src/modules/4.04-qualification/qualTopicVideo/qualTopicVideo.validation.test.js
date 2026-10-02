const { findSchema, updateSchema } = require("./qualTopicVideo.validation");

describe("qualTopicVideo.validation — language filtri (D-014)", () => {
  test("findSchema: language='' qabul qilinadi (GET filtri)", () => {
    const { error } = findSchema.validate({ language: "" });
    expect(error).toBeUndefined();
  });

  test("updateSchema: title='' HALI HAM rad etiladi (model required:true — D-014 qamrovida EMAS)", () => {
    const { error } = updateSchema.validate({ title: "" });
    expect(error).toBeDefined();
  });

  test("updateSchema: videoRaw='' HALI HAM rad etiladi (model required:true)", () => {
    const { error } = updateSchema.validate({ videoRaw: "" });
    expect(error).toBeDefined();
  });
});
