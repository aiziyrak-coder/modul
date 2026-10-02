const { safeLink } = require("./safeLink");
const { createSchema, updateSchema } = require("#modules/4.03-teacher/personalReport/personalReport.validation");
const { completeActivitySchema } = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.validation");

const ok = (v) => safeLink().validate(v).error === undefined;

describe("safeLink qoidasi", () => {
  test("http(s):// va /files/… — qabul qilinadi", () => {
    expect(ok("https://kengash.uz/qaror/12.pdf")).toBe(true);
    expect(ok("http://scopus.com/x")).toBe(true);
    expect(ok("/files/reports/qaror.pdf")).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok(null)).toBe(true);
  });

  test("«abc», javascript: va bo'shliqli qiymat — rad etiladi", () => {
    expect(ok("abc")).toBe(false);
    expect(ok("javascript:alert(1)")).toBe(false);
    expect(ok("https://a b.uz")).toBe(false);
  });
});

describe("sxemalarga ulangan (D-4 hisobot, D-4b faoliyat)", () => {
  const base = { plan: "a".repeat(24), academicYear: "b".repeat(24), semester: 1, text: "x" };

  test("hisobot: councilDecisionFile «abc» — 400 xabari bilan", () => {
    const { error } = createSchema.validate({ ...base, councilDecisionFile: "abc" });
    expect(error.message).toMatch(/http:\/\/ yoki https:\/\//);
    expect(updateSchema.validate({ councilDecisionFile: "abc" }).error).toBeDefined();
    expect(createSchema.validate({ ...base, councilDecisionFile: "https://x.uz/q.pdf" }).error).toBeUndefined();
  });

  test("faoliyat: fileUrl/link «abc» — rad, to'g'ri havola — o'tadi", () => {
    expect(completeActivitySchema.validate({ section: "researchWork", fileUrl: "abc" }).error).toBeDefined();
    expect(completeActivitySchema.validate({ section: "researchWork", link: "abc" }).error).toBeDefined();
    expect(
      completeActivitySchema.validate({ section: "researchWork", fileUrl: "/files/a.pdf", link: "https://scopus.com/1" }).error,
    ).toBeUndefined();
  });
});
