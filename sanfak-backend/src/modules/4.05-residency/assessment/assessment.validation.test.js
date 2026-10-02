const {
  createSchema,
  gradeSchema,
  updateSchema,
  listQuery,
  paginateQuery,
  eligibilityQuery,
} = require("./assessment.validation");

const validCreate = {
  resident: "64b2f0c2a1b2c3d4e5f60718",
  type: "oraliq",
};

describe("assessment.validation — D-074 (number/boolean, base orqali)", () => {
  test("score/maxScore/attestationAllowed/active bo'sh satr bilan qabul qilinadi (create)", () => {
    const { error, value } = createSchema.validate({
      ...validCreate,
      score: "",
      maxScore: "",
      attestationAllowed: "",
      active: "",
    });
    expect(error).toBeUndefined();
    expect(value.maxScore).toBe(100);
    expect(Object.prototype.hasOwnProperty.call(value, "score")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(value, "attestationAllowed")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(value, "active")).toBe(false);
  });

  test("updateSchema (Joi.object(base).min(1)) — bo'sh maxScore ham qabul qilinadi", () => {
    const { error, value } = updateSchema.validate({ maxScore: "" });
    expect(error).toBeUndefined();
    expect(value.maxScore).toBe(100);
  });

  test("haqiqiy qiymatlar saqlanadi (0/false shu jumladan)", () => {
    const { error, value } = createSchema.validate({
      ...validCreate,
      score: 0,
      attestationAllowed: false,
      active: false,
    });
    expect(error).toBeUndefined();
    expect(value.score).toBe(0);
    expect(value.attestationAllowed).toBe(false);
    expect(value.active).toBe(false);
  });

  test("gradeSchema.maxScore ham bo'sh qiymatni default bilan qabul qiladi", () => {
    const { error, value } = gradeSchema.validate({
      resident: "64b2f0c2a1b2c3d4e5f60718",
      type: "oraliq",
      score: 80,
      maxScore: "",
    });
    expect(error).toBeUndefined();
    expect(value.maxScore).toBe(100);
  });

  test("eligibilityQuery.fromDate/toDate bo'sh satr bilan qabul qilinadi", () => {
    const { error, value } = eligibilityQuery.validate({ fromDate: "", toDate: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "fromDate")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(value, "toDate")).toBe(false);
  });

  test("listQuery.active va paginateQuery.page/limit bo'sh satr bilan qabul qilinadi", () => {
    const { error, value } = paginateQuery.validate({ active: "", page: "", limit: "" });
    expect(error).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(value, "active")).toBe(false);
    expect(value.page).toBe(1);
    expect(value.limit).toBe(10);
  });
});

describe("assessment.validation — eligibilityQuery (ATW)", () => {
  test("`now` kaliti RAD ETILADI", () => {
    const { error } = eligibilityQuery.validate({ now: "2020-01-01" });
    expect(error).toBeDefined();
  });
});

describe("assessment.validation — D-014 anti-degenerat (resident, ataylab tegilmagan)", () => {
  test("createSchema — resident:'' RAD ETILADI", () => {
    const { error } = createSchema.validate({ ...validCreate, resident: "" });
    expect(error).toBeDefined();
  });

  test("gradeSchema — resident:'' RAD ETILADI (score/type ham required)", () => {
    const { error } = gradeSchema.validate({
      resident: "",
      type: "oraliq",
      score: 10,
    });
    expect(error).toBeDefined();
  });

  test("listQuery.type — bo'sh string enum ro'yxatidan tashqari qiymat sifatida hali ham 'valid()' ostida (D-014 rule bo'yicha xavfsiz deb belgilangan) — regressiya emas, faqat hujjatlash", () => {
    const { error } = listQuery.validate({ type: "" });
    expect(error).toBeUndefined();
  });
});
