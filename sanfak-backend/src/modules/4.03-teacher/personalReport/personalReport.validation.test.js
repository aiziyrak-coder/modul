const {
  createSchema,
  updateSchema,
  rejectSchema,
  approveSchema,
} = require("./personalReport.validation");

const VALID_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe("createSchema", () => {
  const base = {
    plan: VALID_ID,
    academicYear: VALID_ID,
    semester: 1,
    text: "Kuzgi semestr hisobotim.",
  };

  test("to'g'ri ma'lumot bilan o'tadi", () => {
    const { error } = createSchema.validate(base);
    expect(error).toBeUndefined();
  });

  test("`councilDecisionFile` — IXTIYORIY", () => {
    const { error, value } = createSchema.validate(base);
    expect(error).toBeUndefined();
    expect(value.councilDecisionFile).toBeUndefined();
  });

  test("`councilDecisionFile` berilsa qabul qilinadi", () => {
    const { error, value } = createSchema.validate({
      ...base,
      councilDecisionFile: "/files/qaror.pdf",
    });
    expect(error).toBeUndefined();
    expect(value.councilDecisionFile).toBe("/files/qaror.pdf");
  });

  test("`semester` faqat 1 yoki 2", () => {
    expect(createSchema.validate({ ...base, semester: 3 }).error).toBeDefined();
    expect(createSchema.validate({ ...base, semester: 1 }).error).toBeUndefined();
    expect(createSchema.validate({ ...base, semester: 2 }).error).toBeUndefined();
  });

  test("`text` majburiy", () => {
    const { text: _t, ...withoutText } = base;
    expect(createSchema.validate(withoutText).error).toBeDefined();
    expect(createSchema.validate({ ...base, text: "" }).error).toBeDefined();
  });

  test("`plan`/`academicYear` majburiy va ObjectId formatida", () => {
    const { plan: _p, ...withoutPlan } = base;
    expect(createSchema.validate(withoutPlan).error).toBeDefined();
    expect(createSchema.validate({ ...base, plan: "not-an-id" }).error).toBeDefined();
  });

  test("🔴 SECURITY: `teacher` yuborilsa RAD etiladi (server tomondan qo'yiladi)", () => {
    const { error } = createSchema.validate({
      ...base,
      teacher: "bbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(error).toBeDefined();
  });

  test("🔴 SECURITY: `status`/`approvals` yuborilsa RAD etiladi", () => {
    expect(createSchema.validate({ ...base, status: "approved" }).error).toBeDefined();
    expect(
      createSchema.validate({ ...base, approvals: [{ step: "dekan", status: "approved" }] })
        .error,
    ).toBeDefined();
  });
});

describe("updateSchema", () => {
  test("bo'sh obyekt ham o'tadi (hammasi ixtiyoriy)", () => {
    expect(updateSchema.validate({}).error).toBeUndefined();
  });

  test("`teacher`/`plan`/`status` yuborilsa RAD etiladi", () => {
    expect(updateSchema.validate({ teacher: VALID_ID }).error).toBeDefined();
    expect(updateSchema.validate({ plan: VALID_ID }).error).toBeDefined();
    expect(updateSchema.validate({ status: "approved" }).error).toBeDefined();
  });

  test("`semester`/`text`/`councilDecisionFile` qisman yangilanadi", () => {
    const { error, value } = updateSchema.validate({ semester: 2 });
    expect(error).toBeUndefined();
    expect(value.semester).toBe(2);
  });
});

describe("approveSchema", () => {
  test("bo'sh obyekt o'tadi (comment ixtiyoriy)", () => {
    expect(approveSchema.validate({}).error).toBeUndefined();
  });

  test("`step` faqat 'dekan'/'kotib'", () => {
    expect(approveSchema.validate({ step: "dekan" }).error).toBeUndefined();
    expect(approveSchema.validate({ step: "kotib" }).error).toBeUndefined();
    expect(approveSchema.validate({ step: "teacher" }).error).toBeDefined();
  });
});

describe("rejectSchema — `comment` MAJBURIY (topshiriq: 'reject da comment yo'q -> 400')", () => {
  test("`comment` bo'lmasa RAD etiladi", () => {
    expect(rejectSchema.validate({}).error).toBeDefined();
  });

  test("`comment` bilan qabul qilinadi", () => {
    const { error } = rejectSchema.validate({ comment: "Hisobot yetarli emas" });
    expect(error).toBeUndefined();
  });
});
