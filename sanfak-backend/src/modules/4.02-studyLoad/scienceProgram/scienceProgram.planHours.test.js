const mongoose = require("mongoose");

const WorkingPlan = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Controller = require("./scienceProgram.controller");

const SCIENCE_ID = new mongoose.Types.ObjectId();
const OTHER_SCIENCE_ID = new mongoose.Types.ObjectId();
const AY_ID = new mongoose.Types.ObjectId();
const WS_ID = new mongoose.Types.ObjectId();

const PARTICLE = [
  { slug: "soat", canonical: "hour", value: 120 },
  { slug: "jami", canonical: "total", value: 60 },
  { slug: "maruza", canonical: "lecture", title: "Ma'ruza", value: 12 },
  { slug: "mustaqil_ta_lim", canonical: "independent", title: "Mustaqil ta'lim", value: 60 },
  { slug: "amaliy_mashg_ulot", canonical: "practical", title: "Amaliy", value: 40 },
  { slug: "laboratoriya_mashg_uloti", canonical: "laboratory", title: "Laboratoriya", value: 8 },
];

const scienceRow = (overrides = {}) => ({
  science: SCIENCE_ID,
  serialNumber: "1.2.06",
  code: "AN11-312",
  title: "Anatomiya",
  totalCredit: 4,
  weeklyHours: 4,
  particle: PARTICLE,
  ...overrides,
});

const wpFixture = (sciences) => ({
  workingSchedule: { academicYear: AY_ID },
  semesters: new Map([
    ["1", { blocks: [{ blockCode: "MFI", title: "Majburiy fanlar", sciences }] }],
  ]),
});

const clinicalWpFixture = () =>
  wpFixture([
    { serialNumber: "1.2.", code: "", title: "Klinika oldi fanlari moduli" },
    { science: OTHER_SCIENCE_ID, serialNumber: "1.2.01", code: "TBUG1106", title: "Tibbiy biologiya", particle: PARTICLE },
    { serialNumber: "1.3.", code: "", title: "Klinik modullar" },
    scienceRow({ serialNumber: "1.3.01", code: "ANR1301", title: "Anesteziologiya" }),
  ]);

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const wireLookup = (plans) => {
  jest.spyOn(WorkingScheduleModel, "find").mockReturnValue({
    distinct: jest.fn().mockResolvedValue([WS_ID]),
  });
  const chain = {};
  chain.sort = jest.fn(() => chain);
  chain.populate = jest.fn(() => chain);
  chain.exec = jest.fn().mockResolvedValue(plans);
  jest.spyOn(WorkingPlan, "find").mockReturnValue(chain);
};

const runStatus = async (wp, science = String(SCIENCE_ID)) => {
  wireLookup(wp ? [wp] : []);
  const res = makeRes();
  const next = jest.fn();
  await Controller.getWorkingPlanStatus({ query: { science } }, res, next);
  return { res, next, payload: res.json.mock.calls[0]?.[0] };
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("GET /working-plan-status — 🔒 backward-compat qulfi", () => {
  test("reja YO'Q → birinchi ikki kalit avvalgidek: hasWorkingPlan:false, warning:<matn>; planHours:null", async () => {
    const { res, next, payload } = await runStatus(null);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Object.keys(payload)).toEqual(["hasWorkingPlan", "warning", "planHours"]);
    expect(payload.hasWorkingPlan).toBe(false);
    expect(typeof payload.warning).toBe("string");
    expect(payload.warning).toMatch(/ishchi o'quv reja topilmadi/);
    expect(payload.planHours).toBeNull();
  });

  test("reja BOR → hasWorkingPlan:true, warning:null (avvalgidek); planHours obyekt", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]));

    expect(Object.keys(payload)).toEqual(["hasWorkingPlan", "warning", "planHours"]);
    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.warning).toBeNull();
    expect(payload.planHours).toEqual(expect.any(Object));
  });

  test("reja bor, lekin fan unda YO'Q → reja yo'q bilan bir xil javob (planHours:null)", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]), String(OTHER_SCIENCE_ID));

    expect(payload.hasWorkingPlan).toBe(false);
    expect(typeof payload.warning).toBe("string");
    expect(payload.planHours).toBeNull();
  });

  test("science berilmasa / noto'g'ri bo'lsa → 400 (mavjud xulq, planHours'gacha yetmaydi)", async () => {
    for (const query of [{}, { science: "not-an-objectid" }]) {
      const res = makeRes();
      const next = jest.fn();
      await Controller.getWorkingPlanStatus({ query }, res, next);
      expect(res.json).not.toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    }
  });
});

describe("GET /working-plan-status — planHours shakli (dizayn §4.3)", () => {
  test("kalitlar to'plami AYNAN: items + §1 meta (academicYear'siz) + warnings", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]));

    expect(Object.keys(payload.planHours).sort()).toEqual(
      [
        "items",
        "classroomHours",
        "independentHours",
        "totalHours",
        "credits",
        "weeklyHours",
        "semester",
        "code",
        "serialNumber",
        "moduleType",
        "warnings",
      ].sort(),
    );
    expect(payload.planHours).not.toHaveProperty("academicYear");
    expect(payload.planHours).not.toHaveProperty("clinicalUnknown");
  });

  test("§1 qiymatlari `buildScienceProgramMeta` bilan bir xil manbadan (nusxa yo'q)", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]));
    const ph = payload.planHours;

    expect(ph.totalHours).toBe(120);
    expect(ph.classroomHours).toBe(60);
    expect(ph.independentHours).toBe(60);
    expect(ph.credits).toBe(4);
    expect(ph.weeklyHours).toBe(4);
    expect(ph.semester).toBe("1");
    expect(ph.code).toBe("AN11-312");
    expect(ph.serialNumber).toBe("1.2.06");
    expect(ph.moduleType).toBe("Majburiy");
  });

  test("items — allowlist TARTIBIDA (maruza→amaliy→…→laboratoriya), `mustaqil` YO'Q (Kengash #4)", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]));

    expect(payload.planHours.items).toEqual([
      { slug: "maruza", title: "Ma'ruza", value: 12 },
      { slug: "amaliy", title: "Amaliy", value: 40 },
      { slug: "laboratoriya", title: "Laboratoriya", value: 8 },
    ]);
    expect(payload.planHours.items.map((i) => i.slug)).not.toContain("mustaqil");
  });

  test("klinik bo'lmagan fan — `klinik_amaliyot` elementi YO'Q, warnings bo'sh massiv", async () => {
    const { payload } = await runStatus(wpFixture([scienceRow()]));

    expect(payload.planHours.items.map((i) => i.slug)).not.toContain("klinik_amaliyot");
    expect(payload.planHours.warnings).toEqual([]);
  });

  test("particle bo'sh → items [] + ogohlantirish (bloklamaydi, 200)", async () => {
    const { res, payload } = await runStatus(wpFixture([scienceRow({ particle: [] })]));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.planHours.items).toEqual([]);
    expect(payload.planHours.warnings).toHaveLength(1);
    expect(payload.planHours.warnings[0]).toMatch(/dars turlari bo'yicha soat/);
  });
});

describe("GET /working-plan-status — klinik fan (ADR-018 qoidasi, egasi qarori (b))", () => {
  test("klinik bo'lim ostidagi fan → `klinik_amaliyot` = round(aud × 0.5), amaliy shunga kamayadi", async () => {
    const { payload } = await runStatus(clinicalWpFixture());
    const items = payload.planHours.items;

    expect(items).toEqual([
      { slug: "maruza", title: "Ma'ruza", value: 12 },
      { slug: "amaliy", title: "Amaliy", value: 10 },
      { slug: "laboratoriya", title: "Laboratoriya", value: 8 },
      { slug: "klinik_amaliyot", title: "Klinik o'quv amaliyoti", value: 30 },
    ]);
  });

  test("INVARIANT: auditoriya yig'indisi ajratishdan keyin ham classroomHours ga teng (yuklama bilan bir xil)", async () => {
    const { payload } = await runStatus(clinicalWpFixture());
    const sum = payload.planHours.items.reduce((a, i) => a + i.value, 0);

    expect(sum).toBe(payload.planHours.classroomHours);
    expect(payload.planHours.warnings).toEqual([]);
  });

  test("bir blokdagi klinik BO'LMAGAN fan (1.2.01, 'Klinika oldi') → klinik elementi yo'q", async () => {
    const { payload } = await runStatus(clinicalWpFixture(), String(OTHER_SCIENCE_ID));

    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.planHours.items.map((i) => i.slug)).not.toContain("klinik_amaliyot");
  });
});

describe("GET /working-plan-status — warnings (Kengash #10: ogohlantirish, blok EMAS)", () => {
  test("jami ≠ Σ dars turlari → warnings'da nomutanosiblik xabari, javob 200 va hasWorkingPlan:true", async () => {
    const skewed = PARTICLE.map((p) => (p.canonical === "total" ? { ...p, value: 70 } : p));
    const { res, payload } = await runStatus(wpFixture([scienceRow({ particle: skewed })]));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload.hasWorkingPlan).toBe(true);
    expect(payload.planHours.classroomHours).toBe(70);
    expect(payload.planHours.warnings).toHaveLength(1);
    expect(payload.planHours.warnings[0]).toMatch(/70/);
    expect(payload.planHours.warnings[0]).toMatch(/60/);
  });
});
