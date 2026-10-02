const {
  createDegreeSchema,
} = require("./scientificDegree.validation");
const {
  rejectAchievementSchema,
} = require("#modules/4.10-scientificDept/_shared/achievement.validation");

describe("scientificDegree.validation", () => {
  const valid = {
    degreeType: "phd",
    specialty: "Kardiologiya",
    dissertationTopic: "Yurak ishemik kasalligi diagnostikasi",
    defenseDate: "2024-05-20",
    councilName: "DSc.03/30.12.2019.Tib.50.01",
    councilNumber: "12",
    academicYear: "2025/2026",
  };

  it("himoya sanasisiz o'tmaydi", () => {
    const { error } = createDegreeSchema.validate({
      ...valid,
      defenseDate: undefined,
    });
    expect(error).toBeDefined();
  });

  it("kengash nomi/raqamisiz o'tmaydi", () => {
    expect(
      createDegreeSchema.validate({ ...valid, councilName: undefined }).error,
    ).toBeDefined();
    expect(
      createDegreeSchema.validate({ ...valid, councilNumber: undefined }).error,
    ).toBeDefined();
  });

  it("to'liq payload o'tadi", () => {
    const { error } = createDegreeSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it("admin ma'lumotnomasidan kelgan istalgan nom o'tadi", () => {
    const { error } = createDegreeSchema.validate({ ...valid, degreeType: "Fan nomzodi" });
    expect(error).toBeUndefined();
  });

  it("bo'sh qiymat o'tmaydi", () => {
    expect(createDegreeSchema.validate({ ...valid, degreeType: "" }).error).toBeDefined();
    expect(
      createDegreeSchema.validate({ ...valid, degreeType: undefined }).error,
    ).toBeDefined();
  });

  it("dissertatsiya mavzusisiz o'tmaydi", () => {
    const { error } = createDegreeSchema.validate({
      ...valid,
      dissertationTopic: undefined,
    });
    expect(error).toBeDefined();
  });

  it("academicYear formati noto'g'ri o'tmaydi", () => {
    const { error } = createDegreeSchema.validate({
      ...valid,
      academicYear: "2025-2026",
    });
    expect(error).toBeDefined();
  });

  it("reject sabab majburiy", () => {
    expect(rejectAchievementSchema.validate({}).error).toBeDefined();
    expect(
      rejectAchievementSchema.validate({ reason: "Diplom nusxasi yo'q" }).error,
    ).toBeUndefined();
  });
});
