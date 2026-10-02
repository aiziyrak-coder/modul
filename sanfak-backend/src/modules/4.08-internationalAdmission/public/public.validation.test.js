const { submitSchema, statusParams, statusLookupSchema } = require("./public.validation");

const oid = "507f1f77bcf86cd799439011";

const valid = {
  fullName: "Aliyev Sardor",
  birthDate: "2006-03-14",
  country: oid,
  phone: "+7 700 111 22 33",
  email: "sardor@example.com",
  passportNumber: "N1234567",
  passportExpiry: "2030-01-01",
  direction: oid,
  offerAccepted: true,
};

describe("public submitSchema", () => {
  it("to'g'ri ariza o'tadi", () => {
    expect(submitSchema.validate(valid).error).toBeUndefined();
  });

  it.each([
    ["status", { status: "approved" }],
    ["applicationNumber", { applicationNumber: "APP-2026-99999" }],
    ["season", { season: oid }],
    ["reviewedBy", { reviewedBy: oid }],
    ["active", { active: true }],
    ["academicYear", { academicYear: "2026-2027" }],
  ])("SERVER maydonini yuborib bo'lmaydi: %s", (_name, extra) => {
    const { error } = submitSchema.validate({ ...valid, ...extra });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/is not allowed/);
  });

  it("oferta roziligi MAJBURIY va faqat `true`", () => {
    expect(submitSchema.validate({ ...valid, offerAccepted: false }).error).toBeDefined();
    const withoutConsent = { ...valid };
    delete withoutConsent.offerAccepted;
    expect(submitSchema.validate(withoutConsent).error).toBeDefined();
  });

  it("pasport muddati O'TGAN bo'lsa rad etiladi", () => {
    expect(submitSchema.validate({ ...valid, passportExpiry: "2020-01-01" }).error).toBeDefined();
  });

  it("tug'ilgan sana KELAJAKDA bo'lsa rad etiladi", () => {
    expect(submitSchema.validate({ ...valid, birthDate: "2090-01-01" }).error).toBeDefined();
  });

  it("noto'g'ri email va bo'sh majburiy maydonlar rad etiladi", () => {
    expect(submitSchema.validate({ ...valid, email: "email-emas" }).error).toBeDefined();
    expect(submitSchema.validate({ ...valid, fullName: "" }).error).toBeDefined();
    expect(submitSchema.validate({ ...valid, direction: "" }).error).toBeDefined();
  });

  it("begona `documents` maydoni rad etiladi (allowlist — server to'ldiradi)", () => {
    expect(submitSchema.validate({ ...valid, documents: {} }).error).toBeDefined();
  });
});

describe("public statusParams", () => {
  it("APP-YYYY-NNNNN formati", () => {
    expect(statusParams.validate({ applicationNumber: "APP-2026-00001" }).error).toBeUndefined();
  });

  it("boshqa ko'rinishlar rad etiladi (ID bilan qidirib bo'lmaydi)", () => {
    ["12345", "APP-26-1", "507f1f77bcf86cd799439011", "APP-2026-1"].forEach((v) => {
      expect(statusParams.validate({ applicationNumber: v }).error).toBeDefined();
    });
  });
});

describe("public statusLookupSchema (raqam YOKI fuqarolik+pasport)", () => {
  it("raqam bilan o'tadi", () => {
    expect(statusLookupSchema.validate({ applicationNumber: "APP-2026-00001" }).error).toBeUndefined();
  });

  it("fuqarolik (ID) + pasport bilan o'tadi", () => {
    expect(
      statusLookupSchema.validate({ country: oid, passportNumber: "N1234567" }).error,
    ).toBeUndefined();
  });

  it("fuqarolik ID noto'g'ri (nom yuborilsa) rad etiladi", () => {
    expect(
      statusLookupSchema.validate({ country: "Qozogʻiston", passportNumber: "N1234567" }).error,
    ).toBeDefined();
  });

  it("bo'sh so'rov rad etiladi (kamida bittasi kerak)", () => {
    expect(statusLookupSchema.validate({}).error).toBeDefined();
  });

  it("pasport fuqaroliksiz rad etiladi", () => {
    expect(statusLookupSchema.validate({ passportNumber: "N1234567" }).error).toBeDefined();
  });

  it("noto'g'ri raqam formati rad etiladi", () => {
    expect(statusLookupSchema.validate({ applicationNumber: "APP-26-1" }).error).toBeDefined();
  });
});

describe("public languageQuery", () => {
  const { languageQuery } = require("./public.validation");

  it("uz/ru/en qabul qilinadi, bo'sh ham (ixtiyoriy)", () => {
    ["uz", "ru", "en"].forEach((v) => {
      expect(languageQuery.validate({ language: v }).error).toBeUndefined();
    });
    expect(languageQuery.validate({}).error).toBeUndefined();
  });

  it("noma'lum til JIMGINA e'tiborsiz qoldirilmaydi", () => {
    ["uzb", "RU", "ру", "de", ""].forEach((v) => {
      expect(languageQuery.validate({ language: v }).error).toBeDefined();
    });
  });
});

describe("public til tanlash mantiqi", () => {
  const { pick, langFields } = require("./public.service");
  const doc = { titleUz: "Davolash ishi", titleRu: "", titleEn: "General medicine" };

  it("so'ralgan tilni qaytaradi", () => {
    expect(pick(doc, "title", "en")).toBe("General medicine");
    expect(pick(doc, "title", "uz")).toBe("Davolash ishi");
  });

  it("tarjima BO'SH bo'lsa o'zbekchaga qaytadi (sayt bo'sh matn ko'rsatmasin)", () => {
    expect(pick(doc, "title", "ru")).toBe("Davolash ishi");
  });

  it("`language` berilsa faqat `title`, berilmasa uchchovi", () => {
    expect(langFields(doc, ["title"], "en")).toEqual({ title: "General medicine" });
    expect(langFields(doc, ["title"], undefined)).toEqual({
      titleUz: "Davolash ishi",
      titleRu: "",
      titleEn: "General medicine",
    });
  });
});
