"use strict";

const {
  createReportSchema,
  updateReportSchema,
  approveReportSchema,
  rejectReportSchema,
  prefillSchema,
  summaryQuery,
  paginateReportQuery,
} = require("./contingentReport.validation");

const DIR = "6f0000000000000000000001";

const goodRow = (over = {}) => ({
  direction: DIR,
  directionTitle: "Davolash ishi",
  course: 1,
  total: 10,
  boys: 4,
  girls: 6,
  grant: 3,
  contract: 7,
  grantBoys: 1,
  grantGirls: 2,
  contractBoys: 3,
  contractGirls: 4,
  groupCount: 1,
  streamCount: 1,
  ...over,
});

const validate = (rows, foreignByCountry = []) =>
  updateReportSchema.validate({ rows, foreignByCountry });

describe("createReportSchema", () => {
  test("yil sarlavha yoki ObjectId; asOfDate ixtiyoriy ISO", () => {
    expect(createReportSchema.validate({ academicYear: "2026/2027" }).error).toBeUndefined();
    expect(createReportSchema.validate({ academicYear: DIR, asOfDate: "2026-09-22" }).error).toBeUndefined();
    expect(createReportSchema.validate({ academicYear: "2026" }).error).toBeDefined();
    expect(createReportSchema.validate({ academicYear: "2026/2027", rows: [] }).error).toBeDefined();
  });
});

describe("updateReportSchema — qator invariantlari (400)", () => {
  test("to'g'ri qator o'tadi, default'lar 0", () => {
    const { error, value } = validate([goodRow()]);
    expect(error).toBeUndefined();
    expect(value.rows[0]).toMatchObject({ category: "milliy", mobilityOut: 0, mobilityIn: 0 });
    expect(value.foreignByCountry).toEqual([]);
  });

  test.each([
    ["o'g'il + qiz ≠ jami", { boys: 5 }, "o'g'il + qiz jami talabaga teng emas"],
    ["grant + shartnoma ≠ jami", { grant: 4 }, "grant + shartnoma jami talabaga teng emas"],
    ["grant o'g'il + qiz ≠ grant", { grantBoys: 2 }, "grant o'g'il + qiz grant soniga teng emas"],
    ["shartnoma o'g'il + qiz ≠ shartnoma", { contractGirls: 5 }, "shartnoma o'g'il + qiz shartnoma soniga teng emas"],
  ])("%s → 400, xabar qator manzili bilan", (_label, over, msg) => {
    const { error } = validate([goodRow(over)]);
    expect(error).toBeDefined();
    expect(error.message).toContain("Davolash ishi 1-kurs");
    expect(error.message).toContain(msg);
  });

  test("manfiy/kasr/7-kurs/noto'g'ri toifa — rad", () => {
    expect(validate([goodRow({ total: -1, boys: -1, girls: 0, grant: -1, contract: 0, grantBoys: -1, grantGirls: 0, contractBoys: 0, contractGirls: 0 })]).error).toBeDefined();
    expect(validate([goodRow({ course: 7 })]).error).toBeDefined();
    expect(validate([goodRow({ course: 1.5 })]).error).toBeDefined();
    expect(validate([goodRow({ category: "boshqa" })]).error).toBeDefined();
  });

  test("bir xil yo'nalish×kurs×toifa ikki marta — rad; toifa farq qilsa — o'tadi", () => {
    expect(validate([goodRow(), goodRow()]).error?.message).toContain("Qator takrorlangan");
    expect(validate([goodRow(), goodRow({ category: "mdh" })]).error).toBeUndefined();
  });

  test("`source` faqat enum qiymatlari bilan qabul qilinadi (round-trip), begona kalit — rad", () => {
    expect(validate([goodRow({ source: { total: "groups" } })]).error).toBeUndefined();
    expect(validate([goodRow({ source: { total: "hacker" } })]).error).toBeDefined();
    expect(validate([goodRow({ source: { boys: "groups" } })]).error).toBeDefined();
  });

  test("status/approvalSteps mass-assignment — rad", () => {
    const { error } = updateReportSchema.validate({ rows: [goodRow()], status: "approved" });
    expect(error).toBeDefined();
  });
});

describe("updateReportSchema — davlatlar", () => {
  test("o'g'il + qiz = jami; nom trim; takror (harf farqsiz) — rad", () => {
    expect(validate([goodRow()], [{ country: "  Hindiston ", total: 3, boys: 1, girls: 2 }]).value.foreignByCountry[0].country).toBe("Hindiston");
    expect(validate([goodRow()], [{ country: "Hindiston", total: 3, boys: 1, girls: 1 }]).error?.message).toContain("Hindiston");
    expect(validate([goodRow()], [{ country: "Hindiston", total: 1, boys: 1 }, { country: "hindiston", total: 1, girls: 1 }]).error?.message).toContain("Davlat takrorlangan");
  });

  test("bo'sh nom — rad", () => {
    expect(validate([goodRow()], [{ country: "   ", total: 0 }]).error).toBeDefined();
  });
});

describe("approve/reject/prefill/summary/paginate sxemalari", () => {
  test("approve — protocol/signature ixtiyoriy, status rad", () => {
    expect(approveReportSchema.validate({}).error).toBeUndefined();
    expect(approveReportSchema.validate({ protocol: "3-son, 22.09.2026", signature: "x" }).error).toBeUndefined();
    expect(approveReportSchema.validate({ status: "approved" }).error).toBeDefined();
  });

  test("reject — comment ≤ 1000", () => {
    expect(rejectReportSchema.validate({ comment: "a".repeat(1000) }).error).toBeUndefined();
    expect(rejectReportSchema.validate({ comment: "a".repeat(1001) }).error).toBeDefined();
  });

  test("prefill — force default false", () => {
    expect(prefillSchema.validate({}).value).toEqual({ force: false });
    expect(prefillSchema.validate({ force: "ha" }).error).toBeDefined();
  });

  test("summary — academicYear majburiy", () => {
    expect(summaryQuery.validate({}).error).toBeDefined();
    expect(summaryQuery.validate({ academicYear: "2026/2027" }).error).toBeUndefined();
  });

  test("paginate — status faqat 4 holat", () => {
    expect(paginateReportQuery.validate({ page: 1, limit: 10, status: "approved" }).error).toBeUndefined();
    expect(paginateReportQuery.validate({ page: 1, limit: 10, status: "superseded" }).error).toBeDefined();
  });
});
