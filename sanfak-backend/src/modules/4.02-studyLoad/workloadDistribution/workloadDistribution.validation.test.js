const {
  respondSchema,
  addBlockToTeacherSchema,
  fillVacancySchema,
  electiveChoiceSchema,
} = require("./workloadDistribution.validation");

describe("workloadDistribution.validation — respondSchema", () => {
  test("action='accepted', reason yo'q — qabul qilinadi", () => {
    const { error } = respondSchema.validate({ action: "accepted" });
    expect(error).toBeUndefined();
  });

  test("action='rejected' + mazmunli reason — qabul qilinadi", () => {
    const { error } = respondSchema.validate({
      action: "rejected",
      reason: "Yuklama ortiqcha",
    });
    expect(error).toBeUndefined();
  });

  test("action='rejected', reason yo'q — RAD etiladi", () => {
    const { error } = respondSchema.validate({ action: "rejected" });
    expect(error).toBeDefined();
  });

  test("action='rejected', reason faqat probel — RAD etiladi (trim'dan keyin bo'sh)", () => {
    const { error } = respondSchema.validate({
      action: "rejected",
      reason: "   ",
    });
    expect(error).toBeDefined();
  });

  test("noto'g'ri action (enum'da yo'q) — RAD etiladi", () => {
    const { error } = respondSchema.validate({ action: "approved" });
    expect(error).toBeDefined();
  });

  test("begona kalit (masalan `foo`) — RAD etiladi (Joi default unknown(false))", () => {
    const { error } = respondSchema.validate({ action: "accepted", foo: 1 });
    expect(error).toBeDefined();
  });

  test("action='accepted', reason='' — qabul qilinadi (ixtiyoriy maydon)", () => {
    const { error } = respondSchema.validate({ action: "accepted", reason: "" });
    expect(error).toBeUndefined();
  });

  const VALID_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const VALID_ID_2 = "bbbbbbbbbbbbbbbbbbbbbbbb";

  test("blockIds berilmasa — qabul qilinadi (ortga moslik, ADR-007 §6)", () => {
    const { error } = respondSchema.validate({ action: "accepted" });
    expect(error).toBeUndefined();
  });

  test("blockIds — to'g'ri hex ObjectId massivi — qabul qilinadi", () => {
    const { error } = respondSchema.validate({
      action: "accepted",
      blockIds: [VALID_ID, VALID_ID_2],
    });
    expect(error).toBeUndefined();
  });

  test("blockIds — bo'sh massiv — RAD etiladi (min(1))", () => {
    const { error } = respondSchema.validate({
      action: "accepted",
      blockIds: [],
    });
    expect(error).toBeDefined();
  });

  test("blockIds — takror id — RAD etiladi (unique())", () => {
    const { error } = respondSchema.validate({
      action: "accepted",
      blockIds: [VALID_ID, VALID_ID],
    });
    expect(error).toBeDefined();
  });

  test("blockIds — noto'g'ri hex (uzunlik/format) — RAD etiladi", () => {
    const { error } = respondSchema.validate({
      action: "accepted",
      blockIds: ["not-a-valid-object-id"],
    });
    expect(error).toBeDefined();
  });
});

const VALID_ID_24 = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe.each([
  ["addBlockToTeacherSchema", addBlockToTeacherSchema, { workloadBlockId: VALID_ID_24 }],
  ["fillVacancySchema", fillVacancySchema, { teacher: VALID_ID_24 }],
  [
    "electiveChoiceSchema",
    electiveChoiceSchema,
    { blockId: VALID_ID_24, scienceId: VALID_ID_24 },
  ],
])("workloadDistribution.validation — %s (Faza 2 bayonnoma maydonlari)", (_name, schema, requiredFields) => {
  test("suitabilityBasis/suitabilityNote ikkalasi ham yo'q — qabul qilinadi (unknown/match hech qachon so'ramaydi)", () => {
    const { error } = schema.validate({ ...requiredFields });
    expect(error).toBeUndefined();
  });

  test("suitabilityBasis + yetarli uzunlikdagi note (>=10) — qabul qilinadi", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "ish_tajribasi",
      suitabilityNote: "10 yillik amaliy tajribaga ega",
    });
    expect(error).toBeUndefined();
  });

  test("suitabilityBasis berilgan, suitabilityNote YO'Q — RAD etiladi (note majburiy bo'ladi)", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "ish_tajribasi",
    });
    expect(error).toBeDefined();
  });

  test("suitabilityBasis berilgan, note qisqa (<10) — RAD etiladi", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "ish_tajribasi",
      suitabilityNote: "qisqa",
    });
    expect(error).toBeDefined();
  });

  test("basis=\"boshqa\" + note 10-29 oralig'ida (30dan kam) — RAD etiladi", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "boshqa",
      suitabilityNote: "0".repeat(20),
    });
    expect(error).toBeDefined();
  });

  test("basis=\"boshqa\" + note >=30 — qabul qilinadi", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "boshqa",
      suitabilityNote: "0".repeat(30),
    });
    expect(error).toBeUndefined();
  });

  test("ro'yxatdan tashqari suitabilityBasis — RAD etiladi", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "sababsiz_narsa",
      suitabilityNote: "yetarlicha uzun izoh matni",
    });
    expect(error).toBeDefined();
  });

  test("declaredBy klientdan yuborilsa — RAD etiladi (mass-assignment yopiq)", () => {
    const { error } = schema.validate({
      ...requiredFields,
      suitabilityBasis: "ish_tajribasi",
      suitabilityNote: "yetarlicha uzun izoh matni",
      declaredBy: VALID_ID_24,
    });
    expect(error).toBeDefined();
  });

  test("declaredAt klientdan yuborilsa — RAD etiladi (mass-assignment yopiq)", () => {
    const { error } = schema.validate({
      ...requiredFields,
      declaredAt: new Date().toISOString(),
    });
    expect(error).toBeDefined();
  });
});

describe("Faza 2 — erkin matn uzunlik chegaralari", () => {
  const big = "a".repeat(50000);
  const {
    vacateTeacherSchema: vacate,
    fillVacancySchema: fill,
    addTeacherSchema: addT,
  } = require("./workloadDistribution.validation");

  test("vacate: reason 50k — RAD (max 1000)", () => {
    const { error } = vacate.validate({ reason: big });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain("reason");
  });

  test("vacate: reason 1000 — qabul", () => {
    const { error } = vacate.validate({ reason: "a".repeat(1000) });
    expect(error).toBeUndefined();
  });

  test("vacate: requiredSpecialization 50k — RAD (max 200)", () => {
    const { error } = vacate.validate({ requiredSpecialization: big });
    expect(error).toBeDefined();
  });

  test("fillVacancy: specialization 50k — RAD", () => {
    const { error } = fill.validate({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      specialization: big,
    });
    expect(error).toBeDefined();
  });

  test("addTeacher: vacancyReason 50k — RAD", () => {
    const { error } = addT.validate({
      teacher: "aaaaaaaaaaaaaaaaaaaaaaaa",
      vacancyReason: big,
    });
    expect(error).toBeDefined();
  });
});

describe("workloadDistribution.validation — addBlockToTeacherSchema.classTypeSlugs (ADR-034)", () => {
  const base = { workloadBlockId: VALID_ID_24 };

  test("yo'q / bo'sh massiv / slug'lar — qabul qilinadi", () => {
    expect(addBlockToTeacherSchema.validate({ ...base }).error).toBeUndefined();
    expect(addBlockToTeacherSchema.validate({ ...base, classTypeSlugs: [] }).error).toBeUndefined();
    expect(
      addBlockToTeacherSchema.validate({ ...base, classTypeSlugs: ["maruza", "amaliy"] }).error,
    ).toBeUndefined();
  });

  test("takror slug / matn bo'lmagan element / 10 dan ko'p — RAD etiladi", () => {
    expect(
      addBlockToTeacherSchema.validate({ ...base, classTypeSlugs: ["maruza", "maruza"] }).error,
    ).toBeDefined();
    expect(addBlockToTeacherSchema.validate({ ...base, classTypeSlugs: [1] }).error).toBeDefined();
    expect(
      addBlockToTeacherSchema.validate({
        ...base,
        classTypeSlugs: Array.from({ length: 11 }, (_, i) => `t${i}`),
      }).error,
    ).toBeDefined();
  });
});
