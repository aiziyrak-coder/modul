const { createSchema, updateSchema, idSchema, findAll } = require("./staff.validation");
const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");

describe("createSchema — `role` RAD ETILADI (privilege escalation himoyasi)", () => {
  test("`role` yuborilsa 400 (Joi strict unknown)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      role: "super_admin",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/"role" is not allowed/);
  });

  test("`oneIdPin` yuborilsa 400 (parol/PIN bu endpoint orqali o'rnatilmasin)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      oneIdPin: "00000000000001",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/"oneIdPin" is not allowed/);
  });

  test("`password` yuborilsa 400 (sxemada YO'Q, xavfsizlik qoidasi)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      password: "supersecret",
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/"password" is not allowed/);
  });

  test("firstName/lastName majburiy", () => {
    const { error } = createSchema.validate({});
    expect(error).toBeDefined();
  });

  test("`photo` va `degrees` QABUL qilinadi", () => {
    const { error, value } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      photo: "https://example.com/photo.jpg",
      degrees: {
        bachelorDegree: [{ title: "Diplom", path: "https://example.com/f.pdf" }],
      },
    });
    expect(error).toBeUndefined();
    expect(value.photo).toBe("https://example.com/photo.jpg");
    expect(value.degrees.bachelorDegree).toHaveLength(1);
  });

  test("to'g'ri minimal body — xatosiz o'tadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
    });
    expect(error).toBeUndefined();
  });
});

describe("updateSchema — `role` shu yerda ham RAD ETILADI", () => {
  test("`role` yuborilsa 400", () => {
    const { error } = updateSchema.validate({ role: "rektor" });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/"role" is not allowed/);
  });

  test("firstName/lastName ixtiyoriy (tahrirlashda hammasi optional)", () => {
    const { error } = updateSchema.validate({ phone: "+998901234567" });
    expect(error).toBeUndefined();
  });

  test("`photo` va `degrees` QABUL qilinadi", () => {
    const { error } = updateSchema.validate({
      photo: "https://example.com/photo.jpg",
      degrees: { masterDegree: [{ title: "Magistr", path: "https://x/y.pdf" }] },
    });
    expect(error).toBeUndefined();
  });
});

describe("createSchema — A-1: `teacherProfile` maydonlari", () => {
  test("`jshshir` 14 raqamdan boshqasini rad etadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      jshshir: "123",
    });
    expect(error).toBeDefined();
  });

  test("`jshshir` aynan 14 raqam bo'lsa qabul qilinadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      jshshir: "12345678901234",
    });
    expect(error).toBeUndefined();
  });

  test("`jshshir` bo'sh/`null` bo'lsa ham qabul qilinadi (ixtiyoriy)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      jshshir: "",
    });
    expect(error).toBeUndefined();
  });

  test("`birthDate`/`address` qabul qilinadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      birthDate: "1990-01-01",
      address: { region: "Farg'ona", district: "Marg'ilon", street: "Bog'bon" },
    });
    expect(error).toBeUndefined();
  });

  test("`faculty` qo'shilgan bo'lsa ham 400 bermaydi (staffFields'da endi bor)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      faculty: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(error).toBeUndefined();
  });
});

describe("createSchema — Faza 1b: kasbiy mutaxassislik maydonlari (SPEC §B.4)", () => {
  test("`teachingSpecialtyName` erkin matn sifatida qabul qilinadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyName: "Bolalar stomatologiyasi",
    });
    expect(error).toBeUndefined();
  });

  test("`teachingSpecialtyCode` to'g'ri OAK shifri (14.00.07) bilan qabul qilinadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyCode: "14.00.07",
    });
    expect(error).toBeUndefined();
  });

  test("`teachingSpecialtyCode` noto'g'ri formatda rad etiladi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyCode: "not-a-code",
    });
    expect(error).toBeDefined();
  });

  test("`teachingSpecialtyCode` bo'sh/`null` bo'lsa ham qabul qilinadi (ixtiyoriy — D1)", () => {
    expect(
      createSchema.validate({
        firstName: "Ali",
        lastName: "Valiyev",
        teachingSpecialtyCode: "",
      }).error,
    ).toBeUndefined();
    expect(
      createSchema.validate({
        firstName: "Ali",
        lastName: "Valiyev",
        teachingSpecialtyCode: null,
      }).error,
    ).toBeUndefined();
  });

  test("`teachingSpecialtyBasis` ro'yxatdagi qiymat bilan qabul qilinadi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyBasis: "ordinatura",
    });
    expect(error).toBeUndefined();
  });

  test("`teachingSpecialtyBasis` ro'yxatdan tashqari qiymat rad etiladi", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyBasis: "notARealBasis",
    });
    expect(error).toBeDefined();
  });

  test("`teachingSpecialtyNote` erkin matn (2000 belgigacha cheklov FE'da)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyNote: "Muqobil asos izohi",
    });
    expect(error).toBeUndefined();
  });

  test("hech biri berilmasa ham xatosiz o'tadi (majburiy EMAS — D1)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
    });
    expect(error).toBeUndefined();
  });
});

describe("updateSchema — Faza 1b: kasbiy mutaxassislik maydonlari hamon QABUL qilinadi", () => {
  test.each([
    ["teachingSpecialtyName", "Bolalar stomatologiyasi"],
    ["teachingSpecialtyCode", "14.00.07"],
    ["teachingSpecialtyBasis", "diplom"],
    ["teachingSpecialtyNote", "izoh"],
  ])("`%s` xatosiz o'tadi", (field, value) => {
    const { error } = updateSchema.validate({ [field]: value });
    expect(error).toBeUndefined();
  });
});

describe("teachingSpecialtyBasis — Joi enum ↔ teacherProfile model enum mos", () => {
  const modelEnum = TeacherProfile.schema
    .path("teachingSpecialtyBasis")
    .enumValues.filter((v) => v !== null);

  test("model enumi bo'sh emas (test o'zi bo'shab qolmasin)", () => {
    expect(modelEnum.length).toBeGreaterThan(0);
  });

  test.each(modelEnum)("model qiymati %s Joi'da ham qabul qilinadi (createSchema)", (value) => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyBasis: value,
    });
    expect(error).toBeUndefined();
  });

  test("Joi'dagi ro'yxat modeldagi bilan aynan bir xil (drift yo'q)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      teachingSpecialtyBasis: "not-a-real-value",
    });
    expect(error).toBeDefined();
    const joiAllowed = error.details[0].context.valids.filter(
      (v) => v !== null && v !== "",
    );
    expect([...joiAllowed].sort()).toEqual([...modelEnum].sort());
  });
});

describe("employmentType — Joi enum ↔ teacherProfile model enum mos", () => {
  const modelEnum = TeacherProfile.schema.path("employmentType").enumValues;

  test("model enumi bo'sh emas (test o'zi bo'shab qolmasin)", () => {
    expect(modelEnum.length).toBeGreaterThan(0);
  });

  test.each(modelEnum)("model qiymati %s Joi'da ham qabul qilinadi (createSchema)", (value) => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      employmentType: value,
    });
    expect(error).toBeUndefined();
  });

  test("Joi'dagi ro'yxat modeldagi bilan aynan bir xil (drift yo'q)", () => {
    const { error } = createSchema.validate({
      firstName: "Ali",
      lastName: "Valiyev",
      employmentType: "not-a-real-value",
    });
    expect(error).toBeDefined();
    const joiAllowed = error.details[0].context.valids;
    expect([...joiAllowed].sort()).toEqual([...modelEnum].sort());
  });
});

describe("findAll/paginate — `active` filtri (C-1, 2026-07-31)", () => {
  test("`active` berilmasa ham xatosiz o'tadi (ixtiyoriy)", () => {
    const { error, value } = findAll.validate({});
    expect(error).toBeUndefined();
    expect(value.active).toBeUndefined();
  });

  test("`active=false` qabul qilinadi va bool'ga cast qilinadi", () => {
    const { error, value } = findAll.validate({ active: "false" });
    expect(error).toBeUndefined();
    expect(value.active).toBe(false);
  });

  test("`active=true` qabul qilinadi", () => {
    const { error, value } = findAll.validate({ active: "true" });
    expect(error).toBeUndefined();
    expect(value.active).toBe(true);
  });

  test("yaroqsiz `active` qiymati rad etiladi", () => {
    const { error } = findAll.validate({ active: "not-a-bool" });
    expect(error).toBeDefined();
  });
});

describe("idSchema", () => {
  test("yaroqsiz ObjectId rad etiladi", () => {
    const { error } = idSchema.validate({ id: "not-an-object-id" });
    expect(error).toBeDefined();
  });

  test("to'g'ri ObjectId o'tadi", () => {
    const { error } = idSchema.validate({ id: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(error).toBeUndefined();
  });
});
