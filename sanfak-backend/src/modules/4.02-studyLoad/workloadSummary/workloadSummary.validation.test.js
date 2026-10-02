const {
  createSummarySchema,
  paginateSummaryQuery,
} = require("./workloadSummary.validation");

const OID = "6a8bdb6c5b767d415c184735";

describe("createSummarySchema", () => {
  test("ObjectId bilan o'tadi", () => {
    const { error } = createSummarySchema.validate({ academicYear: OID });
    expect(error).toBeUndefined();
  });

  test("«2024/2025» sarlavha bilan ham o'tadi", () => {
    expect(
      createSummarySchema.validate({ academicYear: "2024/2025" }).error,
    ).toBeUndefined();
    expect(
      createSummarySchema.validate({ academicYear: "2024-2025" }).error,
    ).toBeUndefined();
  });

  test("academicYear majburiy", () => {
    const { error } = createSummarySchema.validate({});
    expect(error).toBeDefined();
    expect(error.message).toContain("academicYear");
  });

  test("yaroqsiz yil rad etiladi", () => {
    expect(createSummarySchema.validate({ academicYear: "2024" }).error).toBeDefined();
    expect(createSummarySchema.validate({ academicYear: "abc" }).error).toBeDefined();
  });

  test.each([
    ["snapshot", { snapshot: { rows: [] } }],
    ["status", { status: "approved" }],
    ["approvalSteps", { approvalSteps: [] }],
    ["includedWorkloads", { includedWorkloads: [] }],
    ["createdBy", { createdBy: OID }],
  ])("ortiqcha maydon rad etiladi: %s", (_name, extra) => {
    const { error } = createSummarySchema.validate({ academicYear: OID, ...extra });
    expect(error).toBeDefined();
    expect(error.message).toContain("is not allowed");
  });
});

describe("paginateSummaryQuery", () => {
  const base = { page: 1, limit: 10 };

  test("faqat page/limit bilan o'tadi", () => {
    expect(paginateSummaryQuery.validate(base).error).toBeUndefined();
  });

  test("page/limit majburiy", () => {
    expect(paginateSummaryQuery.validate({}).error).toBeDefined();
  });

  test("yil va holat filtri qabul qilinadi", () => {
    const { error } = paginateSummaryQuery.validate({
      ...base,
      academicYear: OID,
      status: "approved",
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum holat rad etiladi", () => {
    const { error } = paginateSummaryQuery.validate({ ...base, status: "nimadir" });
    expect(error).toBeDefined();
  });

  test("model enum'i bilan mos — 5 holat", () => {
    for (const st of ["draft", "in_review", "approved", "rejected", "superseded"]) {
      expect(paginateSummaryQuery.validate({ ...base, status: st }).error).toBeUndefined();
    }
  });
});
