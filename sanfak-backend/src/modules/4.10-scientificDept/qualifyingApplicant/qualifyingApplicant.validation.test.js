const {
  createApplicantSchema,
  rejectSchema,
  examDateSchema,
  resultSchema,
  applicantPaginateSchema,
} = require("./qualifyingApplicant.validation");

describe("qualifyingApplicant.validation", () => {
  describe("createApplicantSchema", () => {
    const valid = {
      name: "Karimov A.B.",
      researcherType: "mustaqil",
      course: 2,
      specialization: "3210100",
      university: "FarDU",
      phone: "+998 90 1234567",
    };

    it("to'g'ri payload o'tadi", () => {
      const { error } = createApplicantSchema.validate(valid);
      expect(error).toBeUndefined();
    });

    it("specialization majburiy", () => {
      const { specialization, ...rest } = valid;
      const { error } = createApplicantSchema.validate(rest);
      expect(error).toBeDefined();
    });

    it("name/OTM/telefon ixtiyoriy (o'qituvchida avto to'ldiriladi)", () => {
      const { name, university, phone, ...rest } = valid;
      const { error } = createApplicantSchema.validate(rest);
      expect(error).toBeUndefined();
    });

    it("noto'g'ri researcherType rad etiladi", () => {
      const { error } = createApplicantSchema.validate({
        ...valid,
        researcherType: "phd",
      });
      expect(error).toBeDefined();
    });
  });

  describe("rejectSchema", () => {
    it("reason majburiy", () => {
      expect(rejectSchema.validate({}).error).toBeDefined();
      expect(rejectSchema.validate({ reason: "Hujjatlar to'liq emas" }).error).toBeUndefined();
    });
  });

  describe("examDateSchema", () => {
    it("ids + examDate majburiy", () => {
      expect(examDateSchema.validate({ examDate: "2026-03-15" }).error).toBeDefined();
      const { error } = examDateSchema.validate({
        ids: ["507f1f77bcf86cd799439011"],
        examDate: "2026-03-15",
      });
      expect(error).toBeUndefined();
    });
  });

  describe("resultSchema", () => {
    it("faqat passed/failed", () => {
      expect(resultSchema.validate({ result: "passed" }).error).toBeUndefined();
      expect(resultSchema.validate({ result: "ok" }).error).toBeDefined();
    });
  });

  describe("applicantPaginateSchema", () => {
    it("page/limit majburiy", () => {
      expect(applicantPaginateSchema.validate({ status: "new" }).error).toBeDefined();
    });
  });
});
