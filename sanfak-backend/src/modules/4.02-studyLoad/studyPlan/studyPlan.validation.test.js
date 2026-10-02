const {
  updateStudyPlanScienceSchema,
  addElectiveRowSchema,
} = require("./studyPlan.validation");

const validBase = {
  blockCode: "MFI",
  scienceCode: "MFI01",
  title: "Anatomiya",
};

const validate = (payload) => updateStudyPlanScienceSchema.validate(payload);

describe("studyPlan.validation — updateStudyPlanScienceSchema", () => {
  test("to'g'ri payload qabul qilinadi", () => {
    expect(validate(validBase).error).toBeUndefined();
  });

  test("kontent maydonlari (serialNumber, code, totalCredit) qabul qilinadi", () => {
    const payload = {
      ...validBase,
      serialNumber: "1",
      code: "MFI01",
      totalCredit: 6,
    };
    expect(validate(payload).error).toBeUndefined();
  });

  test("particle massivi (slugRef bilan) qabul qilinadi — GET→PUT aylanishi buzilmasin", () => {
    const payload = {
      ...validBase,
      particle: [
        {
          _id: "aaaaaaaaaaaaaaaaaaaaaaaa",
          slug: "maruza",
          slugRef: "bbbbbbbbbbbbbbbbbbbbbbbb",
          title: "Ma'ruza",
          value: 30,
          canonical: "lecture",
          colNum: 7,
        },
      ],
    };
    expect(validate(payload).error).toBeUndefined();
  });

  test("semesters (Map — raqamli kalitlar) qabul qilinadi", () => {
    const payload = {
      ...validBase,
      semesters: { 1: { hour: 60, credit: 4, weeklyHours: 4 } },
    };
    expect(validate(payload).error).toBeUndefined();
  });

  test("`science` ref'i RAD etiladi (serverda katalogdan hosil bo'ladi)", () => {
    const payload = { ...validBase, science: "aaaaaaaaaaaaaaaaaaaaaaaa" };
    expect(validate(payload).error).toBeDefined();
  });

  test("`department` ref'i RAD etiladi (yuklama kafedrasini ko'chirib yuborardi)", () => {
    const payload = { ...validBase, department: "aaaaaaaaaaaaaaaaaaaaaaaa" };
    expect(validate(payload).error).toBeDefined();
  });

  test("noma'lum maydon RAD etiladi (jimgina tashlanmaydi)", () => {
    expect(validate({ ...validBase, active: false }).error).toBeDefined();
    expect(validate({ ...validBase, status: "created" }).error).toBeDefined();
    expect(validate({ ...validBase, _id: "aaaa" }).error).toBeDefined();
  });

  test("particle item ichidagi noma'lum maydon ham RAD etiladi", () => {
    const payload = {
      ...validBase,
      particle: [{ slug: "maruza", department: "aaaaaaaaaaaaaaaaaaaaaaaa" }],
    };
    expect(validate(payload).error).toBeDefined();
  });

  test("blockCode majburiy", () => {
    const { blockCode, ...rest } = validBase;
    expect(blockCode).toBeDefined();
    expect(validate(rest).error).toBeDefined();
  });

  test("scienceCode majburiy", () => {
    const { scienceCode, ...rest } = validBase;
    expect(scienceCode).toBeDefined();
    expect(validate(rest).error).toBeDefined();
  });

  test("faqat nishon kalitlari — RAD etiladi (bo'sh `$set` MongoDB xom xatosini berardi)", () => {
    expect(validate({ blockCode: "MFI", scienceCode: "MFI01" }).error).toBeDefined();
  });
});

describe("PUT /study-plans/:id — validator middleware", () => {
  const validator = require("#shared/validator");
  const middleware = validator.body(updateStudyPlanScienceSchema);

  const run = async (body) => {
    const next = jest.fn();
    await middleware({ body, query: {}, params: {}, headers: {} }, {}, next);
    return next.mock.calls[0]?.[0];
  };

  test("`science` body'da — 400 (yozilmaydi)", async () => {
    const err = await run({ ...validBase, science: "aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("`department` body'da — 400 (yozilmaydi)", async () => {
    const err = await run({
      ...validBase,
      department: "aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
  });

  test("ruxsat etilgan payload — xatosiz o'tadi", async () => {
    expect(await run(validBase)).toBeUndefined();
  });
});

describe("studyPlan.validation — addElectiveRowSchema", () => {
  const validRow = {
    blockCode: "TF2",
    science: "aaaaaaaaaaaaaaaaaaaaaaaa",
    semesters: [{ semester: "3", hour: 3, credit: 3 }],
  };

  const validate = (payload) => addElectiveRowSchema.validate(payload);

  test("to'g'ri payload qabul qilinadi", () => {
    expect(validate(validRow).error).toBeUndefined();
  });

  test("`alternatives` (ADR-016 shakli, ≤2) qabul qilinadi", () => {
    const payload = {
      ...validRow,
      alternatives: [
        { scienceId: "bbbbbbbbbbbbbbbbbbbbbbbb" },
        { scienceId: "cccccccccccccccccccccccc" },
      ],
    };
    expect(validate(payload).error).toBeUndefined();
  });

  test("`alternatives` 2 tadan ortiq bo'lsa RAD etiladi (MAX_ALTERNATIVES)", () => {
    const payload = {
      ...validRow,
      alternatives: [
        { scienceId: "bbbbbbbbbbbbbbbbbbbbbbbb" },
        { scienceId: "cccccccccccccccccccccccc" },
        { scienceId: "dddddddddddddddddddddddd" },
      ],
    };
    expect(validate(payload).error).toBeDefined();
  });

  test("`science` majburiy", () => {
    const { science, ...rest } = validRow;
    expect(science).toBeDefined();
    expect(validate(rest).error).toBeDefined();
  });

  test("`semesters` bo'sh massiv RAD etiladi (kamida bitta semestr)", () => {
    expect(validate({ ...validRow, semesters: [] }).error).toBeDefined();
  });

  test("`hour: 0` RAD etiladi", () => {
    const payload = {
      ...validRow,
      semesters: [{ semester: "3", hour: 0, credit: 3 }],
    };
    const { error } = validate(payload);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/0 dan katta/);
  });

  test("`credit: 0` RAD etiladi", () => {
    const payload = {
      ...validRow,
      semesters: [{ semester: "3", hour: 3, credit: 0 }],
    };
    const { error } = validate(payload);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/0 dan katta/);
  });

  test("`hour: 0, credit: 0` ikkalasi ham RAD etiladi", () => {
    const payload = {
      ...validRow,
      semesters: [{ semester: "3", hour: 0, credit: 0 }],
    };
    expect(validate(payload).error).toBeDefined();
  });

  test("manfiy `hour` ham RAD etiladi", () => {
    const payload = {
      ...validRow,
      semesters: [{ semester: "3", hour: -1, credit: 3 }],
    };
    expect(validate(payload).error).toBeDefined();
  });

  test("musbat qiymatlar (hour>0, credit>0) qabul qilinadi", () => {
    const payload = {
      ...validRow,
      semesters: [{ semester: "3", hour: 3, credit: 3 }],
    };
    expect(validate(payload).error).toBeUndefined();
  });

  test("`department` RAD etiladi (klientdan qabul qilinmaydi — SERVERDAN)", () => {
    const payload = { ...validRow, department: "aaaaaaaaaaaaaaaaaaaaaaaa" };
    expect(validate(payload).error).toBeDefined();
  });

  test("`code` RAD etiladi (SERVERDAN katalogdan)", () => {
    const payload = { ...validRow, code: "FA1001" };
    expect(validate(payload).error).toBeDefined();
  });

  test("`title` RAD etiladi (SERVERDAN katalogdan)", () => {
    const payload = { ...validRow, title: "Gigiyena" };
    expect(validate(payload).error).toBeDefined();
  });

  test("boshqa noma'lum maydon RAD etiladi (`.unknown(false)` sukut)", () => {
    expect(validate({ ...validRow, active: true }).error).toBeDefined();
  });
});
