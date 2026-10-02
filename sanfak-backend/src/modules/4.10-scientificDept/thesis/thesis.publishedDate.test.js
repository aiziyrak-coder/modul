const { createThesisSchema, updateThesisSchema } = require("./thesis.validation");
const { yearFromDate } = require("./thesis.service");

const base = {
  type: "national",
  conferenceName: "Konferensiya",
  title: "Tezis nomi",
  academicYear: "2025/2026",
  pages: "12-18",
  authorCount: 3,
};

describe("thesis — nashr qilingan sanasi", () => {
  it("to'g'ri sana o'tadi", () => {
    const { error } = createThesisSchema.validate({ ...base, publishedDate: "2026-08-18" });
    expect(error).toBeUndefined();
  });

  it("sanasiz yuborilsa RAD etiladi (majburiy maydon)", () => {
    const { error } = createThesisSchema.validate(base);
    expect(error).toBeDefined();
  });

  it("faqat yil ('2026') yoki noto'g'ri format RAD etiladi", () => {
    expect(createThesisSchema.validate({ ...base, publishedDate: "2026" }).error).toBeDefined();
    expect(
      createThesisSchema.validate({ ...base, publishedDate: "18.08.2026" }).error,
    ).toBeDefined();
  });

  it("tahrirda sana ixtiyoriy", () => {
    expect(updateThesisSchema.validate({ pages: "1-5" }).error).toBeUndefined();
    expect(updateThesisSchema.validate({ publishedDate: "2026-01-01" }).error).toBeUndefined();
  });
});

describe("thesis — yearFromDate", () => {
  it("sanadan yilni ajratadi", () => {
    expect(yearFromDate("2026-08-18")).toBe(2026);
    expect(yearFromDate("1999-12-31")).toBe(1999);
  });

  it("sana bo'lmasa undefined — mavjud `year` o'zgarmasin", () => {
    expect(yearFromDate("")).toBeUndefined();
    expect(yearFromDate(null)).toBeUndefined();
    expect(yearFromDate(undefined)).toBeUndefined();
    expect(yearFromDate("2026")).toBeUndefined();
  });
});
