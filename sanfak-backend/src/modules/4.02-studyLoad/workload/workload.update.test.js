const { updateWorkloadSchema } = require("./workload.validation");

describe("workload.validation — updateWorkloadSchema (E-2 fix)", () => {
  test("{status:'approved'} RAD etiladi (mass-assignment bypass)", () => {
    const { error } = updateWorkloadSchema.validate({ status: "approved" });
    expect(error).toBeDefined();
  });

  test("{approvalSteps:[]} RAD etiladi", () => {
    const { error } = updateWorkloadSchema.validate({ approvalSteps: [] });
    expect(error).toBeDefined();
  });

  test("{department:'...'} RAD etiladi", () => {
    const { error } = updateWorkloadSchema.validate({
      department: "64b2f0c2a1b2c3d4e5f60718",
    });
    expect(error).toBeDefined();
  });

  test("{file:'x.pdf'} RAD etiladi", () => {
    const { error } = updateWorkloadSchema.validate({ file: "x.pdf" });
    expect(error).toBeDefined();
  });

  test("{directions:[]} RAD etiladi (biznes ma'lumot — bu endpoint orqali emas)", () => {
    const { error } = updateWorkloadSchema.validate({ directions: [] });
    expect(error).toBeDefined();
  });

  test("ruxsat etilgan tavsifiy maydon (title) QABUL qilinadi", () => {
    const { error } = updateWorkloadSchema.validate({ title: "Yangi sarlavha" });
    expect(error).toBeUndefined();
  });

  test("ruxsat etilgan maydonlar (comment, date) birga QABUL qilinadi", () => {
    const { error } = updateWorkloadSchema.validate({
      comment: "izoh",
      date: "01.09.2026",
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh body RAD etiladi (kamida 1 maydon kerak)", () => {
    const { error } = updateWorkloadSchema.validate({});
    expect(error).toBeDefined();
  });
});
