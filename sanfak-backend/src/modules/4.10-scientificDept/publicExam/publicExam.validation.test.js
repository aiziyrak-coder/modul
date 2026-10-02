const { submitSchema } = require("./publicExam.validation");
const { isRegistrationOpen } = require("./publicExam.service");
const { FIELD_TO_SLOT, PUBLIC_ALLOWED_TYPES, PUBLIC_MAX_SIZE } = require("./publicExam.upload");
const Applicant = require("../qualifyingApplicant/qualifyingApplicant.model");

describe("publicExam.upload — hujjat kontrakti", () => {
  it("public fayl maydonlari model slotlari bilan AYNAN mos", () => {
    expect(Object.values(FIELD_TO_SLOT).sort()).toEqual(
      [...Applicant.APPLICANT_DOC_SLOTS].sort(),
    );
  });

  it("rasmiy ro'yxatdagi 7 ta hujjat bor", () => {
    expect(Applicant.APPLICANT_DOC_SLOTS).toEqual([
      "referral",
      "application",
      "passport",
      "diploma",
      "objektivka",
      "topic",
      "order",
    ]);
  });

  it("eski 'personal' sloti majburiylar ichida emas, lekin model'da saqlanadi", () => {
    expect(Applicant.APPLICANT_DOC_SLOTS).not.toContain("personal");
    expect(Applicant.LEGACY_DOC_SLOTS).toContain("personal");
    expect(Applicant.schema.path("documents.personal")).toBeDefined();
  });

  it("tokensiz endpoint fayl cheklovi umumiy limitdan qat'iyroq", () => {
    expect(PUBLIC_ALLOWED_TYPES).toEqual(["application/pdf", "image/jpeg", "image/jpg", "image/png"]);
    expect(PUBLIC_MAX_SIZE).toBe(10 * 1024 * 1024);
  });
});

describe("publicExam.validation — tokensiz ariza", () => {
  const valid = {
    name: "Karimov Akmal Anvarovich",
    specialization: "3210100",
    course: 2,
    university: "Farg'ona davlat universiteti",
    phone: "+998 90 123 45 67",
  };

  it("to'g'ri payload o'tadi", () => {
    const { error } = submitSchema.validate(valid);
    expect(error).toBeUndefined();
  });

  it("kurs ixtiyoriy — bo'sh bo'lsa ham o'tadi", () => {
    ["", null, undefined].forEach((course) => {
      const { error } = submitSchema.validate({ ...valid, course });
      expect(error).toBeUndefined();
    });
  });

  it.each(["name", "specialization", "university", "phone"])(
    "%s majburiy",
    (field) => {
      const payload = { ...valid };
      delete payload[field];
      const { error } = submitSchema.validate(payload);
      expect(error).toBeDefined();
    },
  );

  it.each([
    ["status", "approved"],
    ["examDate", "2026-09-01"],
    ["addedBy", "68b0f1e2c3d4e5f6a7b8c9d0"],
    ["reviewedBy", "68b0f1e2c3d4e5f6a7b8c9d0"],
    ["certificateFileUrl", "http://x/y.pdf"],
    ["rejectionReason", "xohladim"],
    ["active", false],
    ["documents", { referral: "http://x/y.pdf" }],
    ["source", "internal"],
  ])("server maydoni tashqaridan RAD etiladi: %s", (key, value) => {
    const { error } = submitSchema.validate({ ...valid, [key]: value });
    expect(error).toBeDefined();
  });

  it("researcherType endi qabul qilinmaydi (UI'dan olib tashlangan)", () => {
    const { error } = submitSchema.validate({ ...valid, researcherType: "mustaqil" });
    expect(error).toBeDefined();
  });
});

describe("publicExam.service — ro'yxatga olish oynasi", () => {
  const now = new Date("2026-08-19T10:00:00.000Z");

  it("ochiq va oynasiz mutaxassislik — qabul qilinadi", () => {
    expect(isRegistrationOpen({ status: "open", active: true }, now)).toBe(true);
  });

  it("yopiq mutaxassislik — qabul qilinmaydi", () => {
    expect(isRegistrationOpen({ status: "closed", active: true }, now)).toBe(false);
  });

  it("o'chirilgan (active:false) — qabul qilinmaydi", () => {
    expect(isRegistrationOpen({ status: "open", active: false }, now)).toBe(false);
  });

  it("ro'yxat hali boshlanmagan — qabul qilinmaydi", () => {
    const spec = { status: "open", active: true, regStart: "2026-09-01" };
    expect(isRegistrationOpen(spec, now)).toBe(false);
  });

  it("oxirgi kun ham qabul qilinadi (kun oxirigacha)", () => {
    const spec = { status: "open", active: true, regEnd: "2026-08-19" };
    expect(isRegistrationOpen(spec, now)).toBe(true);
  });

  it("muddat o'tgan — qabul qilinmaydi", () => {
    const spec = { status: "open", active: true, regEnd: "2026-08-18" };
    expect(isRegistrationOpen(spec, now)).toBe(false);
  });

  it("mavjud bo'lmagan mutaxassislik (null) — qabul qilinmaydi", () => {
    expect(isRegistrationOpen(null, now)).toBe(false);
  });
});
