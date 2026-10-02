const { organizationSchema } = require("./medicalOrganization.validation");

const oid = "5f9f1b9b9c9d440000d1d1d1";

const validBase = {
  title: "Farg'ona tibbiyot birlashmasi",
  orgType: oid,
  stir: "123456789",
  region: "5f9f1b9b9c9d440000d1d1d2",
  district: "5f9f1b9b9c9d440000d1d1d3",
  address: "Farg'ona sh., Mustaqillik ko'chasi 1",
  headName: "Aliyev Vali Akramovich",
  headJshshir: "12345678901234",
  headPhone: "+998901234567",
};

describe("medicalOrganization (amaliyot bazasi) validation", () => {
  it("to'g'ri bazani qabul qiladi", () => {
    const { error } = organizationSchema.validate(validBase);
    expect(error).toBeUndefined();
  });

  it("STIR 9 xonali bo'lishi shart", () => {
    expect(organizationSchema.validate({ ...validBase, stir: "12345" }).error).toBeDefined();
    expect(organizationSchema.validate({ ...validBase, stir: "1234567890" }).error).toBeDefined();
    expect(organizationSchema.validate({ ...validBase, stir: "abcdefghi" }).error).toBeDefined();
  });

  it("JSHSHIR 14 xonali bo'lishi shart", () => {
    expect(organizationSchema.validate({ ...validBase, headJshshir: "123" }).error).toBeDefined();
    expect(
      organizationSchema.validate({ ...validBase, headJshshir: "123456789012345" }).error,
    ).toBeDefined();
  });

  it("email ixtiyoriy, capacity ixtiyoriy", () => {
    const { error } = organizationSchema.validate({
      ...validBase,
      email: "info@example.uz",
      capacity: 50,
    });
    expect(error).toBeUndefined();
  });

  it("noto'g'ri email rad etiladi", () => {
    const { error } = organizationSchema.validate({ ...validBase, email: "buzuq" });
    expect(error).toBeDefined();
  });

  it("majburiy maydonsiz rad etiladi", () => {
    const { error } = organizationSchema.validate({ title: "X" });
    expect(error).toBeDefined();
  });
});
