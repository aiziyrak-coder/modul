const WorkingPlanModel = require("./workingPlan.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const ScienceModel = require("#references/science/science.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");

const service = require("./workingPlan.service");
const {
  swapElectiveScienceSchema,
  electiveUsageQuerySchema,
} = require("./workingPlan.validation");

const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaa01";
const SIBLING_ID = "aaaaaaaaaaaaaaaaaaaaaa02";
const WS_ID = "bbbbbbbbbbbbbbbbbbbbbb01";
const SP_ID = "cccccccccccccccccccccc01";
const BLOCK_ID = "111111111111111111111101";
const ROW_ID = "222222222222222222222201";
const OLD_SCI = "333333333333333333333301";
const NEW_SCI = "444444444444444444444401";
const OLD_DEPT = "555555555555555555555501";
const NEW_DEPT = "666666666666666666666601";
const YEAR_ID = "777777777777777777777701";

const makeRow = (over = {}) => ({
  _id: ROW_ID,
  serialNumber: "2.01",
  code: "F-01",
  title: "Eski tanlov fani",
  science: OLD_SCI,
  department: OLD_DEPT,
  totalCredit: 6,
  weeklyHours: 4,
  particle: [{ slug: "maruza", value: 30 }],
  ...over,
});

const makePlan = (over = {}) => {
  const row = makeRow(over.row);
  const block = {
    _id: BLOCK_ID,
    blockCode: "TF2",
    title: "Tanlov fanlari",
    sciences: [row, ...(over.extraRows || [])],
    ...(over.block || {}),
  };
  return {
    _id: PLAN_ID,
    studyPlan: over.studyPlan === undefined ? SP_ID : over.studyPlan,
    workingSchedule: WS_ID,
    semesters: new Map([["1", { semester: "1", blocks: [block] }]]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    _row: row,
    _block: block,
  };
};

const makeSibling = () => {
  const row = makeRow({ _id: "222222222222222222222202" });
  const block = {
    _id: "111111111111111111111102",
    blockCode: "TF2",
    title: "Tanlov fanlari",
    sciences: [row],
  };
  return {
    _id: SIBLING_ID,
    studyPlan: SP_ID,
    semesters: new Map([["2", { semester: "2", blocks: [block] }]]),
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
    _row: row,
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

const TARGET = {
  _id: NEW_SCI,
  title: "Yangi tanlov fani",
  scienceCode: "F-99",
  department: NEW_DEPT,
  active: true,
  isElective: true,
};

const mockSelectLean = (value) => ({
  select: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue(value),
  }),
});
const mockLean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

const mockDownstream = (counts = {}) => {
  const pairs = [
    [ScienceProgramModel, counts.scienceProgram],
    [SyllabusModel, counts.syllabus],
    [WorkloadModel, counts.workload],
    [WorkloadDistributionModel, counts.workloadDistribution],
  ];
  for (const [Model, c] of pairs) {
    const total = c?.total || 0;
    const signed = c?.signed || 0;
    jest
      .spyOn(Model, "countDocuments")
      .mockImplementation((filter) =>
        Promise.resolve(filter && filter.status ? signed : total),
      );
  }
};

const arrangeHappyPath = (opts = {}) => {
  const plan = opts.plan || makePlan();
  const studyPlan = opts.studyPlan || makeStudyPlan();
  const siblings = opts.siblings || [];

  jest.spyOn(WorkingPlanModel, "findOne").mockResolvedValue(plan);
  jest.spyOn(WorkingPlanModel, "find").mockResolvedValue(siblings);
  jest
    .spyOn(WorkingScheduleModel, "findById")
    .mockReturnValue(
      mockSelectLean({ status: opts.status || "draft", academicYear: YEAR_ID }),
    );
  jest
    .spyOn(ScienceModel, "findOne")
    .mockReturnValue(mockLean(opts.target === undefined ? TARGET : opts.target));
  jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(studyPlan);
  mockDownstream(opts.counts);

  return { plan, studyPlan, siblings };
};

const call = (over = {}) =>
  service.swapElectiveScience({
    planId: PLAN_ID,
    semKey: "1",
    blockId: BLOCK_ID,
    scienceRowId: ROW_ID,
    scienceId: NEW_SCI,
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

describe("swapElectiveScience — ruxsat shartlari", () => {
  test("tanlov blokida almashtiradi va identifikatsiyani SERVERDA to'ldiradi", async () => {
    const { plan, studyPlan } = arrangeHappyPath();

    const result = await call();

    expect(plan._row.science).toBe(NEW_SCI);
    expect(plan._row.department).toBe(NEW_DEPT);
    expect(plan._row.code).toBe("F-99");
    expect(plan._row.title).toBe("Yangi tanlov fani");
    expect(studyPlan._row.science).toBe(NEW_SCI);
    expect(studyPlan.save).toHaveBeenCalledTimes(1);
    expect(result.persisted).toBe(true);
    expect(result.updatedRows).toBe(1);
  });

  test("soat / kredit / particle / serialNumber TEGILMAYDI (ADR-010 kuchda)", async () => {
    const { plan } = arrangeHappyPath();

    await call();

    expect(plan._row.totalCredit).toBe(6);
    expect(plan._row.weeklyHours).toBe(4);
    expect(plan._row.serialNumber).toBe("2.01");
    expect(plan._row.particle).toEqual([{ slug: "maruza", value: 30 }]);
  });

  test("MAJBURIY blokda rad etiladi (faqat tanlov qamrovda)", async () => {
    const plan = makePlan({ block: { title: "Majburiy fanlar", blockCode: "MFI" } });
    const { studyPlan } = arrangeHappyPath({ plan });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("tanlov");
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test.each(["in_review", "approved"])(
    "%s (isLocked) holatida rad etiladi va YOZUV bo'lmaydi",
    async (status) => {
      const { plan, studyPlan } = arrangeHappyPath({ status });

      const err = await expectReject(call(), 400);
      expect(err.message).toContain(status);
      expect(plan.save).not.toHaveBeenCalled();
      expect(studyPlan.save).not.toHaveBeenCalled();
    },
  );

  test("workingPlan.studyPlan === null → RAD ETILADI (taxmin yo'q)", async () => {
    const plan = makePlan({ studyPlan: null });
    arrangeHappyPath({ plan });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("bog'lanmagan");
    expect(plan.save).not.toHaveBeenCalled();
    expect(StudyPlanModel.findById).not.toHaveBeenCalled();
  });

  test("dublikat fan (shu blokda allaqachon bor) → rad etiladi", async () => {
    const plan = makePlan({
      extraRows: [makeRow({ _id: "222222222222222222222299", science: NEW_SCI })],
    });
    const { studyPlan } = arrangeHappyPath({ plan });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("allaqachon");
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test("katalogda yo'q / faol bo'lmagan fan → 404", async () => {
    arrangeHappyPath({ target: null });
    await expectReject(call(), 404);
  });

  test("ADR-042: «Tanlov fani» deb belgilanmagan fan → 400, HECH NARSA yozilmaydi", async () => {
    const { plan, studyPlan } = arrangeHappyPath({ target: { ...TARGET, isElective: false } });
    const err = await expectReject(call(), 400);
    expect(err.message).toMatch(/Tanlov fani/);
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test("doiradan tashqari ishchi reja → 404 (mavjudligi oshkor qilinmaydi)", async () => {
    const findOne = jest
      .spyOn(WorkingPlanModel, "findOne")
      .mockResolvedValue(null);

    await expectReject(call({ scope: { workingSchedule: { $in: ["ws-1"] } } }), 404);
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ workingSchedule: { $in: ["ws-1"] } }),
    );
  });
});

describe("swapElectiveScience — downstream qo'riqchisi (invariant #7)", () => {
  test("imzolangan downstream bor → 400 + ro'yxat, YOZUV bo'lmaydi", async () => {
    const { plan, studyPlan } = arrangeHappyPath({
      counts: {
        scienceProgram: { total: 3, signed: 2 },
        syllabus: { total: 1, signed: 1 },
      },
    });

    const err = await expectReject(call(), 400);
    expect(err.message).toContain("imzolangan");
    expect(err.detail).toContain("scienceProgram: 2 ta");
    expect(err.detail).toContain("syllabus: 1 ta");
    expect(plan.save).not.toHaveBeenCalled();
    expect(studyPlan.save).not.toHaveBeenCalled();
  });

  test("imzolanmagan downstream (faqat draft) BLOKLAMAYDI", async () => {
    const { plan } = arrangeHappyPath({
      counts: { scienceProgram: { total: 4, signed: 0 } },
    });

    const result = await call();

    expect(plan.save).toHaveBeenCalledTimes(1);
    expect(result.usage.scienceProgram.total).toBe(4);
    expect(result.usage.signedTotal).toBe(0);
  });
});

describe("swapElectiveScience — yozuv tartibi va qamrov", () => {
  test("qardosh ishchi rejalar ham yangilanadi (invariant #6)", async () => {
    const sibling = makeSibling();
    const { plan } = arrangeHappyPath({ siblings: [sibling] });

    const result = await call();

    expect(sibling._row.science).toBe(NEW_SCI);
    expect(sibling._row.department).toBe(NEW_DEPT);
    expect(sibling.markModified).toHaveBeenCalledWith("semesters");
    expect(sibling.save).toHaveBeenCalledTimes(1);
    expect(result.updatedPlans).toBe(2);
    expect(result.updatedRows).toBe(2);
    expect(WorkingPlanModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ studyPlan: SP_ID, _id: { $ne: plan._id } }),
    );
  });

  test("studyPlan yozuvi yiqilsa — javobda `persisted: false` (jim 200 EMAS)", async () => {
    const studyPlan = makeStudyPlan();
    studyPlan.save = jest.fn().mockRejectedValue(new Error("disk to'lgan"));
    const { plan } = arrangeHappyPath({ studyPlan });

    const result = await call();

    expect(plan.save).toHaveBeenCalledTimes(1);
    expect(result.persisted).toBe(false);
    expect(result.persistError).toContain("disk");
  });

  test("qardosh yozuvi yiqilsa — JIM o'tmaydi, `siblingErrors` da qaytadi", async () => {
    const sibling = makeSibling();
    sibling.save = jest.fn().mockRejectedValue(new Error("qardosh yiqildi"));
    arrangeHappyPath({ siblings: [sibling] });

    const result = await call();

    expect(result.siblingErrors).toHaveLength(1);
    expect(result.siblingErrors[0].workingPlan).toBe(SIBLING_ID);
    expect(result.siblingErrors[0].error).toContain("qardosh yiqildi");
    expect(result.updatedPlans).toBe(1);
    expect(result.persisted).toBe(true);
  });

  test("ayni fan qayta tanlansa (no-op) → 400", async () => {
    arrangeHappyPath({ plan: makePlan({ row: { science: NEW_SCI } }) });
    await expectReject(call(), 400);
  });

  test("manba studyPlan topilmasa → 404", async () => {
    arrangeHappyPath();
    jest.spyOn(StudyPlanModel, "findById").mockResolvedValue(null);
    await expectReject(call(), 404);
  });

  test("manba studyPlan'da mos tanlov qatori yo'q → 404, hech narsa yozilmaydi", async () => {
    const studyPlan = makeStudyPlan({
      block: { title: "Majburiy fanlar", blockCode: "TF2" },
    });
    const { plan } = arrangeHappyPath({ studyPlan });

    const err = await expectReject(call(), 404);
    expect(err.message).toContain("Manba o'quv rejada");
    expect(plan.save).not.toHaveBeenCalled();
  });

  test("fan qatori topilmasa → 404 (jim 200 emas)", async () => {
    arrangeHappyPath();
    await expectReject(call({ scienceRowId: "999999999999999999999999" }), 404);
  });
});

describe("getElectiveRowUsage — READ-ONLY sanoq endpointi (invariant #7)", () => {
  const leanPlan = (over = {}) => {
    const row = makeRow();
    const block = {
      _id: BLOCK_ID,
      blockCode: "TF2",
      title: "Tanlov fanlari",
      sciences: [row],
      ...(over.block || {}),
    };
    return {
      _id: PLAN_ID,
      studyPlan: over.studyPlan === undefined ? SP_ID : over.studyPlan,
      workingSchedule: WS_ID,
      semesters: { 1: { semester: "1", blocks: [block] } },
    };
  };

  const arrangeUsage = (opts = {}) => {
    jest
      .spyOn(WorkingPlanModel, "findOne")
      .mockReturnValue(mockSelectLean(opts.plan || leanPlan()));
    jest
      .spyOn(WorkingPlanModel, "find")
      .mockReturnValue(mockSelectLean(opts.siblings || []));
    jest
      .spyOn(WorkingScheduleModel, "findById")
      .mockReturnValue(
        mockSelectLean({ status: opts.status || "draft", academicYear: YEAR_ID }),
      );
    mockDownstream(opts.counts);
  };

  const callUsage = (over = {}) =>
    service.getElectiveRowUsage({
      planId: PLAN_ID,
      semKey: "1",
      blockId: BLOCK_ID,
      scienceRowId: ROW_ID,
      scope: {},
      ...over,
    });

  test("sanoq + qamrov qaytadi, HECH NARSA yozilmaydi", async () => {
    const siblingWith = { _id: SIBLING_ID, semesters: leanPlan().semesters };
    const siblingWithout = {
      _id: "aaaaaaaaaaaaaaaaaaaaaa03",
      semesters: leanPlan({ block: { sciences: [makeRow({ science: NEW_SCI, code: "F-99" })] } }).semesters,
    };
    arrangeUsage({
      counts: { scienceProgram: { total: 2, signed: 0 } },
      siblings: [siblingWith, siblingWithout],
    });
    const saveSpy = jest.spyOn(WorkingPlanModel, "updateOne");

    const data = await callUsage();

    expect(data.usage.scienceProgram.total).toBe(2);
    expect(data.affectedWorkingPlans).toBe(2);
    expect(data.lockedWorkingPlans).toBe(0);
    expect(data.elective).toBe(true);
    expect(data.locked).toBe(false);
    expect(data.canSwap).toBe(true);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  test("imzolangan hujjat bor → canSwap=false", async () => {
    arrangeUsage({ counts: { syllabus: { total: 2, signed: 1 } } });

    const data = await callUsage();

    expect(data.usage.signedTotal).toBe(1);
    expect(data.canSwap).toBe(false);
  });

  test("qulflangan (approved) ota hujjat → locked=true, canSwap=false", async () => {
    arrangeUsage({ status: "approved" });

    const data = await callUsage();

    expect(data.locked).toBe(true);
    expect(data.canSwap).toBe(false);
  });

  test("majburiy blok → elective=false, canSwap=false", async () => {
    arrangeUsage({
      plan: leanPlan({ block: { title: "Majburiy fanlar", blockCode: "MFI" } }),
    });

    const data = await callUsage();

    expect(data.elective).toBe(false);
    expect(data.canSwap).toBe(false);
  });

  test("studyPlan ko'rsatkichi null → canSwap=false (almashtirish mumkin emas)", async () => {
    arrangeUsage({ plan: leanPlan({ studyPlan: null }) });

    const data = await callUsage();

    expect(data.studyPlan).toBeNull();
    expect(data.canSwap).toBe(false);
    expect(data.affectedWorkingPlans).toBe(0);
  });

  test("doiradan tashqari → 404", async () => {
    jest.spyOn(WorkingPlanModel, "findOne").mockReturnValue(mockSelectLean(null));
    await expectReject(callUsage(), 404);
  });
});

describe("countScienceUsage — downstream yo'llari", () => {
  test("fan refi yo'q (null) → 0, DB umuman so'ralmaydi", async () => {
    mockDownstream({ scienceProgram: { total: 5, signed: 5 } });

    const usage = await service.countScienceUsage({ science: null });

    expect(usage.signedTotal).toBe(0);
    expect(usage.total).toBe(0);
    expect(ScienceProgramModel.countDocuments).not.toHaveBeenCalled();
  });

  test("workload / workloadDistribution AYNIQ nested yo'l bilan sanaladi", async () => {
    mockDownstream({
      workload: { total: 2, signed: 1 },
      workloadDistribution: { total: 3, signed: 0 },
    });

    const usage = await service.countScienceUsage({
      science: OLD_SCI,
      academicYear: YEAR_ID,
    });

    expect(WorkloadModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        "directions.blocks.science": OLD_SCI,
        academicYear: YEAR_ID,
      }),
    );
    expect(WorkloadDistributionModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        "teachers.blocks.science": OLD_SCI,
        academicYear: YEAR_ID,
      }),
    );
    expect(usage.workload).toEqual({ total: 2, signed: 1 });
    expect(usage.signed).toEqual([{ collection: "workload", count: 1 }]);
  });

  test("imzolangan sanoq FAQAT in_review/approved/superseded bo'yicha", async () => {
    mockDownstream({ syllabus: { total: 9, signed: 4 } });

    await service.countScienceUsage({ science: OLD_SCI });

    expect(SyllabusModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: ["in_review", "approved", "superseded"] },
      }),
    );
  });

  test("direction berilsa — syllabus/fan dasturi `directions`, yuklama $elemMatch bo'yicha", async () => {
    mockDownstream({});

    await service.countScienceUsage({
      science: OLD_SCI,
      academicYear: YEAR_ID,
      year: 2027,
      direction: "dir-1",
    });

    expect(SyllabusModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ science: OLD_SCI, year: 2027, directions: "dir-1" }),
    );
    expect(ScienceProgramModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ science: OLD_SCI, academicYear: YEAR_ID, directions: "dir-1" }),
    );
    expect(WorkloadModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        directions: { $elemMatch: { direction: "dir-1", "blocks.science": OLD_SCI } },
        academicYear: YEAR_ID,
      }),
    );
  });
});

describe("workingPlan.validation — swapElectiveScienceSchema (invariant #3)", () => {
  const validBase = {
    semKey: "1",
    parentId: BLOCK_ID,
    _id: ROW_ID,
    scienceId: NEW_SCI,
  };

  test("to'g'ri payload (faqat scienceId) qabul qilinadi", () => {
    expect(swapElectiveScienceSchema.validate(validBase).error).toBeUndefined();
  });

  test.each(["department", "science", "code", "title", "totalCredit", "weeklyHours"])(
    "klient `%s` yuborsa — RAD etiladi (server hosil qiladi)",
    (field) => {
      const payload = { ...validBase, [field]: "buzg'unchi qiymat" };
      expect(swapElectiveScienceSchema.validate(payload).error).toBeDefined();
    },
  );

  test("scienceId majburiy", () => {
    const { scienceId, ...rest } = validBase;
    expect(scienceId).toBeDefined();
    expect(swapElectiveScienceSchema.validate(rest).error).toBeDefined();
  });

  test("usage query: semKey/parentId/_id majburiy, year ixtiyoriy", () => {
    expect(
      electiveUsageQuerySchema.validate({
        semKey: "1",
        parentId: BLOCK_ID,
        _id: ROW_ID,
      }).error,
    ).toBeUndefined();
    expect(
      electiveUsageQuerySchema.validate({ semKey: "1" }).error,
    ).toBeDefined();
  });
});
