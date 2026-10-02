const {
  masteryGridSchema,
  myProgressSchema,
} = require("./qualTopicCompletion.validation");

const COURSE = "64b2f0c2a1b2c3d4e5f60718";

describe("qualTopicCompletion.validation — language filtri (D-014)", () => {
  test("masteryGridSchema: language='' qabul qilinadi (GET filtri)", () => {
    const { error } = masteryGridSchema.validate({ course: COURSE, language: "" });
    expect(error).toBeUndefined();
  });

  test("masteryGridSchema: course majburiy — yo'q bo'lsa xato (o'zgartirilmagan)", () => {
    const { error } = masteryGridSchema.validate({ language: "uz" });
    expect(error).toBeDefined();
  });

  test("myProgressSchema: language='' qabul qilinadi", () => {
    const { error } = myProgressSchema.validate({ course: COURSE, language: "" });
    expect(error).toBeUndefined();
  });
});
