const Applicant = require("./internationalAdmission.model");
const {
  APPLICANT_STATUSES,
  createSchema,
  rejectSchema,
  findAll,
} = require("./internationalAdmission.validation");

describe("internationalAdmission.validation", () => {
  const valid = {
    fullName: "Zulfiya Nazarova",
    country: "Qozogʻiston",
    phone: "+998993998877",
    parentPhone: "+998993332211",
    passportNumber: "KF4566559",
    email: "zulfiya.n@gmail.com",
    academicYear: "2025-2026",
  };

  it("to'liq payload o'tadi", () => {
    expect(createSchema.validate(valid).error).toBeUndefined();
  });

  it("F.I.Sh.siz o'tmaydi", () => {
    expect(createSchema.validate({ ...valid, fullName: undefined }).error).toBeDefined();
  });

  it("fuqaroliksiz o'tmaydi", () => {
    expect(createSchema.validate({ ...valid, country: undefined }).error).toBeDefined();
  });

  it("noto'g'ri email o'tmaydi", () => {
    expect(createSchema.validate({ ...valid, email: "shunchaki-matn" }).error).toBeDefined();
  });

  it("ota-onasining telefon raqami qabul qilinadi", () => {
    const { error, value } = createSchema.validate(valid);
    expect(error).toBeUndefined();
    expect(value.parentPhone).toBe("+998993332211");
  });

  it("status ro'yxati MODEL enum'i bilan bir xil", () => {
    const modelEnum = Applicant.schema.path("status").enumValues;
    expect(APPLICANT_STATUSES).toEqual(modelEnum);
    expect(modelEnum).toEqual(["new", "approved", "rejected"]);
  });

  it("modeldagi har bir status filtrdan o'tadi", () => {
    APPLICANT_STATUSES.forEach((status) => {
      expect(findAll.validate({ status }).error).toBeUndefined();
    });
  });

  it("modelda yo'q status filtrdan o'tmaydi", () => {
    ["applied", "accepted", "withdrawn", "enrolled"].forEach((status) => {
      expect(findAll.validate({ status }).error).toBeDefined();
    });
  });

  it("qaytarish sababi majburiy", () => {
    expect(rejectSchema.validate({}).error).toBeDefined();
  });

  it("qisqa sabab (10 belgidan kam) o'tmaydi", () => {
    expect(rejectSchema.validate({ reason: "yaroqsiz" }).error).toBeDefined();
  });

  it("yetarli sabab o'tadi", () => {
    const reason = "Pasport nusxasi o'qilmaydi, qayta yuklang";
    expect(rejectSchema.validate({ reason }).error).toBeUndefined();
  });
});
