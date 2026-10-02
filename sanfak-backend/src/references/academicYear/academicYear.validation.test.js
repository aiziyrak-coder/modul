const {
  createAcademicYearSchema,
  updateAcademicYearSchema,
} = require("./academicYear.validation");

describe("academicYear.validation — createAcademicYearSchema", () => {
  test("to'g'ri format (YYYY/YYYY) qabul qilinadi", () => {
    const { error } = createAcademicYearSchema.validate({ title: "2024/2025" });
    expect(error).toBeUndefined();
  });

  test("title majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createAcademicYearSchema.validate({});
    expect(error).toBeDefined();
  });

  test("chiziqcha bilan (YYYY-YYYY) RAD etiladi", () => {
    const { error } = createAcademicYearSchema.validate({ title: "2024-2025" });
    expect(error).toBeDefined();
  });

  test("9 belgili, lekin formatga mos kelmaydigan string RAD etiladi (\"2024-2025\" bilan bir xil uzunlik)", () => {
    const { error } = createAcademicYearSchema.validate({ title: "asdf-jklm" });
    expect(error).toBeDefined();
  });

  test("qisqa yil (YY/YY) RAD etiladi", () => {
    const { error } = createAcademicYearSchema.validate({ title: "24/2025" });
    expect(error).toBeDefined();
  });
});

describe("academicYear.validation — updateAcademicYearSchema", () => {
  test("title berilmasa ham o'tadi (optional)", () => {
    const { error } = updateAcademicYearSchema.validate({ active: false });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri formatdagi title RAD etiladi", () => {
    const { error } = updateAcademicYearSchema.validate({ title: "2024-2025" });
    expect(error).toBeDefined();
  });

  test("to'g'ri formatdagi title qabul qilinadi", () => {
    const { error } = updateAcademicYearSchema.validate({ title: "2025/2026" });
    expect(error).toBeUndefined();
  });
});
