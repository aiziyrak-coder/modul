const {
  createProfileSchema,
  updateProfileSchema,
  uploadMyDegreesSchema,
  deleteMyDegreeSchema,
  DEGREE_TYPES,
} = require("./teacher.validation");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe("updateProfileSchema — shaxsni tasdiqlovchi maydonlar RAD ETILADI (P-2)", () => {
  test.each([
    ["jshshir", "12345678901234"],
    ["passportSeries", "AA"],
    ["passportNumber", "1234567"],
    ["birthDate", "1990-01-01"],
    ["address", { region: "Farg'ona" }],
    ["gender", "male"],
    ["passportIssuedBy", "IIB"],
    ["passportIssuedAt", "2010-01-01"],
    ["passportExpiry", "2030-01-01"],
  ])("`%s` yuborilsa 400 (Joi strict unknown)", (field, value) => {
    const { error } = updateProfileSchema.validate({ [field]: value });
    expect(error).toBeDefined();
    expect(error.message).toMatch(new RegExp(`"${field}" is not allowed`));
  });
});

describe("createProfileSchema — shu maydonlar shu yerda ham RAD ETILADI", () => {
  test.each(["jshshir", "passportSeries", "birthDate", "address", "gender"])(
    "`%s` yuborilsa 400",
    (field) => {
      const { error } = createProfileSchema.validate({
        [field]: "x",
      });
      expect(error).toBeDefined();
      expect(error.message).toMatch(new RegExp(`"${field}" is not allowed`));
    },
  );
});

describe("createProfileSchema — F-3 (SECURITY, mass-assignment): `user` RAD ETILADI", () => {
  test("`user` yuborilsa 400 — server profilni doim `req.user._id` bilan yaratadi", () => {
    const { error } = createProfileSchema.validate({
      user: USER_ID,
      department: USER_ID,
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/"user" is not allowed/);
  });

  test("`user`siz to'g'ri payload xatosiz o'tadi", () => {
    const { error } = createProfileSchema.validate({ department: USER_ID });
    expect(error).toBeUndefined();
  });
});

describe("updateProfileSchema — ruxsat etilgan maydonlar hamon QABUL qilinadi", () => {
  test.each([
    ["department", USER_ID],
    ["employmentType", "asosiy"],
    ["contactInfo", { phone: "+998901234567", email: "a@b.uz" }],
    ["googleScholarUrl", "https://scholar.google.com/x"],
  ])("`%s` xatosiz o'tadi", (field, value) => {
    const { error } = updateProfileSchema.validate({ [field]: value });
    expect(error).toBeUndefined();
  });

  test("bo'sh body xatosiz o'tadi (hammasi optional)", () => {
    expect(updateProfileSchema.validate({}).error).toBeUndefined();
  });
});

describe("uploadMyDegreesSchema — A-5-BE §2", () => {
  test("`degrees.bachelorDegree` [{title,path}] bilan qabul qilinadi", () => {
    const { error } = uploadMyDegreesSchema.validate({
      degrees: {
        bachelorDegree: [{ title: "Diplom.pdf", path: "https://x/y.pdf" }],
      },
    });
    expect(error).toBeUndefined();
  });

  test("bo'sh body ham qabul qilinadi (Joi darajasida — 'kamida bitta fayl' service'da tekshiriladi)", () => {
    expect(uploadMyDegreesSchema.validate({}).error).toBeUndefined();
  });

  test("multipart boshqa maydonlar rad etilmaydi (.unknown(true))", () => {
    const { error } = uploadMyDegreesSchema.validate({ someMulterField: "x" });
    expect(error).toBeUndefined();
  });
});

describe("deleteMyDegreeSchema — A-5-BE §2", () => {
  test.each(DEGREE_TYPES)("`type=%s` to'g'ri ObjectId bilan o'tadi", (type) => {
    const { error } = deleteMyDegreeSchema.validate({ type, fileId: USER_ID });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri `type` -> 400", () => {
    const { error } = deleteMyDegreeSchema.validate({
      type: "notARealType",
      fileId: USER_ID,
    });
    expect(error).toBeDefined();
  });

  test("yaroqsiz `fileId` -> 400", () => {
    const { error } = deleteMyDegreeSchema.validate({
      type: "bachelorDegree",
      fileId: "not-an-object-id",
    });
    expect(error).toBeDefined();
  });
});
