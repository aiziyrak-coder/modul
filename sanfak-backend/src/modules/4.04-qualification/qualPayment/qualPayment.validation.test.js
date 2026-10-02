const { myQuery, bankSchema } = require("./qualPayment.validation");

const COURSE = "64b2f0c2a1b2c3d4e5f60718";

describe("qualPayment.validation (D-014)", () => {
  test("myQuery: language='' qabul qilinadi (GET filtri)", () => {
    const { error } = myQuery.validate({ course: COURSE, language: "" });
    expect(error).toBeUndefined();
  });

  test("bankSchema: file='' qabul qilinadi", () => {
    const { error } = bankSchema.validate({ course: COURSE, amount: 1000, file: "" });
    expect(error).toBeUndefined();
  });

  test("bankSchema: amount cheklovi saqlangan — min(1) buzilsa xato", () => {
    const { error } = bankSchema.validate({ course: COURSE, amount: 0 });
    expect(error).toBeDefined();
  });
});
