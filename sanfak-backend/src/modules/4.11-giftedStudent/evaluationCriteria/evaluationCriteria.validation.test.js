const { criteriaSchema, updateSchema } = require("./evaluationCriteria.validation");

describe("evaluationCriteria.validation — criteriaSchema", () => {
  test("kategoriyali mezon qabul qilinadi", () => {
    const { error } = criteriaSchema.validate({
      name: "Loyihalar va startaplar",
      icon: "💡",
      categories: [
        { name: "Xalqaro grant", points: 35 },
        { name: "Mahalliy startap", points: 15, active: false },
      ],
    });
    expect(error).toBeUndefined();
  });

  test("kategoriyasiz (maxPoints) mezon qabul qilinadi", () => {
    const { error } = criteriaSchema.validate({ name: "Ixtiro patenti", maxPoints: 25 });
    expect(error).toBeUndefined();
  });

  test("name majburiy", () => {
    expect(criteriaSchema.validate({ maxPoints: 10 }).error).toBeDefined();
  });

  test("manfiy kategoriya bali RAD etiladi", () => {
    const { error } = criteriaSchema.validate({
      name: "x",
      categories: [{ name: "c", points: -5 }],
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/points/);
  });

  test("manfiy maxPoints RAD etiladi", () => {
    const { error } = criteriaSchema.validate({ name: "x", maxPoints: -1 });
    expect(error).toBeDefined();
  });

  test("0 ball ruxsat etiladi (chegara)", () => {
    expect(criteriaSchema.validate({ name: "x", maxPoints: 0 }).error).toBeUndefined();
    expect(
      criteriaSchema.validate({ name: "x", categories: [{ name: "c", points: 0 }] }).error,
    ).toBeUndefined();
  });

  test("begona maydon RAD etiladi", () => {
    expect(criteriaSchema.validate({ name: "x", bogus: 1 }).error).toBeDefined();
  });
});

describe("evaluationCriteria.validation — updateSchema", () => {
  test("name ixtiyoriy (partial update)", () => {
    expect(updateSchema.validate({ icon: "🏆" }).error).toBeUndefined();
  });

  test("manfiy ball update'da ham RAD etiladi", () => {
    expect(updateSchema.validate({ maxPoints: -3 }).error).toBeDefined();
  });
});

describe("evaluationCriteria.validation — kategoriya `_id`", () => {
  test("mavjud kategoriya `_id` bilan qabul qilinadi", () => {
    const { error, value } = updateSchema.validate({
      name: "Ilmiy konferensiya",
      categories: [
        { _id: "6a7efdac5916905f06cebea6", name: "Xalqaro konferensiya", points: 30 },
        { name: "Yangi kategoriya", points: 10 },
      ],
    });
    expect(error).toBeUndefined();
    expect(value.categories[0]._id).toBe("6a7efdac5916905f06cebea6");
    expect(value.categories[1]._id).toBeUndefined();
  });

  test("yaroqsiz `_id` RAD etiladi", () => {
    const { error } = updateSchema.validate({
      categories: [{ _id: "not-an-objectid", name: "x" }],
    });
    expect(error).toBeDefined();
  });
});
