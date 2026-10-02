const {
  createStartupTypeSchema,
  updateStartupTypeSchema,
  startupTypePaginateSchema,
} = require("./startupType.validation");
const { buildQuery } = require("./startupType.service");

describe("startupType.validation", () => {
  test("nom majburiy", () => {
    expect(createStartupTypeSchema.validate({}).error).toBeDefined();
    expect(createStartupTypeSchema.validate({ name: "" }).error).toBeDefined();
    expect(createStartupTypeSchema.validate({ name: "A" }).error).toBeDefined();
  });

  test("to'g'ri nom o'tadi", () => {
    expect(createStartupTypeSchema.validate({ name: "Ijtimoiy startap" }).error).toBeUndefined();
  });

  test("bo'sh update xato, qisman update o'tadi", () => {
    expect(updateStartupTypeSchema.validate({}).error).toBeDefined();
    expect(updateStartupTypeSchema.validate({ active: false }).error).toBeUndefined();
  });

  test("paginate page/limit majburiy", () => {
    expect(startupTypePaginateSchema.validate({}).error).toBeDefined();
    expect(startupTypePaginateSchema.validate({ page: 1, limit: 12 }).error).toBeUndefined();
  });
});

describe("startupType.service — buildQuery", () => {
  test("sukut bo'yicha faqat FAOL yozuvlar", () => {
    expect(buildQuery({})).toEqual({ active: true });
  });

  test("active ataylab berilsa — o'shanisi", () => {
    expect(buildQuery({ active: false })).toEqual({ active: false });
  });

  test("qidiruv regex bo'ladi va maxsus belgilar escape qilinadi", () => {
    const q = buildQuery({ search: "a.b*" });
    expect(q.name).toBeInstanceOf(RegExp);
    expect(q.name.source).toBe("a\\.b\\*");
  });
});
