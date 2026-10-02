const { submitSchema } = require("./publicMethodical.validation");

const valid = {
  title: "Ichki kasalliklar bo'yicha uslubiy tavsiyanoma",
  specialty: "6a59d4b607edd11d93b7becd",
  academicYear: "2026/2027",
  authorName: "Karimov Akmal Toshmatovich",
  authorPhone: "+998901234567",
  organization: "Farg'ona jamoat salomatligi tibbiyot instituti",
};

describe("publicMethodical — forma validatsiyasi", () => {
  it("to'g'ri forma o'tadi", () => {
    const { error, value } = submitSchema.validate(valid);
    expect(error).toBeUndefined();
    expect(value.title).toBe(valid.title);
  });

  it("ixtiyoriy maydonlar bilan ham o'tadi", () => {
    const { error } = submitSchema.validate({
      ...valid,
      departmentName: "Ichki kasalliklar kafedrasi",
      authorEmail: "akmal@example.uz",
    });
    expect(error).toBeUndefined();
  });

  it.each(["title", "specialty", "academicYear", "authorName", "authorPhone", "organization"])(
    "%s majburiy",
    (field) => {
      const body = { ...valid };
      delete body[field];
      const { error } = submitSchema.validate(body);
      expect(error).toBeDefined();
    },
  );

  it("o'quv yili YYYY/YYYY shaklida bo'lishi kerak", () => {
    const { error } = submitSchema.validate({ ...valid, academicYear: "2026-2027" });
    expect(error.message).toContain("YYYY/YYYY");
  });

  it("mavzu 3 belgidan qisqa bo'lmaydi", () => {
    const { error } = submitSchema.validate({ ...valid, title: "ab" });
    expect(error).toBeDefined();
  });

  it("noto'g'ri e-pochta rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid, authorEmail: "akmal(at)example" });
    expect(error.message).toContain("E-pochta");
  });

  it("bo'sh e-pochta va kafedra ruxsat etiladi", () => {
    const { error } = submitSchema.validate({ ...valid, authorEmail: "", departmentName: "" });
    expect(error).toBeUndefined();
  });

  it.each([
    ["status", "approved"],
    ["author", "6a59d4b607edd11d93b7becd"],
    ["source", "internal"],
    ["registrationNumber", "u-t-26-1"],
    ["active", false],
    ["files", { methodical: "http://x/y.docx" }],
    ["direction", "Davolash ishi"],
    ["rektorSignedAt", "2026-01-01"],
  ])("allowlist: %s maydoni rad etiladi", (field, val) => {
    const { error } = submitSchema.validate({ ...valid, [field]: val });
    expect(error).toBeDefined();
  });

  it("ixtisoslik id emas, matn bo'lsa rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid, specialty: "Davolash ishi" });
    expect(error).toBeDefined();
  });

  it("bo'shliqlar tozalanadi (trim)", () => {
    const { value } = submitSchema.validate({ ...valid, authorName: "  Karimov Akmal  " });
    expect(value.authorName).toBe("Karimov Akmal");
  });
});
