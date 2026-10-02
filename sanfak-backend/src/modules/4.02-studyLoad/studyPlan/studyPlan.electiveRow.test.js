jest.mock("./studyPlan.model", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
}));
jest.mock("./studyPlan.electivePropagation", () => ({
  propagateElectiveRow: jest.fn().mockResolvedValue({ propagated: 0, skippedLocked: 0 }),
  retractElectiveRow: jest.fn().mockResolvedValue({ retracted: 0, skippedLocked: 0 }),
  relevantDerivedSchedules: jest
    .fn()
    .mockResolvedValue([{ _id: "ws1", status: "draft", currentCourse: 1, academicYear: null, year: "2025", direction: null }]),
  electiveWarning: jest.fn().mockReturnValue(null),
}));
jest.mock("./studyPlan.derivationGuard", () => ({
  countDerivedWorkingPlans: jest.fn().mockResolvedValue(0),
}));
jest.mock("#references/science/science.model", () => ({
  findById: jest.fn(),
  find: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.service", () => ({
  countScienceUsage: jest.fn().mockResolvedValue({ signedTotal: 0 }),
}));
jest.mock("#references/_services/educationActivityResolver", () => ({
  resolveOrCreate: jest.fn().mockResolvedValue(null),
}));

const StudyPlanModel = require("./studyPlan.model");
const ScienceModel = require("#references/science/science.model");
const {
  countScienceUsage,
} = require("#modules/4.02-studyLoad/workingPlan/workingPlan.service");
const service = require("./studyPlan.service");

const SCOPE = { learningProcess: { $in: ["lp1"] } };
const PLAN_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SCIENCE_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const DEPT_ID = "cccccccccccccccccccccccc";

const mockCatalog = (value) =>
  ScienceModel.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(value) }),
  });

const mockPlan = (value) =>
  StudyPlanModel.findOne.mockReturnValue({
    lean: () => Promise.resolve(value),
  });

const mockUpdate = (value) => {
  const spy = jest.fn().mockReturnValue({ lean: () => Promise.resolve(value) });
  StudyPlanModel.findOneAndUpdate = spy;
  return spy;
};

const buildPlan = (sciences) => ({
  _id: PLAN_ID,
  blocks: [
    {
      blockCode: "TF2",
      title: "Tanlov fanlar",
      semesters: { 3: { hour: 6, credit: 4 } },
      sciences,
    },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
  countScienceUsage.mockResolvedValue({ signedTotal: 0 });
});

describe("addElectiveRow", () => {
  test("kvota 0 bo'lgan semestrga qo'shish — 400 (invariant #3)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    mockPlan(buildPlan([]));

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "9", hour: 2, credit: 2 }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(StudyPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("kvotadan oshib ketsa — 400 + qoldiq (invariant #4)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    mockPlan(buildPlan([]));

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 10, credit: 4 }],
        },
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      detail: expect.stringContaining("qoldiq"),
    });
  });

  test("bir xil fan blokda ikkinchi marta — 409 (blokda fan yagona)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    mockPlan(
      buildPlan([{ _id: "row0", science: SCIENCE_ID, code: "FA1001", title: "Gigiyena", semesters: { 3: { hour: 2, credit: 2 } } }]),
    );

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 1, credit: 1 }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("qator YIG'INDI qatoridan OLDIN qo'shiladi — $push + $position (invariant #6)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    const existingRow = {
      _id: "row0",
      science: "dddddddddddddddddddddddd",
      code: "FA9999",
      title: "Boshqa fan",
      semesters: { 3: { hour: 2, credit: 2 } },
    };
    const aggregateRow = { code: "", title: "Jami" };
    mockPlan(buildPlan([existingRow, aggregateRow]));
    const newRow = {
      _id: "newRow",
      science: SCIENCE_ID,
      code: "FA1001",
      title: "Gigiyena",
      semesters: { 3: { hour: 3, credit: 2 } },
    };
    const updateSpy = mockUpdate(buildPlan([existingRow, newRow, aggregateRow]));

    const result = await service.addElectiveRow({
      id: PLAN_ID,
      scope: SCOPE,
      body: {
        blockCode: "TF2",
        science: SCIENCE_ID,
        semesters: [{ semester: "3", hour: 3, credit: 2 }],
      },
    });

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [filter, update, opts] = updateSpy.mock.calls[0];
    expect(filter).toMatchObject({ _id: PLAN_ID, "blocks.blockCode": "TF2" });
    const push = update.$push["blocks.$[block].sciences"];
    expect(push.$position).toBe(1);
    expect(push.$each).toHaveLength(1);
    expect(opts.arrayFilters).toEqual([{ "block.blockCode": "TF2" }]);

    expect(push.$each[0]).toMatchObject({
      science: SCIENCE_ID,
      department: DEPT_ID,
      code: "FA1001",
      title: "Gigiyena",
    });
    expect(result.quota["3"]).toEqual({ hour: 1, credit: 0 });
  });

  test("YOZUV faqat findOneAndUpdate orqali — create/save chaqirilmaydi (invariant #7)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    mockPlan(buildPlan([]));
    mockUpdate(buildPlan([{}]));

    await service.addElectiveRow({
      id: PLAN_ID,
      scope: SCOPE,
      body: {
        blockCode: "TF2",
        science: SCIENCE_ID,
        semesters: [{ semester: "3", hour: 2, credit: 2 }],
      },
    });

    expect(StudyPlanModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(StudyPlanModel.create).not.toHaveBeenCalled();
  });

  test("ADR-042: katalogda «Tanlov fani» deb belgilanmagan fan — 400, YOZUV yo'q", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true });

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 2, credit: 2 }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Tanlov fani/) });

    expect(StudyPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("ADR-042: alternativ belgilanmagan bo'lsa — 400, YOZUV yo'q", async () => {
    const ALT_ID = "dddddddddddddddddddddddd";
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    ScienceModel.find.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([{ _id: ALT_ID, scienceCode: "FB2", title: "Ekologiya" }]) }),
    });

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 2, credit: 2 }],
          alternatives: [{ scienceId: ALT_ID }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/Tanlov fani/) });

    expect(ScienceModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ _id: { $in: [ALT_ID] }, isElective: { $ne: true } }),
    );
    expect(StudyPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("katalogda topilmagan fan — 404", async () => {
    mockCatalog(null);

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "TF2",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 2, credit: 2 }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("majburiy blokka qo'shish — 400 (bu blok tanlov bloki emas)", async () => {
    mockCatalog({ _id: SCIENCE_ID, scienceCode: "FA1001", title: "Gigiyena", department: DEPT_ID, active: true, isElective: true });
    mockPlan({
      _id: PLAN_ID,
      blocks: [{ blockCode: "MFI", title: "Majburiy fanlar", semesters: { 3: { hour: 6, credit: 4 } }, sciences: [] }],
    });

    await expect(
      service.addElectiveRow({
        id: PLAN_ID,
        scope: SCOPE,
        body: {
          blockCode: "MFI",
          science: SCIENCE_ID,
          semesters: [{ semester: "3", hour: 2, credit: 2 }],
        },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("removeElectiveRow", () => {
  test("faqat tanlov blokidagi subject/electiveSlot qatori o'chadi", async () => {
    const row = {
      _id: "row1",
      science: SCIENCE_ID,
      code: "FA1001",
      title: "Gigiyena",
      semesters: { 3: { hour: 3, credit: 3 } },
    };
    mockPlan(buildPlan([row]));
    const updateSpy = mockUpdate(buildPlan([]));

    const result = await service.removeElectiveRow({
      id: PLAN_ID,
      rowId: "row1",
      scope: SCOPE,
    });

    expect(result.removed).toBe(true);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    const [, update] = updateSpy.mock.calls[0];
    expect(update.$pull["blocks.$[block].sciences"]).toEqual({ _id: "row1" });
  });

  test("yig'indi ('Jami') qatorini o'chirishga urinish — 400 (subject/electiveSlot emas)", async () => {
    const aggRow = { _id: "agg1", code: "", title: "Jami" };
    mockPlan(buildPlan([aggRow]));

    await expect(
      service.removeElectiveRow({ id: PLAN_ID, rowId: "agg1", scope: SCOPE }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(StudyPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("imzolangan downstream bor bo'lsa — 400, o'chirilmaydi", async () => {
    const row = { _id: "row1", science: SCIENCE_ID, code: "FA1001", title: "Gigiyena", semesters: { 3: { hour: 3, credit: 3 } } };
    mockPlan(buildPlan([row]));
    countScienceUsage.mockResolvedValueOnce({ signedTotal: 2 });

    await expect(
      service.removeElectiveRow({ id: PLAN_ID, rowId: "row1", scope: SCOPE }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(StudyPlanModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("qator topilmasa — 404", async () => {
    mockPlan(buildPlan([]));

    await expect(
      service.removeElectiveRow({ id: PLAN_ID, rowId: "yoq", scope: SCOPE }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
