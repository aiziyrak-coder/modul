const { createSchema, updateSchema } = require("./qualCourseType.validation");

describe("qualCourseType.validation — file (D-014)", () => {
  test("createSchema: file='' qabul qilinadi (model'da required yo'q)", () => {
    const { error } = createSchema.validate({ title: "Kurs turi", kind: 1, file: "" });
    expect(error).toBeUndefined();
  });

  test("updateSchema: file='' qabul qilinadi", () => {
    const { error } = updateSchema.validate({ file: "" });
    expect(error).toBeUndefined();
  });

  test("createSchema: title majburiy — bo'sh bo'lsa xato (D-014 qamrovida EMAS)", () => {
    const { error } = createSchema.validate({ title: "", kind: 1 });
    expect(error).toBeDefined();
  });

  test("createSchema: kind cheklovi saqlangan — number bo'lmasa xato", () => {
    const { error } = createSchema.validate({ title: "x", kind: "abc" });
    expect(error).toBeDefined();
  });

  test("createSchema: template cheklovi saqlangan — ruxsat etilmagan qiymat rad etiladi", () => {
    const { error } = createSchema.validate({ title: "x", kind: 1, template: 9 });
    expect(error).toBeDefined();
  });
});
