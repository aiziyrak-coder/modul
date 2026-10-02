const WorkingPlanModel = require("./workingPlan.model");
const { alternativesSchema } = require("./workingPlan.validation");
const {
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const { computeSemesterTotals } = WorkingPlanModel;

const SCI_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCI_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCI_C = "cccccccccccccccccccccccc";

const planWithoutAlternatives = () =>
  new WorkingPlanModel({
    workingSchedule: SCI_A,
    semesters: {
      1: {
        semester: "1",
        blocks: [
          {
            blockCode: "TF2",
            title: "Tanlov fanlari",
            sciences: [{ code: "TF101", title: "Bioetika", totalCredit: 3 }],
          },
        ],
      },
    },
  });

describe("workingPlan.model — alternatives maydoni", () => {
  test("berilmasa `[]` bo'ladi (mavjud hujjatlar buzilmaydi)", () => {
    const plan = planWithoutAlternatives();
    const sci = plan.semesters.get("1").blocks[0].sciences[0];

    expect(Array.isArray(sci.alternatives)).toBe(true);
    expect(sci.alternatives).toHaveLength(0);
  });

  test("berilgan alternativ saqlanadi (science/code/title/department)", () => {
    const plan = new WorkingPlanModel({
      workingSchedule: SCI_A,
      semesters: {
        1: {
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
                      department: SCI_C,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    const alt = plan.semesters.get("1").blocks[0].sciences[0].alternatives[0];
    expect(String(alt.science)).toBe(SCI_B);
    expect(alt.code).toBe("TF102");
    expect(alt.title).toBe("Tibbiyot tarixi");
    expect(String(alt.department)).toBe(SCI_C);
  });

  test("alternativda kredit/soat/particle maydoni YO'Q (invariant)", () => {
    const plan = new WorkingPlanModel({
      workingSchedule: SCI_A,
      semesters: {
        1: {
          blocks: [
            {
              blockCode: "TF2",
              sciences: [{ code: "TF101", alternatives: [{ science: SCI_B }] }],
            },
          ],
        },
      },
    });
    const alt = plan.semesters.get("1").blocks[0].sciences[0].alternatives[0];

    expect(Object.keys(alt.schema.paths).sort()).toEqual([
      "code",
      "department",
      "science",
      "title",
    ]);
  });
});

describe("workingPlan.validation — alternativesSchema", () => {
  test("bo'sh massiv qabul qilinadi (alternativlar olib tashlandi)", () => {
    expect(alternativesSchema.validate([]).error).toBeUndefined();
  });

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

  test("`scienceId` majburiy", () => {
    expect(alternativesSchema.validate([{}]).error).toBeDefined();
  });

  test("`code` klientdan RAD etiladi (serverda katalogdan hosil bo'ladi)", () => {
    const { error } = alternativesSchema.validate([
      { scienceId: SCI_B, code: "TF102" },
    ]);
    expect(error).toBeDefined();
  });

  test("`title` klientdan RAD etiladi", () => {
    const { error } = alternativesSchema.validate([
      { scienceId: SCI_B, title: "Tibbiyot tarixi" },
    ]);
    expect(error).toBeDefined();
  });

  test("`department` klientdan RAD etiladi (yuklama kafedraga bog'lanadi)", () => {
    const { error } = alternativesSchema.validate([
      { scienceId: SCI_B, department: SCI_C },
    ]);
    expect(error).toBeDefined();
  });

  test("`science` refi ham klientdan RAD etiladi", () => {
    const { error } = alternativesSchema.validate([
      { scienceId: SCI_B, science: SCI_B },
    ]);
    expect(error).toBeDefined();
  });

  test("kredit/soat klientdan RAD etiladi (alternativning raqami yo'q)", () => {
    expect(
      alternativesSchema.validate([{ scienceId: SCI_B, totalCredit: 3 }]).error,
    ).toBeDefined();
    expect(
      alternativesSchema.validate([{ scienceId: SCI_B, weeklyHours: 2 }]).error,
    ).toBeDefined();
  });
});

const semesterFixture = (withAlternatives) => {
  const alternatives = withAlternatives
    ? Array.from({ length: MAX_ALTERNATIVES }, (_, i) => ({
        science: SCI_B,
        code: `ALT${i + 1}`,
        title: `Alternativ ${i + 1}`,
        department: SCI_C,
      }))
    : [];

  const science = (code, credit, hour, weekly) => ({
    code,
    totalCredit: credit,
    weeklyHours: weekly,
    particle: [
      {
        slug: "umumiy_yuklamaning_hajmi_soat",
        title: "Umumiy",
        value: hour,
      },
      { slug: "maruza", title: "Ma'ruza", value: Math.round(hour / 3) },
    ],
    alternatives,
  });

  return {
    semester: "1",
    blocks: [
      {
        blockCode: "MFI",
        title: "Majburiy fanlar",
        sciences: [science("OT101", 6, 180, 4)],
      },
      {
        blockCode: "TF2",
        title: "Tanlov fanlari",
        sciences: [science("TF101", 3, 90, 2), science("TF102", 3, 60, 2)],
      },
    ],
    practice: { hour: 20, credit: 2, particles: [] },
  };
};

describe("computeSemesterTotals — alternativlar yig'indiga TA'SIR QILMAYDI", () => {
  test("blocksTotal va grandTotal alternativsiz holat bilan AYNAN bir xil", () => {
    const without = semesterFixture(false);
    const withAlt = semesterFixture(true);

    computeSemesterTotals(without);
    computeSemesterTotals(withAlt);

    expect(withAlt.blocksTotal).toEqual(without.blocksTotal);
    expect(withAlt.grandTotal).toEqual(without.grandTotal);
  });

  test("kredit va soat aynan slot qiymatlaridan yig'iladi", () => {
    const withAlt = semesterFixture(true);
    computeSemesterTotals(withAlt);

    expect(withAlt.blocksTotal.totalCredit).toBe(12);
    expect(withAlt.blocksTotal.totalHour).toBe(330);
    expect(withAlt.blocksTotal.weeklyHours).toBe(8);
  });

  test("alternativ soni ikki barobar oshsa ham yig'indi o'zgarmaydi", () => {
    const base = semesterFixture(true);
    computeSemesterTotals(base);
    const snapshot = JSON.parse(JSON.stringify(base.grandTotal));

    for (const block of base.blocks) {
      for (const sci of block.sciences) {
        sci.alternatives = [
          ...sci.alternatives,
          { science: SCI_B, code: "ALTX", title: "Qo'shimcha", department: SCI_C },
        ];
      }
    }
    computeSemesterTotals(base);

    expect(JSON.parse(JSON.stringify(base.grandTotal))).toEqual(snapshot);
  });
});
