const {
  createCourseSchema,
  updateCourseSchema,
} = require("./course.validation");

describe("course.validation — createCourseSchema", () => {
  test("kanonik format (\"1-kurs\") qabul qilinadi", () => {
    const { error } = createCourseSchema.validate({ title: "1-kurs" });
    expect(error).toBeUndefined();
  });

  test("2 xonali kurs (\"10-kurs\") qabul qilinadi", () => {
    const { error } = createCourseSchema.validate({ title: "10-kurs" });
    expect(error).toBeUndefined();
  });

  test("title majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createCourseSchema.validate({});
    expect(error).toBeDefined();
  });

  test("bo'sh matn RAD etiladi", () => {
    const { error } = createCourseSchema.validate({ title: "asdf" });
    expect(error).toBeDefined();
  });

  test("faqat raqam (\"1\", \"-kurs\"siz) RAD etiladi", () => {
    const { error } = createCourseSchema.validate({ title: "1" });
    expect(error).toBeDefined();
  });

  test("rim raqami (\"I-kurs\") RAD etiladi (kanon faqat arab raqami)", () => {
    const { error } = createCourseSchema.validate({ title: "I-kurs" });
    expect(error).toBeDefined();
  });

  test("emoji/maxsus belgi RAD etiladi", () => {
    const { error } = createCourseSchema.validate({ title: "🙂" });
    expect(error).toBeDefined();
  });
});

describe("course.validation — updateCourseSchema", () => {
  test("title berilmasa ham o'tadi (optional)", () => {
    const { error } = updateCourseSchema.validate({ active: false });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri formatdagi title RAD etiladi", () => {
    const { error } = updateCourseSchema.validate({ title: "asdf" });
    expect(error).toBeDefined();
  });

  test("kanonik formatdagi title qabul qilinadi", () => {
    const { error } = updateCourseSchema.validate({ title: "5-kurs" });
    expect(error).toBeUndefined();
  });
});
