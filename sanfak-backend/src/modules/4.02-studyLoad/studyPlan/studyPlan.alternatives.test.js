const StudyPlanModel = require("./studyPlan.model");
const {
  alternativesSchema,
  updateStudyPlanScienceSchema,
} = require("./studyPlan.validation");
const {
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const LP_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCI_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEP_C = "cccccccccccccccccccccccc";

describe("studyPlan.model — alternatives maydoni", () => {
  test("berilmasa `[]` bo'ladi (mavjud hujjatlar buzilmaydi)", () => {
    const plan = new StudyPlanModel({
      learningProcess: LP_ID,
      blocks: [
        {
          blockCode: "TF2",
          title: "Tanlov fanlari",
          sciences: [{ code: "TF101", title: "Bioetika" }],
        },
      ],
    });

    const sci = plan.blocks[0].sciences[0];
    expect(Array.isArray(sci.alternatives)).toBe(true);
    expect(sci.alternatives).toHaveLength(0);
  });

  test("berilgan alternativ saqlanadi", () => {
    const plan = new StudyPlanModel({
      learningProcess: LP_ID,
      blocks: [
        {
          blockCode: "TF2",
          sciences: [
            {
              code: "TF101",
              alternatives: [
                {
                  science: SCI_B,
                  code: "TF102",
                  title: "Tibbiyot tarixi",
                  department: DEP_C,
                },
              ],
            },
          ],
        },
      ],
    });

    const alt = plan.blocks[0].sciences[0].alternatives[0];
    expect(String(alt.science)).toBe(SCI_B);
    expect(alt.code).toBe("TF102");
    expect(String(alt.department)).toBe(DEP_C);
  });

  test("alternativda kredit/soat/particle maydoni YO'Q (invariant)", () => {
    const paths = Object.keys(
      StudyPlanModel.schema
        .path("blocks")
        .schema.path("sciences")
        .schema.path("alternatives").schema.paths,
    );

    expect(paths.sort()).toEqual(["code", "department", "science", "title"]);
  });
});

describe("studyPlan.validation — alternativesSchema", () => {
  test(`${MAX_ALTERNATIVES} tagacha element qabul qilinadi`, () => {
    const payload = Array.from({ length: MAX_ALTERNATIVES }, () => ({
      scienceId: SCI_B,
    }));
    expect(alternativesSchema.validate(payload).error).toBeUndefined();
  });

  test("MAX_ALTERNATIVES dan ortiq element RAD etiladi", () => {
    const payload = Array.from({ length: MAX_ALTERNATIVES + 1 }, () => ({
      scienceId: SCI_B,
    }));
    expect(alternativesSchema.validate(payload).error).toBeDefined();
  });

  test("`code`/`title`/`department`/`science` klientdan RAD etiladi", () => {
    for (const extra of [
      { code: "TF102" },
      { title: "Tibbiyot tarixi" },
      { department: DEP_C },
      { science: SCI_B },
    ]) {
      const { error } = alternativesSchema.validate([
        { scienceId: SCI_B, ...extra },
      ]);
      expect(error).toBeDefined();
    }
  });
});

describe("updateStudyPlanScienceSchema — alternatives allowlist'da YO'Q", () => {
  const validBase = {
    blockCode: "TF2",
    scienceCode: "TF101",
    title: "Bioetika",
  };

  test("to'g'ri payload hamon qabul qilinadi (allowlist torayganicha qoldi)", () => {
    expect(
      updateStudyPlanScienceSchema.validate(validBase).error,
    ).toBeUndefined();
  });

  test("`alternatives` yuborilsa RAD etiladi (jim `$set` bo'lmaydi)", () => {
    const { error } = updateStudyPlanScienceSchema.validate({
      ...validBase,
      alternatives: [{ scienceId: SCI_B }],
    });
    expect(error).toBeDefined();
  });
});
