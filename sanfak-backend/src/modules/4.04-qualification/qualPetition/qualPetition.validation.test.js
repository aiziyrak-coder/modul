const { createSchema } = require("./qualPetition.validation");

const BASE = {
  bachelorDiploma: "http://files/diplom.pdf",
  course: "64b2f0c2a1b2c3d4e5f60718",
  province: "64b2f0c2a1b2c3d4e5f60719",
  region: "64b2f0c2a1b2c3d4e5f6071a",
};

describe("qualPetition.validation — createSchema (D-014)", () => {
  test("fullName/passport='' qabul qilinadi (OneID'dan controller to'ldiradi)", () => {
    const { error } = createSchema.validate({
      ...BASE,
      fullName: "",
      passport: "",
    });
    expect(error).toBeUndefined();
  });

  test("mastersDiploma/moCertificate='' qabul qilinadi (model default: null)", () => {
    const { error } = createSchema.validate({
      ...BASE,
      mastersDiploma: "",
      moCertificate: "",
    });
    expect(error).toBeUndefined();
  });

  test("bachelorDiploma majburiy — yo'q bo'lsa xato (o'zgartirilmagan)", () => {
    const { bachelorDiploma, ...rest } = BASE;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  test("course (ObjectId ref) majburiy — yo'q bo'lsa xato (o'zgartirilmagan)", () => {
    const { course, ...rest } = BASE;
    const { error } = createSchema.validate(rest);
    expect(error).toBeDefined();
  });

  test("status cheklovi saqlangan — ruxsat etilmagan qiymat rad etiladi", () => {
    const { error } = createSchema.validate({ ...BASE, status: 9 });
    expect(error).toBeDefined();
  });
});
