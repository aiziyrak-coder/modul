const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const ScienceModel = require("#references/science/science.model");
const {
  MAX_ALTERNATIVES,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const service = require("./workingPlan.service");
const { setElectiveAlternativesSchema } = require("./workingPlan.validation");

const { computeSemesterTotals } = WorkingPlanModel;

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaa01";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbb01";
const SP_ID = "cccccccccccccccccccccc01";
const BLOCK_ID = "111111111111111111111101";
const ROW_ID = "222222222222222222222201";
const MAIN_SCI = "333333333333333333333301";
const ALT1 = "444444444444444444444401";
const ALT2 = "444444444444444444444402";
const ALT3 = "444444444444444444444403";
const ALT_OLD = "444444444444444444444409";
const YOQ_SCI = "999999999999999999999999";
const MAIN_DEPT = "555555555555555555555500";
const DEPT1 = "555555555555555555555501";
const DEPT2 = "555555555555555555555502";

const CATALOG = {
  [ALT1]: {
    _id: ALT1,
    scienceCode: "TF201",
    isElective: true,
    title: "Tibbiyot tarixi",
    department: DEPT1,
  },
  [ALT2]: {
    _id: ALT2,
    scienceCode: "TF202",
    isElective: true,
    title: "Bioetika asoslari",
    department: DEPT2,
  },
  [ALT3]: {
    _id: ALT3,
    scienceCode: "TF203",
    isElective: true,
    title: "Tibbiy psixologiya",
    department: DEPT1,
  },
  [ALT_OLD]: {
    _id: ALT_OLD,
    scienceCode: "TF209",
    title: "Eski alternativ",
    department: DEPT2,
  },
};

const makeRow = (over = {}) => ({
  _id: ROW_ID,
  serialNumber: "2.01",
  code: "TF101",
  title: "Asosiy tanlov fani",
  science: MAIN_SCI,
  department: MAIN_DEPT,
  totalCredit: 3,
  weeklyHours: 2,
  particle: [
    { slug: "umumiy_yuklamaning_hajmi_soat", title: "Umumiy", value: 90 },
    { slug: "maruza", title: "Ma'ruza", value: 30 },
  ],
  alternatives: [],
  ...over,
});

const makePlan = (over = {}) => {
  const row = makeRow(over.row);
  const block = {
    _id: BLOCK_ID,
    blockCode: "TF2",
    title: "Tanlov fanlari",
    sciences: [row],
    ...(over.block || {}),
  };
  const semData = { semester: "1", blocks: [block] };
  return {
    _id: PLAN_ID,
    studyPlan: over.studyPlan === undefined ? SP_ID : over.studyPlan,
    workingSchedule: WS_ID,
    semesters: new Map([["1", semData]]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    _row: row,
    _block: block,
    _sem: semData,
  };
};

const makeStudyPlan = (over = {}) => {
  const row = makeRow({ _id: "888888888888888888888801" });
  const block = {
    blockCode: "TF2",
    title: "Tanlov fanlari",
    sciences: [row],
    ...(over.block || {}),
  };
  return {
    _id: SP_ID,
    blocks: [block],
    save: jest.fn().mockResolvedValue(undefined),
    _row: row,
  };
};

const mockSelectLean = (value) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});

const mockCatalog = () =>
  jest.spyOn(ScienceModel, "find").mockImplementation((filter) => {
    const ids = filter?._id?.$in || [];
    let docs = ids.map((id) => CATALOG[String(id)]).filter(Boolean);
    if (filter?.isElective?.$ne === true) docs = docs.filter((d) => d.isElective !== true);
    return mockSelectLean(docs);
  });

const arrange = (opts = {}) => {
  const plan = opts.plan || makePlan();
  const studyPlan =
    opts.studyPlan === undefined ? makeStudyPlan() : opts.studyPlan;

  jest.spyOn(WorkingPlanModel, "findOne").mockResolvedValue(plan);
  jest
    .spyOn(WorkingScheduleModel, "findById")
    .mockReturnValue(mockSelectLean({ status: opts.status || "draft" }));
  jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(studyPlan);
  const find = mockCatalog();

  return { plan, studyPlan, find };
};

const call = (over = {}) =>
  service.setElectiveAlternatives({
    planId: PLAN_ID,
    semKey: "1",
    blockId: BLOCK_ID,
    scienceRowId: ROW_ID,
    alternatives: [{ scienceId: ALT1 }, { scienceId: ALT2 }],
    scope: {},
    ...over,
  });

const expectReject = async (promise, statusCode) => {
  let caught = null;
  try {
    await promise;
  } catch (err) {
    caught = err;
  }
  expect(caught).not.toBeNull();
  expect(caught.statusCode).toBe(statusCode);
  return caught;
};

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("setElectiveAlternatives — alternativ qo'shish", () => {
  test(`${MAX_ALTERNATIVES} ta alternativ saqlanadi, identifikatsiya SERVERDA to'ladi`, async () => {
    const { plan, studyPlan } = arrange();

    const result = await call();

    expect(plan._row.alternatives).toHaveLength(MAX_ALTERNATIVES);
    expect(plan._row.alternatives[0]).toEqual({
      science: ALT1,
      code: "TF201",
      title: "Tibbiyot tarixi",
      department: DEPT1,
    });
    expect(plan._row.alternatives[1].code).toBe("TF202");
    expect(plan._row.alternatives[1].department).toBe(DEPT2);
    expect(studyPlan._row.alternatives).toHaveLength(MAX_ALTERNATIVES);
    expect(studyPlan.save).toHaveBeenCalledTimes(1);
    expect(plan.markModified).toHaveBeenCalledWith("semesters");
    expect(result.persisted).toBe(true);
    expect(result.updatedRows).toBe(1);
  });

  test("bitta alternativ ham qabul qilinadi", async () => {
    const { plan } = arrange();

    await call({ alternatives: [{ scienceId: ALT1 }] });

    expect(plan._row.alternatives).toHaveLength(1);
  });

  test("bo'sh massiv = hamma alternativ olib tashlanadi (qonuniy amal)", async () => {
    const plan = makePlan({
      row: { alternatives: [{ science: ALT1, code: "TF201" }] },
    });
    const { studyPlan } = arrange({ plan });

    const result = await call({ alternatives: [] });

    expect(plan._row.alternatives).toEqual([]);
    expect(studyPlan._row.alternatives).toEqual([]);
    expect(result.persisted).toBe(true);
  });

  test("SLOT tegilmaydi — fan, kafedra, kredit, soat, particle o'zgarmaydi", async () => {
    const { plan } = arrange();

    await call();

    expect(plan._row.science).toBe(MAIN_SCI);
    expect(plan._row.department).toBe(MAIN_DEPT);
    expect(plan._row.code).toBe("TF101");
    expect(plan._row.title).toBe("Asosiy tanlov fani");
    expect(plan._row.totalCredit).toBe(3);
    expect(plan._row.weeklyHours).toBe(2);
    expect(plan._row.particle[0].value).toBe(90);
  });

  test("katalog `$in` so'rovlari bilan o'qiladi (N+1 YO'Q): belgi + identifikatsiya", async () => {
    const { find } = arrange();

    await call();

    expect(find).toHaveBeenCalledTimes(2);
    expect(find).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ _id: { $in: [ALT1, ALT2] }, isElective: { $ne: true } }),
    );
    expect(find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        _id: { $in: [ALT1, ALT2] },
        active: true,
      }),
    );
  });

  test("javobda alternativlar string ko'rinishida qaytadi", async () => {
    arrange();

    const result = await call();

    expect(result.alternatives).toEqual([
      { science: ALT1, code: "TF201", title: "Tibbiyot tarixi", department: DEPT1 },
      { science: ALT2, code: "TF202", title: "Bioetika asoslari", department: DEPT2 },
    ]);
  });
});

describe("setElectiveAlternatives — rad etish shartlari", () => {
  test(`MAX_ALTERNATIVES (${MAX_ALTERNATIVES}) dan ortiq → 400, YOZUV yo'q`, async () => {
    const { plan, studyPlan } = arrange();

    const items = Array.from(
      { length: MAX_ALTERNATIVES + 1 },
      (_, i) => ({ scienceId: [ALT1, ALT2, ALT3][i] || ALT1 }),
    );
    await expectReject(call({ alternatives: items }), 400);

    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test("MAJBURIY blokda rad etiladi (majburiy fanning alternativi yo'q)", async () => {
    const plan = makePlan({
      block: { title: "Majburiy fanlar", blockCode: "MFI" },
    });
    const { studyPlan } = arrange({ plan });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("tanlov");
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test.each(["in_review", "approved"])(
    "%s (isLocked) holatida rad etiladi va YOZUV bo'lmaydi",
    async (status) => {
      const { plan, studyPlan } = arrange({ status });

      const err = await expectReject(call(), 400);
      expect(err.message).toContain(status);
      expect(plan.save).not.toHaveBeenCalled();
      expect(studyPlan.save).not.toHaveBeenCalled();
    },
  );

  test("asosiy fanning O'ZI alternativ sifatida → 400", async () => {
    const { plan } = arrange();

    const err = await expectReject(
      call({ alternatives: [{ scienceId: MAIN_SCI }] }),
      400,
    );
    expect(err.message).toContain("Asosiy fan");
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("takroriy alternativ → 400", async () => {
    const { plan } = arrange();

    const err = await expectReject(
      call({ alternatives: [{ scienceId: ALT1 }, { scienceId: ALT1 }] }),
      400,
    );
    expect(err.message).toContain("takrorlan");
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("katalogda yo'q `scienceId` → 400 + aniq xabar (jim tashlanmaydi)", async () => {
    const { plan } = arrange();

    const err = await expectReject(
      call({ alternatives: [{ scienceId: ALT1 }, { scienceId: YOQ_SCI }] }),
      400,
    );
    expect(err.message).toContain("katalogda topilmadi");
    expect(err.detail).toContain(YOQ_SCI);
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("buzuq `scienceId` ham xom CastError emas, aniq 400 beradi", async () => {
    arrange();

    const err = await expectReject(
      call({ alternatives: [{ scienceId: "buzuq-id" }] }),
      400,
    );
    expect(err.message).toContain("katalogda topilmadi");
  });

  test("ADR-042: yangi alternativ belgilanmagan → 400, YOZUV yo'q", async () => {
    const { plan, studyPlan } = arrange();
    const err = await expectReject(call({ alternatives: [{ scienceId: ALT_OLD }] }), 400);
    expect(err.message).toMatch(/Tanlov fani/);
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test("ADR-042: eski belgisiz alternativ qoladi, boshqasi o'chiriladi → saqlanadi", async () => {
    const { plan, find } = arrange({
      plan: makePlan({
        row: {
          alternatives: [
            { science: ALT_OLD, code: "TF209", title: "Eski alternativ" },
            { science: ALT1, code: "TF201", title: "Tibbiyot tarixi" },
          ],
        },
      }),
    });

    await call({ alternatives: [{ scienceId: ALT_OLD }] });

    expect(plan.save).toHaveBeenCalled();
    expect(plan._row.alternatives.map((a) => String(a.science))).toEqual([ALT_OLD]);
    expect(find).toHaveBeenCalledTimes(1);
  });

  test("fan qatori topilmasa → 404", async () => {
    arrange();
    await expectReject(call({ scienceRowId: YOQ_SCI }), 404);
  });

  test("workingPlan.studyPlan === null → 400 (manbaga yozib bo'lmaydi)", async () => {
    const plan = makePlan({ studyPlan: null });
    arrange({ plan });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("bog'lanmagan");
    expect(plan.save).not.toHaveBeenCalled();
    expect(StudyPlanModel.findById).not.toHaveBeenCalled();
  });

  test("manba studyPlan topilmasa → 404, ishchi reja YOZILMAYDI", async () => {
    const { plan } = arrange({ studyPlan: null });

    await expectReject(call(), 404);
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("manba studyPlan'da mos tanlov qatori yo'q → 404, YOZUV yo'q", async () => {
    const studyPlan = makeStudyPlan({
      block: { title: "Majburiy fanlar", blockCode: "TF2" },
    });
    const { plan } = arrange({ studyPlan });

    const err = await expectReject(call(), 404);
    expect(err.message).toContain("Manba o'quv rejada");
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("doiradan tashqari ishchi reja → 404 (mavjudligi oshkor qilinmaydi)", async () => {
    const findOne = jest
      .spyOn(WorkingPlanModel, "findOne")
      .mockResolvedValue(null);

    await expectReject(
      call({ scope: { workingSchedule: { $in: ["ws-1"] } } }),
      404,
    );
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ workingSchedule: { $in: ["ws-1"] } }),
    );
  });
});

describe("setElectiveAlternatives — manba studyPlan ga yozish", () => {
  test("manba qatoriga MUSTAQIL nusxa yoziladi (ikki hujjat bitta massivni ulashmaydi)", async () => {
    const { plan, studyPlan } = arrange();

    await call();

    expect(studyPlan._row.alternatives).toEqual(plan._row.alternatives);
    expect(studyPlan._row.alternatives).not.toBe(plan._row.alternatives);
  });

  test("studyPlan yozuvi yiqilsa — `persisted: false` (JIM muvaffaqiyat YO'Q)", async () => {
    const studyPlan = makeStudyPlan();
    studyPlan.save = jest.fn().mockRejectedValue(new Error("disk to'lgan"));
    const { plan } = arrange({ studyPlan });

    const result = await call();

    expect(plan.save).toHaveBeenCalledTimes(1);
    expect(result.persisted).toBe(false);
    expect(result.persistError).toContain("disk");
  });

  test("yozuv tartibi: avval ishchi reja, keyin manba", async () => {
    const order = [];
    const plan = makePlan();
    plan.save = jest.fn().mockImplementation(() => {
      order.push("workingPlan");
      return Promise.resolve();
    });
    const studyPlan = makeStudyPlan();
    studyPlan.save = jest.fn().mockImplementation(() => {
      order.push("studyPlan");
      return Promise.resolve();
    });
    arrange({ plan, studyPlan });

    await call();

    expect(order).toEqual(["workingPlan", "studyPlan"]);
  });
});

describe("setElectiveAlternatives — yig'indilarga ta'sir NOL", () => {
  const snapshot = (sem) =>
    JSON.parse(
      JSON.stringify({
        blocksTotal: sem.blocksTotal,
        grandTotal: sem.grandTotal,
      }),
    );

  test("blocksTotal / grandTotal alternativ qo'shilgandan keyin AYNAN bir xil", async () => {
    const { plan } = arrange();

    computeSemesterTotals(plan._sem);
    const before = snapshot(plan._sem);

    await call();

    computeSemesterTotals(plan._sem);
    expect(snapshot(plan._sem)).toEqual(before);
  });

  test("alternativ olib tashlanganda ham yig'indi o'zgarmaydi", async () => {
    const plan = makePlan({
      row: {
        alternatives: [{ science: ALT1, code: "TF201", title: "x", department: DEPT1 }],
      },
    });
    arrange({ plan });

    computeSemesterTotals(plan._sem);
    const before = snapshot(plan._sem);

    await call({ alternatives: [] });

    computeSemesterTotals(plan._sem);
    expect(snapshot(plan._sem)).toEqual(before);
  });
});

describe("workingPlan.validation — setElectiveAlternativesSchema", () => {
  const validBase = {
    semKey: "1",
    blockId: BLOCK_ID,
    scienceRowId: ROW_ID,
    alternatives: [{ scienceId: ALT1 }],
  };

  test("to'g'ri payload qabul qilinadi", () => {
    expect(setElectiveAlternativesSchema.validate(validBase).error).toBeUndefined();
  });

  test("bo'sh massiv qabul qilinadi (olib tashlash)", () => {
    expect(
      setElectiveAlternativesSchema.validate({ ...validBase, alternatives: [] })
        .error,
    ).toBeUndefined();
  });

  test(`${MAX_ALTERNATIVES} ta qabul, ${MAX_ALTERNATIVES + 1} ta RAD etiladi`, () => {
    const items = (n) => Array.from({ length: n }, () => ({ scienceId: ALT1 }));
    expect(
      setElectiveAlternativesSchema.validate({
        ...validBase,
        alternatives: items(MAX_ALTERNATIVES),
      }).error,
    ).toBeUndefined();
    expect(
      setElectiveAlternativesSchema.validate({
        ...validBase,
        alternatives: items(MAX_ALTERNATIVES + 1),
      }).error,
    ).toBeDefined();
  });

  test("`alternatives` MAJBURIY — kalit yuborilmasa RAD etiladi", () => {
    const { alternatives, ...rest } = validBase;
    expect(alternatives).toBeDefined();
    expect(setElectiveAlternativesSchema.validate(rest).error).toBeDefined();
  });

  test.each(["semKey", "blockId", "scienceRowId"])(
    "`%s` majburiy",
    (key) => {
      const payload = { ...validBase };
      delete payload[key];
      expect(setElectiveAlternativesSchema.validate(payload).error).toBeDefined();
    },
  );

  test.each(["code", "title", "department", "science", "totalCredit"])(
    "element ichida `%s` klientdan RAD etiladi (serverda katalogdan)",
    (field) => {
      const { error } = setElectiveAlternativesSchema.validate({
        ...validBase,
        alternatives: [{ scienceId: ALT1, [field]: "buzg'unchi qiymat" }],
      });
      expect(error).toBeDefined();
    },
  );

  test("noma'lum top-level kalit RAD etiladi", () => {
    expect(
      setElectiveAlternativesSchema.validate({ ...validBase, parentId: BLOCK_ID })
        .error,
    ).toBeDefined();
  });
});
