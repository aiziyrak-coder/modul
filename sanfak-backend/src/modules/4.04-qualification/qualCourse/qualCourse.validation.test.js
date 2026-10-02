const { updateSchema } = require("./qualCourse.validation");

describe("qualCourse.validation — updateSchema.address (D-014)", () => {
  test("address='' qabul qilinadi (model'da required yo'q)", () => {
    const { error } = updateSchema.validate({ address: "" });
    expect(error).toBeUndefined();
  });

  test("address berilmasa ham xato yo'q (ixtiyoriy)", () => {
    const { error } = updateSchema.validate({ title: "Yangi nom" });
    expect(error).toBeUndefined();
  });

  test("form=1,2 cheklovi saqlangan — noto'g'ri qiymat rad etiladi", () => {
    const { error } = updateSchema.validate({ form: 3 });
    expect(error).toBeDefined();
  });
});
