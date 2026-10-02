const { oubQuery } = require("./studyLoadStatistics.validation");

const OBJECT_ID = "6600000000000000000000a1";

describe("studyLoadStatistics.validation — oubQuery", () => {
  test("bo'sh query qabul qilinadi (ikkalasi ham ixtiyoriy)", () => {
    expect(oubQuery.validate({}).error).toBeUndefined();
  });

  test("to'g'ri academicYear + faculty (24-hex ObjectId) qabul qilinadi", () => {
    expect(
      oubQuery.validate({ academicYear: OBJECT_ID, faculty: OBJECT_ID }).error,
    ).toBeUndefined();
  });

  test("eski \"2024/2025\" formatidagi academicYear RAD ETILADI (400, CastError 500 emas)", () => {
    expect(oubQuery.validate({ academicYear: "2024/2025" }).error).toBeDefined();
  });

  test("noto'g'ri uzunlikdagi ObjectId RAD ETILADI", () => {
    expect(oubQuery.validate({ faculty: "abc123" }).error).toBeDefined();
  });

  test("noma'lum query kaliti RAD ETILADI", () => {
    expect(oubQuery.validate({ unknown: "x" }).error).toBeDefined();
  });
});
