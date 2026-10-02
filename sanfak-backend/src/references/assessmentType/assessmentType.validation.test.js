const {
  createAssessmentTypeSchema,
  updateAssessmentTypeSchema,
} = require("./assessmentType.validation");

const validBase = { title: "imtihon (yozma)" };

describe("assessmentType.validation — createAssessmentTypeSchema", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    expect(
      createAssessmentTypeSchema.validate(validBase).error,
    ).toBeUndefined();
  });

  test("title majburiy (yo'q bo'lsa xato)", () => {
    expect(createAssessmentTypeSchema.validate({}).error).toBeDefined();
  });

  test("bo'sh title RAD etiladi", () => {
    expect(
      createAssessmentTypeSchema.validate({ ...validBase, title: "" }).error,
    ).toBeDefined();
  });

  test("desc va active ixtiyoriy", () => {
    expect(
      createAssessmentTypeSchema.validate({
        ...validBase,
        desc: "Yozma shaklda o'tkaziladigan yakuniy imtihon",
        active: false,
      }).error,
    ).toBeUndefined();
  });

  test("noma'lum kalit RAD etiladi (mass-assignment)", () => {
    expect(
      createAssessmentTypeSchema.validate({ ...validBase, role: "super_admin" })
        .error,
    ).toBeDefined();
  });

  test("{uz,ru,eng} obyekt title RAD etiladi", () => {
    expect(
      createAssessmentTypeSchema.validate({
        title: { uz: "sinov", ru: "зачёт", eng: "pass/fail" },
      }).error,
    ).toBeDefined();
  });
});

describe("assessmentType.validation — updateAssessmentTypeSchema", () => {
  test("title berilmasa ham o'tadi (optional)", () => {
    expect(
      updateAssessmentTypeSchema.validate({ active: false }).error,
    ).toBeUndefined();
  });

  test("title yangilanishi qabul qilinadi", () => {
    expect(
      updateAssessmentTypeSchema.validate({ title: "imtihon (og'zaki)" }).error,
    ).toBeUndefined();
  });

  test("noma'lum kalit RAD etiladi", () => {
    expect(
      updateAssessmentTypeSchema.validate({ createdAt: "2026-01-01" }).error,
    ).toBeDefined();
  });
});
