const { createSchema } = require("./student.validation");

const oid = "5f9f1b9b9c9d440000d1d1d1";

const validBase = {
  fish: "Aliyev Vali Akramovich",
  academicYear: "5f9f1b9b9c9d440000d1d1d2",
  direction: "5f9f1b9b9c9d440000d1d1d3",
  course: 1,
  group: "101-guruh",
  region: "5f9f1b9b9c9d440000d1d1d4",
  district: "5f9f1b9b9c9d440000d1d1d5",
};

describe("student.validation — createSchema", () => {
  it("to'liq to'g'ri obyekt qabul qilinadi", () => {
    const { error } = createSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  it("active ixtiyoriy — bo'lsa ham qabul qilinadi", () => {
    const { error } = createSchema.validate({ ...validBase, active: true });
    expect(error).toBeUndefined();
  });

  it("fish majburiy (yo'q bo'lsa xato)", () => {
    const { fish, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("academicYear majburiy (yo'q bo'lsa xato)", () => {
    const { academicYear, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("direction majburiy (yo'q bo'lsa xato)", () => {
    const { direction, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("course majburiy (yo'q bo'lsa xato)", () => {
    const { course, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("group majburiy (yo'q bo'lsa xato)", () => {
    const { group, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("region majburiy (yo'q bo'lsa xato)", () => {
    const { region, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("district majburiy (yo'q bo'lsa xato)", () => {
    const { district, ...rest } = validBase;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  it("course integer >= 1 bo'lishi shart", () => {
    expect(createSchema.validate({ ...validBase, course: 0 }).error).toBeDefined();
    expect(createSchema.validate({ ...validBase, course: 1.5 }).error).toBeDefined();
    expect(createSchema.validate({ ...validBase, course: -2 }).error).toBeDefined();
  });

  it("noto'g'ri ObjectId (academicYear) rad etiladi", () => {
    const { error } = createSchema.validate({ ...validBase, academicYear: "not-an-id" });
    expect(error).toBeDefined();
  });

  it("noto'g'ri ObjectId (region) rad etiladi", () => {
    const { error } = createSchema.validate({ ...validBase, region: "not-an-id" });
    expect(error).toBeDefined();
  });

  it("noto'g'ri ObjectId (district) rad etiladi", () => {
    const { error } = createSchema.validate({ ...validBase, district: "not-an-id" });
    expect(error).toBeDefined();
  });
});
