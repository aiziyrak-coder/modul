jest.mock("./workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#references/science/science.model");

const WorkloadDistribution = require("./workloadDistribution.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Controller = require("./workloadDistribution.controller");

const DIST_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
const BLOCK_ID = "cccccccccccccccccccccccc";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const setup = (globalSemester) => {
  WorkloadDistribution.findOne = jest.fn().mockResolvedValue({
    _id: DIST_ID,
    status: "draft",
    workload: "dddddddddddddddddddddddd",
    residueHour: 1000,
    teachers: [{ _id: { toString: () => ENTRY_ID } }],
  });

  Workload.findById = jest.fn().mockResolvedValue({
    directions: [
      {
        blocks: [
          {
            _id: { toString: () => BLOCK_ID },
            section: "Majburiy fanlar",
            type: "lesson",
            science: "eeeeeeeeeeeeeeeeeeeeeeee",
            course: 2,
            student: 83,
            totalHour: 150,
            studyWork: { semester: globalSemester, group: 3, stream: 2 },
          },
        ],
      },
    ],
  });

  WorkloadDistribution.findOneAndUpdate = jest.fn().mockResolvedValue({});
  WorkloadDistribution.findById = jest.fn().mockResolvedValue(null);
};

const addBlockAndGetSemester = async (body = {}) => {
  const req = {
    params: { id: DIST_ID, teacherEntryId: ENTRY_ID },
    body: { workloadBlockId: BLOCK_ID, ...body },
    scope: {},
  };
  await Controller.addBlockToTeacher(req, createRes(), jest.fn());

  const update = WorkloadDistribution.findOneAndUpdate.mock.calls[0][1];
  return update.$push["teachers.$.blocks"].semester;
};

beforeEach(() => jest.clearAllMocks());

describe("addBlockToTeacher — global semestrni kurs ichidagiga aylantirish", () => {
  test.each([
    [1, 1, "1-kurs, 1-semestr"],
    [2, 2, "1-kurs, 2-semestr"],
    [3, 1, "2-kurs, 1-semestr"],
    [4, 2, "2-kurs, 2-semestr  ← ESKI KODDA 1 BO'LARDI"],
    [5, 1, "3-kurs, 1-semestr"],
    [6, 2, "3-kurs, 2-semestr  ← ESKI KODDA 1 BO'LARDI"],
    [9, 1, "5-kurs, 1-semestr"],
    [10, 2, "5-kurs, 2-semestr ← ESKI KODDA 1 BO'LARDI"],
  ])("global %i → kurs ichida %i  (%s)", async (global, expected) => {
    setup(global);
    await expect(addBlockAndGetSemester()).resolves.toBe(expected);
  });

  test("REGRESSION-GUARD: juft global semestr 1 ga tushib qolmasin", async () => {
    for (const g of [4, 6, 8, 10]) {
      jest.clearAllMocks();
      setup(g);
      const got = await addBlockAndGetSemester();
      expect(got).not.toBe(1);
      expect(got).toBe(2);
    }
  });

  test("body'dagi aniq `semester` ustun turadi (UI override)", async () => {
    setup(4);
    await expect(addBlockAndGetSemester({ semester: 1 })).resolves.toBe(1);
  });

  test("semestr yo'q/noto'g'ri bo'lsa — 1 (model default bilan bir xil)", async () => {
    for (const bad of [undefined, null, 0, -3, "x"]) {
      jest.clearAllMocks();
      setup(bad);
      await expect(addBlockAndGetSemester()).resolves.toBe(1);
    }
  });

  test("natija HAR DOIM model enum'iga (1|2) sig'sin", async () => {
    for (let g = 1; g <= 12; g++) {
      jest.clearAllMocks();
      setup(g);
      expect([1, 2]).toContain(await addBlockAndGetSemester());
    }
  });
});
