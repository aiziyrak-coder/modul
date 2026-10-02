const { indicatorSchema, indicatorUpdateSchema } = require("./indicator.validation");

describe("indicator.validation — indicatorSchema (create)", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    const { error } = indicatorSchema.validate({ title: "Indikator" });
    expect(error).toBeUndefined();
  });

  test("title majburiy (yo'q bo'lsa xato)", () => {
    const { error } = indicatorSchema.validate({ desc: "izoh" });
    expect(error).toBeDefined();
  });
});

describe("indicator.validation — indicatorUpdateSchema (D-088 allowlist)", () => {
  test("bitta legit maydon (title) bilan qisman yangilanish qabul qilinadi", () => {
    const { error } = indicatorUpdateSchema.validate({ title: "Yangi nom" });
    expect(error).toBeUndefined();
  });

  test("faqat coefficient bilan qisman yangilanish qabul qilinadi", () => {
    const { error } = indicatorUpdateSchema.validate({ coefficient: 3 });
    expect(error).toBeUndefined();
  });

  test("active maydoni qabul qilinadi", () => {
    const { error } = indicatorUpdateSchema.validate({ active: false });
    expect(error).toBeUndefined();
  });

  test("sxemada yo'q kalit (masalan `role`) RAD ETILADI — mass-assignment himoyasi", () => {
    const { error } = indicatorUpdateSchema.validate({
      role: "super_admin",
      active: false,
    });
    expect(error).toBeDefined();
  });

  test("sxemada yo'q kalit (`_id`) RAD ETILADI", () => {
    const { error } = indicatorUpdateSchema.validate({
      _id: "64b2f0c2a1b2c3d4e5f60718",
    });
    expect(error).toBeDefined();
  });

  test("noto'g'ri tipdagi coefficient RAD ETILADI", () => {
    const { error } = indicatorUpdateSchema.validate({ coefficient: "matn" });
    expect(error).toBeDefined();
  });

  test("bo'sh string title RAD ETILADI (min 1, model'da nullable emas)", () => {
    const { error } = indicatorUpdateSchema.validate({ title: "" });
    expect(error).toBeDefined();
  });

  test("bo'sh body (hech qanday maydon) qabul qilinadi — hech narsa yangilanmaydi", () => {
    const { error } = indicatorUpdateSchema.validate({});
    expect(error).toBeUndefined();
  });
});
