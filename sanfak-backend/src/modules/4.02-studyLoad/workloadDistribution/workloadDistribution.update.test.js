const { updateDistributionSchema } = require("./workloadDistribution.validation");

describe("workloadDistribution.validation — updateDistributionSchema (E-1 fix)", () => {
  test("{status:'approved'} RAD etiladi (mass-assignment bypass)", () => {
    const { error } = updateDistributionSchema.validate({
      status: "approved",
    });
    expect(error).toBeDefined();
  });

  test("{approvalSteps:[]} RAD etiladi", () => {
    const { error } = updateDistributionSchema.validate({
      approvalSteps: [],
    });
    expect(error).toBeDefined();
  });

  test("{teachers:[]} RAD etiladi (biznes ma'lumot — boshqa endpoint orqali)", () => {
    const { error } = updateDistributionSchema.validate({ teachers: [] });
    expect(error).toBeDefined();
  });

  test("{file:'x.pdf'} RAD etiladi", () => {
    const { error } = updateDistributionSchema.validate({ file: "x.pdf" });
    expect(error).toBeDefined();
  });

  test("{eriSignature:'...'} RAD etiladi", () => {
    const { error } = updateDistributionSchema.validate({
      eriSignature: "base64...",
    });
    expect(error).toBeDefined();
  });

  test("{workload:'...', academicYear:'...'} RAD etiladi (parent bog'lanish o'zgarmaydi)", () => {
    const { error } = updateDistributionSchema.validate({
      workload: "64b2f0c2a1b2c3d4e5f60718",
      academicYear: "64b2f0c2a1b2c3d4e5f60718",
    });
    expect(error).toBeDefined();
  });

  test("ruxsat etilgan tavsifiy maydon (title) QABUL qilinadi", () => {
    const { error } = updateDistributionSchema.validate({
      title: "Yangi sarlavha",
    });
    expect(error).toBeUndefined();
  });

  test("ruxsat etilgan maydonlar (course, comment, date) birga QABUL qilinadi", () => {
    const { error } = updateDistributionSchema.validate({
      course: 2,
      comment: "izoh",
      date: "01.09.2026",
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh body RAD etiladi (kamida 1 maydon kerak)", () => {
    const { error } = updateDistributionSchema.validate({});
    expect(error).toBeDefined();
  });
});
