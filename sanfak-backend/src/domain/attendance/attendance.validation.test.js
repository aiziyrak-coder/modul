const { createAttendanceSchema } = require("./attendance.validation");

const validBase = {
  group: "64b2f0c2a1b2c3d4e5f60718",
  date: "2030-01-01",
};

describe("attendance.validation — createAttendanceSchema.academicYear (D-087)", () => {
  test("24 xonali hex ObjectId qabul qilinadi", () => {
    const { error } = createAttendanceSchema.validate({
      ...validBase,
      academicYear: "64f1c2b8e1b1c8a1d4e5f6a7",
    });
    expect(error).toBeUndefined();
  });

  test("legacy \"YYYY-YYYY\" format ham Joi darajasida qabul qilinadi", () => {
    const { error } = createAttendanceSchema.validate({
      ...validBase,
      academicYear: "2024-2025",
    });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri format RAD ETILADI", () => {
    const { error } = createAttendanceSchema.validate({
      ...validBase,
      academicYear: "zzz",
    });
    expect(error).toBeDefined();
  });

  test("ixtiyoriy — berilmasa xato yo'q", () => {
    const { error } = createAttendanceSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  test("null qabul qilinadi (model default: null)", () => {
    const { error } = createAttendanceSchema.validate({
      ...validBase,
      academicYear: null,
    });
    expect(error).toBeUndefined();
  });
});
