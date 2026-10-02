const {
  createSchema,
  updateSchema,
  findAll,
  SEASON_NAMES,
  SEASON_STATUSES,
} = require("./admissionSeason.validation");
const AdmissionSeason = require("./admissionSeason.model");
const { computeStatus } = require("./admissionSeason.service");
const {
  createSchema: directionCreate,
} = require("../admissionDirection/admissionDirection.validation");
const { saveSchema: offerSave } = require("../admissionOffer/admissionOffer.validation");

const oid = "507f1f77bcf86cd799439011";

const validSeason = {
  titleUz: "2026 Kuzgi qabul",
  titleRu: "Осенний приём 2026",
  titleEn: "Autumn admission 2026",
  academicYear: "2026/2027",
  season: "kuz",
  items: [{ direction: oid, educationForms: [oid], educationLanguages: [oid] }],
  openDate: "2026-08-01",
  closeDate: "2026-09-30",
};

describe("admissionSeason validation", () => {
  it("to'g'ri mavsum o'tadi", () => {
    const { error } = createSchema.validate(validSeason);
    expect(error).toBeUndefined();
  });

  it("o'quv yili slash formatda ('2026/2027') — chiziqcha ('2026-2027') RAD etiladi", () => {
    expect(
      createSchema.validate({ ...validSeason, academicYear: "2026/2027" }).error,
    ).toBeUndefined();
    expect(
      createSchema.validate({ ...validSeason, academicYear: "2026-2027" }).error,
    ).toBeDefined();
  });

  it("enum'lar MODEL bilan bir xil (validation↔model drift bo'lmasin)", () => {
    expect(SEASON_NAMES).toEqual(AdmissionSeason.schema.path("season").enumValues);
    expect(SEASON_STATUSES).toEqual(AdmissionSeason.schema.path("status").enumValues);
    expect(SEASON_NAMES).toEqual(["bahor", "yoz", "kuz", "qish"]);
  });

  it("noma'lum mavsum rad etiladi", () => {
    const { error } = createSchema.validate({ ...validSeason, season: "avtumn" });
    expect(error).toBeDefined();
  });

  it("kamida bitta yo'nalish majburiy", () => {
    const { error } = createSchema.validate({ ...validSeason, items: [] });
    expect(error).toBeDefined();
  });

  it("`status` mijozdan QABUL QILINMAYDI — u sanalardan hosil bo'ladi", () => {
    const { error } = updateSchema.validate({ status: "ochiq" });
    expect(error).toBeDefined();
  });

  it("filtr sifatida status ruxsat etiladi (yozish emas, o'qish)", () => {
    const { error } = findAll.validate({ status: "ochiq" });
    expect(error).toBeUndefined();
  });
});

describe("computeStatus", () => {
  const open = new Date("2026-08-01");
  const close = new Date("2026-09-30");

  it("ochilishdan oldin — rejada", () => {
    expect(computeStatus(open, close, new Date("2026-07-01"))).toBe("rejada");
  });

  it("oraliqda — ochiq", () => {
    expect(computeStatus(open, close, new Date("2026-08-15"))).toBe("ochiq");
  });

  it("yopilishdan keyin — yopiq", () => {
    expect(computeStatus(open, close, new Date("2026-10-01"))).toBe("yopiq");
  });
});

describe("3 tilli maydonlar", () => {
  it("ma'lumotnomada uchala til ham MAJBURIY (TZ talabi)", () => {
    expect(
      directionCreate.validate({ titleUz: "Pediatriya", titleRu: "Педиатрия", titleEn: "Pediatrics" })
        .error,
    ).toBeUndefined();
    expect(directionCreate.validate({ titleUz: "Pediatriya", titleEn: "Pediatrics" }).error)
      .toBeDefined();
  });

  it("ofertada faqat O'ZBEKCHA sarlavha majburiy (sahifa bir tilni tahrirlaydi)", () => {
    const { error } = offerSave.validate({
      blocks: [{ titleUz: "Umumiy shartlar", bodyUz: "Matn" }],
    });
    expect(error).toBeUndefined();
  });

  it("ofertada kamida bitta blok bo'lishi shart", () => {
    expect(offerSave.validate({ blocks: [] }).error).toBeDefined();
  });
});

describe('withComputedStatus (o`qishda qayta hisoblash)', () => {
  const { withComputedStatus } = require("./admissionSeason.service");
  const doc = { openDate: new Date("2026-08-01"), closeDate: new Date("2026-09-30"), status: "rejada" };

  it("saqlangan holat ESKIRGAN bo'lsa sanaga qarab tuzatiladi", () => {
    expect(withComputedStatus(doc, new Date("2026-08-15")).status).toBe("ochiq");
    expect(withComputedStatus(doc, new Date("2026-10-05")).status).toBe("yopiq");
  });

  it("xodim MUDDATIDAN OLDIN yopgan bo'lsa — qaror sanadan ustun", () => {
    const closed = { ...doc, closedAt: new Date("2026-08-10"), closeDate: new Date("2026-08-10") };
    expect(withComputedStatus(closed, new Date("2026-08-05")).status).toBe("yopiq");
  });

  it("bo'sh qiymat yiqilmaydi", () => {
    expect(withComputedStatus(null)).toBeNull();
  });
});
