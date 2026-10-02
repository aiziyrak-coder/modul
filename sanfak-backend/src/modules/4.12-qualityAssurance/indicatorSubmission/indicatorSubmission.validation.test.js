const {
  submissionSchema,
  updateSchema,
  reviewSchema,
} = require("./indicatorSubmission.validation");

const INDICATOR = "64b2f0c2a1b2c3d4e5f60718";
const ACADEMIC_YEAR = "64b2f0c2a1b2c3d4e5f60719";

describe("indicatorSubmission.validation — academicYear (D-014, ObjectId ref)", () => {
  test("submissionSchema: academicYear='' -> null (model default: null — haqiqatan nullable)", () => {
    const { error, value } = submissionSchema.validate({
      indicator: INDICATOR,
      academicYear: "",
    });
    expect(error).toBeUndefined();
    expect(value.academicYear).toBeNull();
  });

  test("submissionSchema: academicYear berilmasa ham xato yo'q", () => {
    const { error } = submissionSchema.validate({ indicator: INDICATOR });
    expect(error).toBeUndefined();
  });

  test("submissionSchema: to'g'ri ObjectId qabul qilinadi", () => {
    const { error, value } = submissionSchema.validate({
      indicator: INDICATOR,
      academicYear: ACADEMIC_YEAR,
    });
    expect(error).toBeUndefined();
    expect(value.academicYear).toBe(ACADEMIC_YEAR);
  });

  test("updateSchema: academicYear='' -> null", () => {
    const { error, value } = updateSchema.validate({ academicYear: "" });
    expect(error).toBeUndefined();
    expect(value.academicYear).toBeNull();
  });

  test("submissionSchema: indicator majburiy — yo'q bo'lsa xato (o'zgartirilmagan)", () => {
    const { error } = submissionSchema.validate({});
    expect(error).toBeDefined();
  });
});

describe("indicatorSubmission.validation — reviewSchema.comment (D-014)", () => {
  test("comment='' qabul qilinadi (model'da required yo'q)", () => {
    const { error } = reviewSchema.validate({
      status: "approved",
      comment: "",
    });
    expect(error).toBeUndefined();
  });

  test("status cheklovi saqlangan — ruxsat etilmagan qiymat rad etiladi", () => {
    const { error } = reviewSchema.validate({ status: "noto'g'ri" });
    expect(error).toBeDefined();
  });
});
