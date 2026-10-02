const { updateSchema } = require("./qualContract.validation");

describe("qualContract.validation — updateSchema.file (D-014)", () => {
  test("file='' qabul qilinadi (model'da required yo'q)", () => {
    const { error } = updateSchema.validate({ file: "" });
    expect(error).toBeUndefined();
  });

  test("totalPrice cheklovi saqlangan — number bo'lmasa xato", () => {
    const { error } = updateSchema.validate({ totalPrice: "abc" });
    expect(error).toBeDefined();
  });
});
