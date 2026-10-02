const { submitSchema } = require("./public.validation");

const valid = () => ({
  title: "Bolalar kardiologiyasida erta tashxis usullari",
  specialty: "507f1f77bcf86cd799439011",
  year: "2025-2026",
  fullName: "Aliyev Vali Salimovich",
  workplace: "Toshkent tibbiyot akademiyasi",
  position: "Katta ilmiy xodim",
  passportSeries: "AA",
  passportNumber: "1234567",
  pinfl: "12345678901234",
  phone: "+998 90 123 45 67",
  email: "vali@example.uz",
  supervisorName: "Karimov Otabek Rustamovich",
  supervisorWorkplace: "Samarqand davlat tibbiyot universiteti",
  supervisorPosition: "Kafedra mudiri",
  supervisorAcademicTitle: "Professor",
  supervisorDegree: "FAN DOKTORI",
  supervisorEmail: "otabek@example.uz",
  supervisorPhone: "+998911234567",
});

describe("public.validation — tashqi ariza allowlist", () => {
  test("to'liq to'g'ri ariza qabul qilinadi", () => {
    const { error } = submitSchema.validate(valid());
    expect(error).toBeUndefined();
  });

  test("ixtiyoriy rahbar maydonlari bo'sh bo'lishi mumkin", () => {
    const { error } = submitSchema.validate({
      ...valid(),
      supervisorAcademicTitle: "",
      supervisorDegree: "",
      supervisorEmail: "",
      supervisorPhone: "",
    });
    expect(error).toBeUndefined();
  });

  test.each([
    ["status", { status: "accepted" }],
    ["researcher", { researcher: "507f1f77bcf86cd799439011" }],
    ["councilMembers", { councilMembers: ["507f1f77bcf86cd799439011"] }],
    ["secretary", { secretary: "507f1f77bcf86cd799439011" }],
    ["authorType", { authorType: "internal" }],
    ["protocol", { protocol: { immutable: true } }],
    ["workFile", { workFile: { filePath: "http://evil/x.pdf" } }],
  ])("tashqaridan `%s` yuborilsa REJECT qilinadi", (field, extra) => {
    const { error } = submitSchema.validate({ ...valid(), ...extra });
    expect(error).toBeDefined();
    expect(error.message).toMatch(field);
  });

  test.each([
    "title",
    "specialty",
    "year",
    "fullName",
    "workplace",
    "position",
    "passportSeries",
    "passportNumber",
    "pinfl",
    "phone",
    "email",
    "supervisorName",
    "supervisorWorkplace",
    "supervisorPosition",
  ])("`%s` majburiy — berilmasa rad etiladi", (field) => {
    const body = valid();
    delete body[field];
    const { error } = submitSchema.validate(body);
    expect(error).toBeDefined();
    expect(error.details[0].context.key).toBe(field);
  });

  test("JSHSHIR 14 raqamdan kam bo'lsa rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid(), pinfl: "1234567890" });
    expect(error.message).toMatch(/JSHSHIR/);
  });

  test("JSHSHIR harf bilan bo'lsa rad etiladi", () => {
    const { error } = submitSchema.validate({
      ...valid(),
      pinfl: "1234567890123A",
    });
    expect(error).toBeDefined();
  });

  test("pasport raqami 7 raqam bo'lishi shart", () => {
    expect(
      submitSchema.validate({ ...valid(), passportNumber: "123456" }).error,
    ).toBeDefined();
    expect(
      submitSchema.validate({ ...valid(), passportNumber: "12345678" }).error,
    ).toBeDefined();
  });

  test("pasport seriyasi kichik harfda kelsa ham qabul qilinadi va KATTAlashadi", () => {
    const { error, value } = submitSchema.validate({
      ...valid(),
      passportSeries: "ab",
    });
    expect(error).toBeUndefined();
    expect(value.passportSeries).toBe("AB");
  });

  test("pasport seriyasi kirillcha bo'lsa ham qabul qilinadi", () => {
    const { error } = submitSchema.validate({ ...valid(), passportSeries: "АА" });
    expect(error).toBeUndefined();
  });

  test("o'quv yili formati tekshiriladi", () => {
    expect(
      submitSchema.validate({ ...valid(), year: "2025/2026" }).error,
    ).toBeDefined();
    expect(submitSchema.validate({ ...valid(), year: "2025" }).error).toBeDefined();
  });

  test("ixtisoslik ObjectId bo'lmasa rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid(), specialty: "pediatriya" });
    expect(error.message).toMatch(/Ixtisoslik/);
  });

  test("noto'g'ri elektron pochta rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid(), email: "vali@" });
    expect(error).toBeDefined();
  });

  test("chet el telefon raqami QABUL qilinadi (tashqi tadqiqotchi)", () => {
    const { error } = submitSchema.validate({ ...valid(), phone: "+7 495 123-45-67" });
    expect(error).toBeUndefined();
  });

  test("telefon o'rniga matn yuborilsa rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid(), phone: "yo'q" });
    expect(error.message).toMatch(/[Tt]elefon/);
  });

  test("juda qisqa ilmiy ish nomi rad etiladi", () => {
    const { error } = submitSchema.validate({ ...valid(), title: "abc" });
    expect(error).toBeDefined();
  });
});
