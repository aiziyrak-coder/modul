const {
  announcementSchema,
  announcementUpdateSchema,
} = require("./announcement.validation");

const ok = (schema, value) => schema.validate(value).error === undefined;

describe("announcementSchema (POST)", () => {
  test("sarlavha + mazmun — to'g'ri", () => {
    expect(ok(announcementSchema, { title: "E'lon", content: "Matn" })).toBe(true);
  });

  test("`author` TANADA — RAD etiladi (mass-assignment himoyasi)", () => {
    const { error } = announcementSchema.validate({
      title: "E'lon",
      content: "Matn",
      author: "6a439099c8a1cdc8767be49f",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/author/);
  });

  test("bo'sh sarlavha yoki mazmun — rad etiladi", () => {
    expect(ok(announcementSchema, { title: "", content: "Matn" })).toBe(false);
    expect(ok(announcementSchema, { title: "E'lon", content: "" })).toBe(false);
  });

  test("majburiy maydonsiz — rad etiladi", () => {
    expect(ok(announcementSchema, { title: "E'lon" })).toBe(false);
    expect(ok(announcementSchema, { content: "Matn" })).toBe(false);
  });

  test("juda uzun matn — rad etiladi (DoS/ko'rinish himoyasi)", () => {
    expect(ok(announcementSchema, { title: "a".repeat(301), content: "Matn" })).toBe(false);
    expect(ok(announcementSchema, { title: "E'lon", content: "a".repeat(10001) })).toBe(false);
  });
});

describe("announcementUpdateSchema (PUT)", () => {
  test("qisman yangilash — to'g'ri", () => {
    expect(ok(announcementUpdateSchema, { title: "Yangi sarlavha" })).toBe(true);
    expect(ok(announcementUpdateSchema, { active: false })).toBe(true);
  });

  test("`author` bu yerda ham RAD etiladi", () => {
    expect(ok(announcementUpdateSchema, { author: "6a439099c8a1cdc8767be49f" })).toBe(false);
  });
});
