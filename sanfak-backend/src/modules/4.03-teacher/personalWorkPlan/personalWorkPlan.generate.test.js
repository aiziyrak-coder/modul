jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#references/science/science.model");
jest.mock("#references/academicYear/academicYear.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const ScienceModel = require("#references/science/science.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const Controller = require("./personalWorkPlan.controller");

const TEACHER = "aaaaaaaaaaaaaaaaaaaaaaaa";
const AY = "bbbbbbbbbbbbbbbbbbbbbbbb";
const SCI_A = "cccccccccccccccccccccccc";
const SCI_B = "dddddddddddddddddddddddd";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockDistribution = (blocks) => {
  WorkloadDistribution.find = jest.fn().mockResolvedValue([
    {
      _id: "eeeeeeeeeeeeeeeeeeeeeeee",
      teachers: [
        {
          _id: "ffffffffffffffffffffffff",
          teacher: { toString: () => TEACHER },
          acceptanceStatus: "accepted",
          isVacant: false,
          stavka: 1.0,
          blocks,
        },
      ],
    },
  ]);
};

const block = ({ science, globalSemester, total = 150 }) => ({
  science,
  practiceTitle: null,
  course: 2,
  totalHour: total,
  studyWork: {
    semester: globalSemester,
    classTypes: [{ slug: "maruza", total: 60 }],
  },
});

const captureCreated = () => {
  const saved = [];
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(null);
  PersonalWorkPlanModel.mockImplementation((data) => {
    saved.push(data);
    return { ...data, _id: "planid", save: jest.fn().mockResolvedValue(undefined) };
  });
  return saved;
};

const generate = async () => {
  const res = createRes();
  await Controller.generateFromWorkload(
    { user: { _id: TEACHER }, body: { teacher: TEACHER, academicYear: AY } },
    res,
    jest.fn(),
  );
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("B-5 — fan nomi snapshot'i to'ldirilsin", () => {
  test("`practiceTitle` null bo'lsa, nom `science` ref'idan olinadi", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: 3 })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: SCI_A, title: "Kardiologiya" }]),
      }),
    });
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].scienceName).toBe("Kardiologiya");
  });

  test("bir nechta fan — bitta to'plamli so'rov (N+1 emas)", async () => {
    mockDistribution([
      block({ science: SCI_A, globalSemester: 3 }),
      block({ science: SCI_B, globalSemester: 4 }),
      block({ science: SCI_A, globalSemester: 4 }),
    ]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve([
            { _id: SCI_A, title: "Kardiologiya" },
            { _id: SCI_B, title: "Nefrologiya" },
          ]),
      }),
    });
    captureCreated();

    await generate();

    expect(ScienceModel.find).toHaveBeenCalledTimes(1);
    const askedIds = ScienceModel.find.mock.calls[0][0]._id.$in;
    expect(askedIds.sort()).toEqual([SCI_A, SCI_B].sort());
  });

  test("fan o'chirilgan bo'lsa — `null` (yiqilmaydi)", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: 3 })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].scienceName).toBeNull();
  });

  test("AMALIYOT bloki — `practiceTitle` ustun turadi (so'rov ham ketmaydi)", async () => {
    const practice = {
      ...block({ science: SCI_A, globalSemester: 3 }),
      practiceTitle: "Malakaviy amaliyot",
    };
    mockDistribution([practice]);
    ScienceModel.find = jest.fn();
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].scienceName).toBe(
      "Malakaviy amaliyot",
    );
    expect(ScienceModel.find).not.toHaveBeenCalled();
  });

  test("REGRESSION-GUARD: `scienceName` xom `practiceTitle` bo'lib qolmasin", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: 3 })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: SCI_A, title: "Kardiologiya" }]),
      }),
    });
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].scienceName).not.toBeNull();
  });
});

describe("B-6 — semestr GLOBAL dan KURS ICHIDAGI ga aylantirilsin", () => {
  test.each([
    [1, 1, "1-kurs, 1-semestr"],
    [2, 2, "1-kurs, 2-semestr"],
    [3, 1, "2-kurs, 1-semestr"],
    [4, 2, "2-kurs, 2-semestr  ← eski kodda 4 bo'lardi"],
    [7, 1, "4-kurs, 1-semestr"],
    [10, 2, "5-kurs, 2-semestr"],
  ])("global %i → %i  (%s)", async (global, expected) => {
    mockDistribution([block({ science: SCI_A, globalSemester: global })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].semester).toBe(expected);
  });

  test("natija HAR DOIM 1 yoki 2 (taqsimot enum'iga mos)", async () => {
    for (let g = 1; g <= 12; g++) {
      jest.clearAllMocks();
      mockDistribution([block({ science: SCI_A, globalSemester: g })]);
      ScienceModel.find = jest.fn().mockReturnValue({
        select: () => ({ lean: () => Promise.resolve([]) }),
      });
      const saved = captureCreated();

      await generate();

      expect([1, 2]).toContain(saved[0].teachingLoad.sciences[0].semester);
    }
  });

  test("semestr yo'q/noto'g'ri — 1 (yiqilmaydi)", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: undefined })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    const saved = captureCreated();

    await generate();

    expect(saved[0].teachingLoad.sciences[0].semester).toBe(1);
  });
});

describe("Seam shartlari — 4.2 dan FAQAT qabul qilingan yuklama olinadi", () => {
  test("so'rov `accepted` + `isVacant: false` bilan quriladi", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: 3 })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    captureCreated();

    await generate();

    const filter = WorkloadDistribution.find.mock.calls[0][0];
    expect(filter.teachers.$elemMatch).toMatchObject({
      teacher: TEACHER,
      acceptanceStatus: "accepted",
      isVacant: false,
    });
  });

  test("yuklama topilmasa — 404 (reja yaratilmaydi)", async () => {
    WorkloadDistribution.find = jest.fn().mockResolvedValue([]);
    PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(null);
    AcademicYearModel.findById = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ title: "2028/2029" }),
      }),
    });
    const res = createRes();

    await Controller.generateFromWorkload(
      { user: { _id: TEACHER }, body: { teacher: TEACHER, academicYear: AY } },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    const [payload] = res.json.mock.calls[0];
    expect(payload.message).toContain("2028/2029");
    expect(payload.message).not.toContain(AY);
  });

  test("manba izi saqlanadi (`distributionId` + `teacherEntryId`)", async () => {
    mockDistribution([block({ science: SCI_A, globalSemester: 3 })]);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    const saved = captureCreated();

    await generate();

    const sci = saved[0].teachingLoad.sciences[0];
    expect(sci.distributionId).toBe("eeeeeeeeeeeeeeeeeeeeeeee");
    expect(sci.teacherEntryId).toBe("ffffffffffffffffffffffff");
  });
});

describe("L-06 — hoursByType.independent auditoriyadan tashqari BARCHA soat", () => {
  const richBlock = {
    science: SCI_A,
    practiceTitle: null,
    course: 2,
    totalHour: 132,
    studyWork: {
      semester: 3,
      classTypes: [
        { slug: "maruza", total: 24 },
        { slug: "amaliy", total: 96 },
        { slug: "seminar", total: 0 },
        { slug: "laboratoriya", total: 0 },
        { slug: "klinik_amaliyot", total: 0 },
      ],
      items: [
        { slug: "on", value: 0 },
        { slug: "yan", value: 7 },
        { slug: "qoldirilgan", value: 5 },
        { slug: "malakaviy", value: 0 },
      ],
    },
  };

  const run = async (blocks) => {
    mockDistribution(blocks);
    ScienceModel.find = jest.fn().mockReturnValue({
      select: () => ({ lean: () => Promise.resolve([]) }),
    });
    const saved = captureCreated();
    await generate();
    return saved[0].teachingLoad.sciences[0];
  };

  test("qoldirilgan/malakaviy ham «Mustaqil»ga kiradi — qator = Jami (127 ≠ 132 regressiyasi)", async () => {
    const sci = await run([richBlock]);
    const h = sci.hoursByType;
    expect(h).toMatchObject({ lecture: 24, seminar: 96, laboratory: 0, practical: 0 });
    expect(h.independent).toBe(12);
    expect(h.lecture + h.seminar + h.laboratory + h.practical + h.independent).toBe(sci.totalHour);
  });

  test("ADR-034 `seminar` slug'i «Amaliy» ustuniga qo'shiladi, mustaqilga tushmaydi", async () => {
    const sci = await run([
      {
        ...richBlock,
        totalHour: 60,
        studyWork: {
          semester: 3,
          classTypes: [
            { slug: "maruza", total: 12 },
            { slug: "amaliy", total: 30 },
            { slug: "seminar", total: 8 },
          ],
          items: [{ slug: "yan", value: 10 }],
        },
      },
    ]);
    expect(sci.hoursByType).toMatchObject({ lecture: 12, seminar: 38, independent: 10 });
  });

  test("soat qo'lda pasaytirilgan bo'lsa — manfiy emas, 0", async () => {
    const sci = await run([{ ...richBlock, totalHour: 100 }]);
    expect(sci.hoursByType.independent).toBe(0);
  });
});
