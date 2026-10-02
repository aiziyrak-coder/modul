const { createGradebookSchema } = require("./gradebook.validation");

const validBase = {
  group: "64b2f0c2a1b2c3d4e5f60718",
  science: "64b2f0c2a1b2c3d4e5f60719",
  teacher: "64b2f0c2a1b2c3d4e5f6071a",
  semester: 1,
};

describe("gradebook.validation — createGradebookSchema.academicYear (D-087)", () => {
  test("24 xonali hex ObjectId qabul qilinadi", () => {
    const { error } = createGradebookSchema.validate({
      ...validBase,
      academicYear: "64f1c2b8e1b1c8a1d4e5f6a7",
    });
    expect(error).toBeUndefined();
  });

  test("legacy \"YYYY-YYYY\" format ham Joi darajasida qabul qilinadi", () => {
    const { error } = createGradebookSchema.validate({
      ...validBase,
      academicYear: "2024-2025",
    });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri format RAD ETILADI", () => {
    const { error } = createGradebookSchema.validate({
      ...validBase,
      academicYear: "zzz",
    });
    expect(error).toBeDefined();
  });

  test("academicYear majburiy — yo'q bo'lsa xato", () => {
    const { error } = createGradebookSchema.validate(validBase);
    expect(error).toBeDefined();
  });
});
