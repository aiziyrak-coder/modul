const {
  contractSchema,
  rejectSchema,
  updateSchema,
} = require("./practice.validation");

const oid = "5f9f1b9b9c9d440000d1d1d1";

const validContract = {
  organization: oid,
  direction: "5f9f1b9b9c9d440000d1d1d2",
  academicYear: "5f9f1b9b9c9d440000d1d1d3",
  students: ["5f9f1b9b9c9d440000d1d1d4"],
  startDate: "2026-01-01",
  endDate: "2026-06-01",
};

describe("practice contract validation", () => {
  it("toto'g'ri shartnomani qabul qiladi", () => {
    const { error } = contractSchema.validate(validContract);
    expect(error).toBeUndefined();
  });

  it("kamida 1 ta talaba talab qiladi", () => {
    const { error } = contractSchema.validate({ ...validContract, students: [] });
    expect(error).toBeDefined();
  });

  it("endDate startDate'dan keyin bo'lishi kerak", () => {
    const { error } = contractSchema.validate({
      ...validContract,
      endDate: "2025-12-01",
    });
    expect(error).toBeDefined();
  });

  it("noto'g'ri ObjectId rad etiladi", () => {
    const { error } = contractSchema.validate({
      ...validContract,
      organization: "not-an-id",
    });
    expect(error).toBeDefined();
  });

  it("majburiy maydonsiz rad etiladi", () => {
    const { error } = contractSchema.validate({ direction: oid });
    expect(error).toBeDefined();
  });

  it("update barcha maydonlarni ixtiyoriy qiladi", () => {
    const { error } = updateSchema.validate({ note: "izoh" });
    expect(error).toBeUndefined();
  });

  it("reject sabab talab qiladi", () => {
    expect(rejectSchema.validate({}).error).toBeDefined();
    expect(rejectSchema.validate({ reason: "Hujjat to'liq emas" }).error).toBeUndefined();
  });
});
