const {
  createJournalSchema,
  updateJournalSchema,
  journalPaginateSchema,
} = require("./oakJournal.validation");

describe("oakJournal.validation — createJournalSchema", () => {
  test("to'g'ri payload (name + type) qabul qilinadi", () => {
    const { error } = createJournalSchema.validate({
      name: "Scopus Journal of Medicine",
      type: "scopus",
    });
    expect(error).toBeUndefined();
  });

  test("name majburiy (yo'q bo'lsa xato)", () => {
    const { error } = createJournalSchema.validate({ type: "wos" });
    expect(error).toBeDefined();
  });

  test("type faqat 4 turdan biri (noto'g'ri qiymat xato)", () => {
    const { error } = createJournalSchema.validate({
      name: "X jurnal",
      type: "oak",
    });
    expect(error).toBeDefined();
  });

  test("nationalOak va foreignOak qabul qilinadi", () => {
    expect(
      createJournalSchema.validate({ name: "Milliy jurnal", type: "nationalOak" }).error,
    ).toBeUndefined();
    expect(
      createJournalSchema.validate({ name: "Xorijiy jurnal", type: "foreignOak" }).error,
    ).toBeUndefined();
  });
});

describe("oakJournal.validation — updateJournalSchema", () => {
  test("bo'sh update xato (kamida 1 maydon)", () => {
    const { error } = updateJournalSchema.validate({});
    expect(error).toBeDefined();
  });

  test("faqat name yangilash qabul qilinadi", () => {
    const { error } = updateJournalSchema.validate({ name: "Yangi nom" });
    expect(error).toBeUndefined();
  });
});

describe("oakJournal.validation — journalPaginateSchema", () => {
  test("page + limit majburiy", () => {
    expect(journalPaginateSchema.validate({}).error).toBeDefined();
    expect(
      journalPaginateSchema.validate({ page: 1, limit: 15 }).error,
    ).toBeUndefined();
  });

  test("type filtri bilan qabul qilinadi", () => {
    const { error } = journalPaginateSchema.validate({
      page: 1,
      limit: 15,
      type: "scopus",
    });
    expect(error).toBeUndefined();
  });
});
