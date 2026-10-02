const {
  createArticleSchema,
  updateArticleSchema,
  rejectArticleSchema,
} = require("./article.validation");

const validBase = {
  type: "scopus",
  journal: "64b2f0c2a1b2c3d4e5f60718",
  title: "Tibbiyotda sun'iy intellekt",
  academicYear: "2025/2026",
  publishedDate: "2026-08-18",
  year: 2026,
  pages: "12-18",
  authorCount: 2,
  url: "https://example.com/article.pdf",
};

describe("article.validation — createArticleSchema", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    const { error } = createArticleSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  test("title Milliy OAK (nationalOak) uchun ixtiyoriy", () => {
    const { title: _omit, ...noTitle } = validBase;
    const { error } = createArticleSchema.validate({
      ...noTitle,
      type: "nationalOak",
    });
    expect(error).toBeUndefined();
  });

  test("title boshqa turlarda majburiy", () => {
    const { title: _omit, ...noTitle } = validBase;
    const { error } = createArticleSchema.validate(noTitle);
    expect(error).toBeDefined();
  });

  test("journal (registry id) majburiy", () => {
    const { journal: _omit, ...noJournal } = validBase;
    const { error } = createArticleSchema.validate(noJournal);
    expect(error).toBeDefined();
  });

  test("academicYear formati YYYY/YYYY — dash yoki noto'g'ri format xato", () => {
    const { error } = createArticleSchema.validate({
      ...validBase,
      academicYear: "2025-2026",
    });
    expect(error).toBeDefined();
  });

  test("url URI formati tekshiriladi", () => {
    const { error } = createArticleSchema.validate({
      ...validBase,
      url: "shunchaki matn",
    });
    expect(error).toBeDefined();
  });

  test("multipart string raqamlar coerce qilinadi (year, authorCount)", () => {
    const { error } = createArticleSchema.validate({
      ...validBase,
      year: "2026",
      authorCount: "3",
    });
    expect(error).toBeUndefined();
  });
});

describe("article.validation — updateArticleSchema", () => {
  test("bo'sh update xato (kamida 1 maydon)", () => {
    const { error } = updateArticleSchema.validate({});
    expect(error).toBeDefined();
  });

  test("qisman update qabul qilinadi", () => {
    const { error } = updateArticleSchema.validate({ pages: "20-25" });
    expect(error).toBeUndefined();
  });
});

describe("article.validation — rejectArticleSchema", () => {
  test("reason majburiy", () => {
    expect(rejectArticleSchema.validate({}).error).toBeDefined();
    expect(
      rejectArticleSchema.validate({ reason: "PDF nusxasi sifatsiz" }).error,
    ).toBeUndefined();
  });

  test("juda qisqa reason xato (min 3)", () => {
    const { error } = rejectArticleSchema.validate({ reason: "ha" });
    expect(error).toBeDefined();
  });
});
