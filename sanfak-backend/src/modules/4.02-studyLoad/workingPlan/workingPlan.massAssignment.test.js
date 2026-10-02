const fs = require("node:fs");
const path = require("node:path");

const validator = require("#shared/validator");
const {
  updateWorkingPlanScienceSchema,
} = require("./workingPlan.validation");

const BLOCK_ID = "111111111111111111111101";
const ROW_ID = "222222222222222222222201";
const PARTICLE_ID = "333333333333333333333301";
const DEPT_ID = "555555555555555555555501";
const SCI_ID = "444444444444444444444401";
const ASSESSMENT_ID = "999999999999999999999901";

const FE_PAYLOAD = {
  semKey: "1",
  parentId: BLOCK_ID,
  _id: ROW_ID,
  particle: [
    { _id: PARTICLE_ID, umumiy_yuklamaning_hajmi_soat: 120 },
    { _id: PARTICLE_ID, maruza: 30 },
  ],
  title: "Bioetika",
  code: "TF101",
  serialNumber: "2.01",
  totalCredit: 3,
};

const validate = (payload) => updateWorkingPlanScienceSchema.validate(payload);

describe("updateWorkingPlanScienceSchema — frontend payload'i (regressiya qulfi)", () => {
  test("frontendning REAL payload'i (8 kalit) O'TADI", () => {
    expect(validate(FE_PAYLOAD).error).toBeUndefined();
  });

  test("`title`/`code`/`serialNumber` null bo'lishi mumkin (mapper `?? null` beradi)", () => {
    expect(
      validate({ ...FE_PAYLOAD, title: null, code: null, serialNumber: null })
        .error,
    ).toBeUndefined();
  });

  test("particle elementining `_id` si bo'sh satr bo'lishi mumkin (mapper `b._id ?? ''`)", () => {
    expect(
      validate({ ...FE_PAYLOAD, particle: [{ _id: "", maruza: 30 }] }).error,
    ).toBeUndefined();
  });

  test("qatorning qonuniy maydonlari — `weeklyHours` / `evaluationType` o'tadi", () => {
    expect(
      validate({ ...FE_PAYLOAD, weeklyHours: 4, evaluationType: ASSESSMENT_ID })
        .error,
    ).toBeUndefined();
  });

  test("legacy `smester` obyekti o'tadi (mavjud kontrakt buzilmaydi)", () => {
    expect(
      validate({
        ...FE_PAYLOAD,
        smester: {
          totalCredit: 3,
          weeklyHours: 4,
          evaluationType: ASSESSMENT_ID,
        },
      }).error,
    ).toBeUndefined();
  });
});

describe("updateWorkingPlanScienceSchema — taqiqlangan kalitlar", () => {
  test("`department` RAD etiladi (yuklama boshqa kafedraga ko'chardi)", () => {
    expect(validate({ ...FE_PAYLOAD, department: DEPT_ID }).error).toBeDefined();
  });

  test("`science` RAD etiladi (fan kimligi — ADR-014 endpointidan)", () => {
    expect(validate({ ...FE_PAYLOAD, science: SCI_ID }).error).toBeDefined();
  });

  test("`alternatives` RAD etiladi (ADR-016 2-bosqich endpointidan)", () => {
    const { error } = validate({
      ...FE_PAYLOAD,
      alternatives: [{ scienceId: SCI_ID }],
    });
    expect(error).toBeDefined();
  });

  test("`smester` ichidagi `department` ham RAD etiladi (teshik ko'chib o'tmasin)", () => {
    expect(
      validate({ ...FE_PAYLOAD, smester: { department: DEPT_ID } }).error,
    ).toBeDefined();
  });

  test("noma'lum kalit JIMGINA tashlanmaydi — 400 (sukut 'saqlandi' degan taassurot berardi)", () => {
    expect(validate({ ...FE_PAYLOAD, active: false }).error).toBeDefined();
  });

  test("nishon kalitlari majburiy (`semKey` / `parentId` / `_id`)", () => {
    for (const key of ["semKey", "parentId", "_id"]) {
      const payload = { ...FE_PAYLOAD };
      delete payload[key];
      expect(validate(payload).error).toBeDefined();
    }
  });
});

describe("PUT /working-plans/study-plan|science/:id — validator middleware", () => {
  const middleware = validator.body(updateWorkingPlanScienceSchema);

  const run = async (body) => {
    const next = jest.fn();
    await middleware({ body, query: {}, params: {}, headers: {} }, {}, next);
    return next.mock.calls[0]?.[0];
  };

  test("frontend payload'i xatosiz o'tadi", async () => {
    expect(await run(FE_PAYLOAD)).toBeUndefined();
  });

  test("`department` body'da — 400", async () => {
    const err = await run({ ...FE_PAYLOAD, department: DEPT_ID });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("`science` body'da — 400", async () => {
    const err = await run({ ...FE_PAYLOAD, science: SCI_ID });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("`alternatives` body'da — 400", async () => {
    const err = await run({
      ...FE_PAYLOAD,
      alternatives: [{ scienceId: SCI_ID }],
    });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });
});

const ROUTES_FILE = path.join(__dirname, "workingPlan.routes.js");
const SRC = fs.readFileSync(ROUTES_FILE, "utf8");

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

const HANDLER_MARK = "Controller.updateStudyPlanScince,";
const VALIDATOR_MARK = "validator.body(updateWorkingPlanScienceSchema),";

describe("workingPlan.routes — mass-assignment allowlisti ikkala route'da", () => {
  test("handler hamon IKKI route'da ishlatiladi (skaner mo'ljalni yo'qotmadi)", () => {
    expect(countOf(SRC, HANDLER_MARK)).toBe(2);
  });

  test("har bir chaqiruvda `validator.body(updateWorkingPlanScienceSchema)` bor", () => {
    expect(countOf(SRC, VALIDATOR_MARK)).toBe(countOf(SRC, HANDLER_MARK));
  });

  test.each([["/study-plan/:id"], ["/science/:id"]])(
    "`%s` route zanjirida validator handlerdan OLDIN turadi",
    (routePath) => {
      const routeAt = SRC.indexOf(`.route("${routePath}")`);
      expect(routeAt).toBeGreaterThan(-1);

      const handlerAt = SRC.indexOf(HANDLER_MARK, routeAt);
      const validatorAt = SRC.indexOf(VALIDATOR_MARK, routeAt);
      expect(handlerAt).toBeGreaterThan(-1);
      expect(validatorAt).toBeGreaterThan(-1);
      expect(validatorAt).toBeLessThan(handlerAt);
    },
  );

  test("sxema route faylida import qilingan", () => {
    expect(SRC).toContain("updateWorkingPlanScienceSchema,");
  });
});
