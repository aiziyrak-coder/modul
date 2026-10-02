const { findSchema } = require("./qualTestConfig.validation");

const COURSE = "64b2f0c2a1b2c3d4e5f60718";

describe("qualTestConfig.validation — findSchema.language (D-014)", () => {
  test("language='' qabul qilinadi (GET filtri)", () => {
    const { error } = findSchema.validate({ course: COURSE, kind: 1, language: "" });
    expect(error).toBeUndefined();
  });

  test("course majburiy — yo'q bo'lsa xato (o'zgartirilmagan)", () => {
    const { error } = findSchema.validate({ kind: 1 });
    expect(error).toBeDefined();
  });

  test("kind cheklovi saqlangan — ruxsat etilmagan qiymat rad etiladi", () => {
    const { error } = findSchema.validate({ course: COURSE, kind: 9 });
    expect(error).toBeDefined();
  });
});
