const { createExamSchema, updateExamSchema } = require("./exam.validation");

const validBase = {
  groups: ["64b2f0c2a1b2c3d4e5f60718"],
  science: "64b2f0c2a1b2c3d4e5f60719",
  teacher: "64b2f0c2a1b2c3d4e5f6071a",
  examType: "midterm",
  date: "2030-01-01",
  semester: 1,
};

describe("exam.validation — createExamSchema.academicYear (D-086)", () => {
  test("24 xonali hex ObjectId qabul qilinadi", () => {
    const { error } = createExamSchema.validate({
      ...validBase,
      academicYear: "64f1c2b8e1b1c8a1d4e5f6a7",
    });
    expect(error).toBeUndefined();
  });

  test("legacy \"YYYY-YYYY\" format ham Joi darajasida qabul qilinadi", () => {
    const { error } = createExamSchema.validate({
      ...validBase,
      academicYear: "2024-2025",
    });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri format RAD ETILADI", () => {
    const { error } = createExamSchema.validate({
      ...validBase,
      academicYear: "zzz",
    });
    expect(error).toBeDefined();
  });

  test("academicYear majburiy — yo'q bo'lsa xato", () => {
    const { error } = createExamSchema.validate(validBase);
    expect(error).toBeDefined();
  });
});

describe("exam.validation — updateExamSchema.academicYear (D-086)", () => {
  test("ObjectId bilan qabul qilinadi", () => {
    const { error } = updateExamSchema.validate({
      academicYear: "64f1c2b8e1b1c8a1d4e5f6a7",
    });
    expect(error).toBeUndefined();
  });

  test("ixtiyoriy — berilmasa xato yo'q (boshqa maydon bo'lsa)", () => {
    const { error } = updateExamSchema.validate({ note: "izoh" });
    expect(error).toBeUndefined();
  });
});
