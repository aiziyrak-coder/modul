const { createArticleSchema, updateArticleSchema } = require("./article.validation");
const { yearFromDate } = require("./article.service");

const base = {
  type: "scopus",
  journal: "64b2f0c2a1b2c3d4e5f60718",
  title: "Tibbiyotda sun'iy intellekt",
  academicYear: "2025/2026",
  pages: "12-18",
  authorCount: 2,
  url: "https://example.com/article.pdf",
};

describe("article — nashr qilingan sanasi", () => {
  it("to'g'ri sana o'tadi", () => {
    const { error } = createArticleSchema.validate({ ...base, publishedDate: "2026-08-18" });
    expect(error).toBeUndefined();
  });

  it("sanasiz yuborilsa RAD etiladi (majburiy maydon)", () => {
    const { error } = createArticleSchema.validate(base);
    expect(error).toBeDefined();
  });

  it("faqat yil ('2026') yoki noto'g'ri format RAD etiladi", () => {
    expect(createArticleSchema.validate({ ...base, publishedDate: "2026" }).error).toBeDefined();
    expect(
      createArticleSchema.validate({ ...base, publishedDate: "18.08.2026" }).error,
    ).toBeDefined();
  });

  it("`year` endi majburiy emas — sanadan hosil bo'ladi", () => {
    const { error } = createArticleSchema.validate({ ...base, publishedDate: "2026-08-18" });
    expect(error).toBeUndefined();
  });

  it("tahrirda sana ixtiyoriy", () => {
    expect(updateArticleSchema.validate({ pages: "1-5" }).error).toBeUndefined();
    expect(updateArticleSchema.validate({ publishedDate: "2026-01-01" }).error).toBeUndefined();
    expect(updateArticleSchema.validate({ publishedDate: "2026" }).error).toBeDefined();
  });
});

describe("article — yearFromDate", () => {
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
