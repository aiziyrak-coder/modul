const {
  EDITABLE_SECTIONS,
  activityItemSchema,
  addActivitySchema,
  updateActivitySchema,
  APPROVAL_STEP_KEYS,
  approveWorkPlanSchema,
  rejectWorkPlanSchema,
  activityParamsSchema,
} = require("./personalWorkPlan.validation");

const VALID_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_ACTIVITY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

describe("activityParamsSchema — PATCH /:id/activity/:activityId/verify", () => {
  test("to'g'ri ikkala ObjectId bilan o'tadi", () => {
    const { error } = activityParamsSchema.validate({
      id: VALID_ID,
      activityId: VALID_ACTIVITY_ID,
    });
    expect(error).toBeUndefined();
  });

  test("noto'g'ri formatdagi `activityId` -> 400 (CastError/500 emas)", () => {
    const { error } = activityParamsSchema.validate({
      id: VALID_ID,
      activityId: "not-an-object-id",
    });
    expect(error).toBeDefined();
  });

  test("`activityId` yo'q bo'lsa -> 400", () => {
    const { error } = activityParamsSchema.validate({ id: VALID_ID });
    expect(error).toBeDefined();
  });
});

describe("EDITABLE_SECTIONS", () => {
  test("5 ta bo'lim, `methodicalWork` bor", () => {
    expect(EDITABLE_SECTIONS).toEqual([
      "methodicalWork",
      "researchWork",
      "mentoringWork",
      "organizationalWork",
      "extraWork",
    ]);
  });

  test("`teachingLoad` YO'Q — I bo'lim avtomatik, qo'lda tahrirlanmaydi", () => {
    expect(EDITABLE_SECTIONS).not.toContain("teachingLoad");
  });
});

describe("activityItemSchema — POST /:id/activity (item)", () => {
  test("to'liq to'g'ri payload qabul qilinadi", () => {
    const { error } = activityItemSchema.validate({
      title: "Maqola nashr etish",
      plannedCount: 3,
      semester: [1, 2],
      venue: "Kafedra majlisi zali",
    });
    expect(error).toBeUndefined();
  });

  test("`title` yo'q bo'lsa RAD etiladi", () => {
    const { error } = activityItemSchema.validate({ plannedCount: 1 });
    expect(error).toBeDefined();
  });

  test("`plannedCount`/`actualCount` son sifatida saqlanadi", () => {
    const { value, error } = activityItemSchema.validate({
      title: "Ilmiy maqola",
      plannedCount: 5,
      actualCount: 2,
    });
    expect(error).toBeUndefined();
    expect(value.plannedCount).toBe(5);
    expect(typeof value.plannedCount).toBe("number");
    expect(value.actualCount).toBe(2);
  });

  test("`plannedCount` string bo'lsa RAD etiladi (raqam emas)", () => {
    const { error } = activityItemSchema.validate({
      title: "x",
      plannedCount: "3 soat",
    });
    expect(error).toBeDefined();
  });

  test("`semester: [1,2]` qabul qilinadi (ko'p tanlov)", () => {
    const { error } = activityItemSchema.validate({
      title: "x",
      semester: [1, 2],
    });
    expect(error).toBeUndefined();
  });

  test("`semester: [3]` RAD etiladi (faqat 1|2)", () => {
    const { error } = activityItemSchema.validate({
      title: "x",
      semester: [3],
    });
    expect(error).toBeDefined();
  });

  test("`semester: 1` (massiv emas) RAD etiladi", () => {
    const { error } = activityItemSchema.validate({ title: "x", semester: 1 });
    expect(error).toBeDefined();
  });

  test("`status` klientdan yuborilsa RAD etiladi (xavfsizlik)", () => {
    const { error } = activityItemSchema.validate({
      title: "x",
      status: "completed",
    });
    expect(error).toBeDefined();
  });

  test("`mentoringWork` maydonlari (`studentName`/`topic`/`workType`) `title` bilan birga qabul qilinadi", () => {
    const { value, error } = activityItemSchema.validate({
      title: "Bitiruv malakaviy ishi",
      studentName: "Aliyev Vali",
      topic: "Yurak-qon tomir kasalliklari",
      workType: "bitiruv",
    });
    expect(error).toBeUndefined();
    expect(value.studentName).toBe("Aliyev Vali");
    expect(value.topic).toBe("Yurak-qon tomir kasalliklari");
    expect(value.workType).toBe("bitiruv");
  });
});

describe("addActivitySchema — POST /:id/activity (butun body)", () => {
  test("`section` + `item` to'g'ri bo'lsa qabul qilinadi", () => {
    const { error } = addActivitySchema.validate({
      section: "methodicalWork",
      item: { title: "O'quv-uslubiy qo'llanma" },
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum `section` RAD etiladi", () => {
    const { error } = addActivitySchema.validate({
      section: "hackerWork",
      item: { title: "x" },
    });
    expect(error).toBeDefined();
  });

  test("`section: teachingLoad` RAD etiladi (qo'lda tahrirlanmaydi)", () => {
    const { error } = addActivitySchema.validate({
      section: "teachingLoad",
      item: { title: "x" },
    });
    expect(error).toBeDefined();
  });

  test("`item` yo'q bo'lsa RAD etiladi", () => {
    const { error } = addActivitySchema.validate({ section: "researchWork" });
    expect(error).toBeDefined();
  });
});

describe("updateActivitySchema — PUT /:id/activity/:activityId (qisman)", () => {
  test("faqat `section` + bitta maydon (qisman yangilash) qabul qilinadi", () => {
    const { error } = updateActivitySchema.validate({
      section: "researchWork",
      actualCount: 4,
    });
    expect(error).toBeUndefined();
  });

  test("`status` klientdan yuborilsa RAD etiladi", () => {
    const { error } = updateActivitySchema.validate({
      section: "researchWork",
      status: "completed",
    });
    expect(error).toBeDefined();
  });
});

describe("APPROVAL_STEP_KEYS", () => {
  test("8 bosqich, TARTIBDA (shablon imzo blokiga mos)", () => {
    expect(APPROVAL_STEP_KEYS).toEqual([
      "teacher",
      "kafedraUslubiy",
      "kafedraIlmiy",
      "kafedraUstozShogird",
      "kafedraMudiri",
      "oquvUslubiy",
      "dekan",
      "ichkiNazorat",
    ]);
  });
});

describe("approveWorkPlanSchema — PATCH /:id/approve", () => {
  test("bo'sh body qabul qilinadi (comment/step ixtiyoriy — rol aniqlaydi)", () => {
    const { error } = approveWorkPlanSchema.validate({});
    expect(error).toBeUndefined();
  });

  test("`comment` va `step` bilan qabul qilinadi (super_admin holati)", () => {
    const { error } = approveWorkPlanSchema.validate({
      comment: "OK",
      step: "dekan",
    });
    expect(error).toBeUndefined();
  });

  test("noma'lum `step` qiymati RAD etiladi", () => {
    const { error } = approveWorkPlanSchema.validate({ step: "rektor" });
    expect(error).toBeDefined();
  });

  test("stub ERI maydonlari (`eriSignature`/`eriSerial`) qabul qilinadi", () => {
    const { error } = approveWorkPlanSchema.validate({
      eriSignature: "TEMP_ERI_PLACEHOLDER",
      eriSerial: null,
    });
    expect(error).toBeUndefined();
  });
});

describe("rejectWorkPlanSchema — PATCH /:id/reject", () => {
  test("`comment` majburiy — bo'lmasa RAD etiladi", () => {
    const { error } = rejectWorkPlanSchema.validate({});
    expect(error).toBeDefined();
  });

  test("`comment` bilan qabul qilinadi", () => {
    const { error } = rejectWorkPlanSchema.validate({ comment: "Yetarli emas" });
    expect(error).toBeUndefined();
  });

  test("noma'lum `step` qiymati RAD etiladi", () => {
    const { error } = rejectWorkPlanSchema.validate({
      comment: "x",
      step: "hacker",
    });
    expect(error).toBeDefined();
  });
});
