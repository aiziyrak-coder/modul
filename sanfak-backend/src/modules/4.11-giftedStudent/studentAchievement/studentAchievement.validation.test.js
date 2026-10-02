const {
  achievementSchema,
  updateSchema,
  myUpdateSchema,
  reviewSchema,
  findAll,
} = require("./studentAchievement.validation");

const DOC_TYPE = "64b2f0c2a1b2c3d4e5f60718";

describe("studentAchievement.validation — achievementSchema (create)", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    const { error } = achievementSchema.validate({
      documentType: DOC_TYPE,
      title: "Scopus maqola",
      desc: "Q1 jurnal",
      link: "https://example.org",
    });
    expect(error).toBeUndefined();
  });

  test("documentType majburiy", () => {
    const { error } = achievementSchema.validate({ title: "x" });
    expect(error).toBeDefined();
  });

  test("`score` RAD etiladi — ball faqat review orqali beriladi", () => {
    const { error } = achievementSchema.validate({
      documentType: DOC_TYPE,
      title: "x",
      score: 9999,
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/score/);
  });

  test("`status` RAD etiladi — tasdiq holati faqat review orqali", () => {
    const { error } = achievementSchema.validate({
      documentType: DOC_TYPE,
      status: "approved",
    });
    expect(error).toBeDefined();
  });
});

describe("studentAchievement.validation — myUpdateSchema (talaba tahrirlashi)", () => {
  test("ruxsat etilgan maydonlar qabul qilinadi", () => {
    const { error } = myUpdateSchema.validate({
      title: "Yangilangan sarlavha",
      desc: "izoh",
      link: "https://example.org",
      fileUrl: "/files/file/x.pdf",
      fileName: "x.pdf",
    });
    expect(error).toBeUndefined();
  });

  test("`status` RAD etiladi — talaba o'zini tasdiqlay olmaydi", () => {
    const { error } = myUpdateSchema.validate({ status: "approved" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/status/);
  });

  test("`score` RAD etiladi — talaba o'ziga ball qo'ya olmaydi", () => {
    const { error } = myUpdateSchema.validate({ score: 5000 });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/score/);
  });

  test("`reviewedBy` / `reviewedAt` / `reviewNote` RAD etiladi", () => {
    for (const key of ["reviewedBy", "reviewedAt", "reviewNote"]) {
      const { error } = myUpdateSchema.validate({ [key]: "x" });
      expect(error).toBeDefined();
    }
  });

  test("`student` RAD etiladi — boshqa talabaga ko'chirib bo'lmaydi", () => {
    const { error } = myUpdateSchema.validate({ student: DOC_TYPE });
    expect(error).toBeDefined();
  });
});

describe("studentAchievement.validation — updateSchema (kafedra tahrirlashi)", () => {
  test("`score` va `status` RAD etiladi (ball/holat = review endpoint)", () => {
    expect(updateSchema.validate({ score: 100 }).error).toBeDefined();
    expect(updateSchema.validate({ status: "approved" }).error).toBeDefined();
  });

  test("oddiy maydonlar qabul qilinadi", () => {
    const { error } = updateSchema.validate({ title: "yangi", desc: "izoh" });
    expect(error).toBeUndefined();
  });
});

describe("studentAchievement.validation — reviewSchema", () => {
  test("approved + ball qabul qilinadi", () => {
    const { error } = reviewSchema.validate({ status: "approved", score: 30 });
    expect(error).toBeUndefined();
  });

  test("rejected uchun reviewNote MAJBURIY", () => {
    expect(reviewSchema.validate({ status: "rejected" }).error).toBeDefined();
    expect(
      reviewSchema.validate({ status: "rejected", reviewNote: "sabab" }).error,
    ).toBeUndefined();
  });

  test("manfiy ball rad etiladi", () => {
    const { error } = reviewSchema.validate({ status: "approved", score: -5 });
    expect(error).toBeDefined();
  });

  test("noto'g'ri status rad etiladi", () => {
    const { error } = reviewSchema.validate({ status: "pending" });
    expect(error).toBeDefined();
  });
});

describe("studentAchievement.validation — findAll (query)", () => {
  test("`search` bo'shliqlari kesiladi", () => {
    const { error, value } = findAll.validate({ search: "  ilmiy maqola  " });
    expect(error).toBeUndefined();
    expect(value.search).toBe("ilmiy maqola");
  });

  test("bo'sh `search` qabul qilinadi (filtr keyin qo'yilmaydi)", () => {
    expect(findAll.validate({ search: "" }).error).toBeUndefined();
    expect(findAll.validate({ search: "   " }).value.search).toBe("");
  });

  test("`search`siz so'rov o'zgarishsiz o'tadi", () => {
    const { error, value } = findAll.validate({ status: "approved" });
    expect(error).toBeUndefined();
    expect(value).toEqual({ status: "approved" });
  });

  test("regex metakarakterlari Joi darajasida RAD ETILMAYDI (escape controllerda)", () => {
    expect(findAll.validate({ search: "a(b[c+\\" }).error).toBeUndefined();
  });
});
