jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve(null) }) })),
}));

jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
jest.mock("#references/direction/direction.model");
jest.mock("#references/academicYear/academicYear.model");
jest.mock("#modules/4.02-studyLoad/_services/groupStatsResolver");

const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const DirectionModel = require("#references/direction/direction.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const {
  getGroupStats,
} = require("#modules/4.02-studyLoad/_services/groupStatsResolver");
const Controller = require("./workload.controller");

const ACADEMIC_YEAR_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEPARTMENT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createReq = () => ({
  body: { department: DEPARTMENT_ID, academicYear: ACADEMIC_YEAR_ID },
});

const runAddWorkload = async (sciences) => {
  const schedule = {
    _id: "cccccccccccccccccccccccc",
    direction: "dddddddddddddddddddddddd",
    year: "2026",
    academicYear: ACADEMIC_YEAR_ID,
    groups: ["eeeeeeeeeeeeeeeeeeeeeeee"],
    currentCourse: 1,
    courseRef: "ffffffffffffffffffffffff",
    status: "approved",
  };

  WorkingScheduleModel.find = jest.fn().mockResolvedValue([schedule]);
  WorkingPlanModel.findOne = jest.fn().mockResolvedValue({
    _id: "111111111111111111111111",
    studyPlan: null,
    semesters: {
      1: { blocks: [{ title: "I. Fanlar", sciences }] },
    },
  });

  const directionChain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({}),
  };
  DirectionModel.findById = jest.fn().mockReturnValue(directionChain);

  AcademicYearModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  });
  AcademicYearModel.findById = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue({ title: "2026/2027" }),
  });

  getGroupStats.mockResolvedValue({
    groupCount: 1,
    studentCount: 10,
    streamCount: 1,
  });

  const req = createReq();
  const res = createRes();
  const next = jest.fn();
  await Controller.addWorkload(req, res, next);

  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0][0];
};

const UNLINKED_RX = /katalogga bog'lanmagan/;
const FALLBACK_MSG = "Bu kafedra uchun tegishli fanlar topilmadi";

describe("addWorkload — D-120 (A) unlinkedInPlan hisoblagichi", () => {
  test("struktura qatorlari (kodsiz, sciencesiz sarlavha/placeholder) SANALMAYDI", async () => {
    const err = await runAddWorkload([
      {
        serialNumber: "1.2.",
        code: "",
        science: null,
        title: "Klinika oldi fanlari moduli",
        department: null,
      },
      {
        serialNumber: "1.3.1",
        code: "",
        science: null,
        title: "Terapiya yo'nalishi",
        department: null,
      },
      {
        serialNumber: null,
        code: null,
        science: null,
        title: "Tanlov fani (tanlanmagan)",
        department: null,
      },
    ]);

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe(FALLBACK_MSG);
    expect(err.message).not.toMatch(UNLINKED_RX);
  });

  test("kodi BOR, lekin science bog'lanmagan qator — HAQIQIY D-120 holati, hamon 404 SANALADI", async () => {
    const err = await runAddWorkload([
      {
        serialNumber: "2.1",
        code: "O'YT1104",
        science: null,
        title: "Ichki kasalliklar propedevtikasi",
        department: null,
      },
    ]);

    expect(err.statusCode).toBe(404);
    expect(err.message).toMatch(UNLINKED_RX);
    expect(err.message).toContain("(1 ta)");
  });

  test("'Jami'/'HAMMASI' qatorlari — kod bo'lsa ham SANALMAYDI", async () => {
    const err = await runAddWorkload([
      { serialNumber: "", code: "JAMI001", science: null, title: "Jami", department: null },
      { serialNumber: "", code: "JAMI002", science: null, title: "HAMMASI", department: null },
    ]);

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe(FALLBACK_MSG);
    expect(err.message).not.toMatch(UNLINKED_RX);
  });

  test("amaliyot qatori — isPracticeEntry tartibiga ko'ra hisoblagichdan OLDIN chetlab o'tiladi", async () => {
    const err = await runAddWorkload([
      {
        serialNumber: "",
        code: "",
        science: null,
        title: "Malakaviy amaliyotga rahbarlik",
        department: null,
      },
    ]);

    expect(err.statusCode).toBe(404);
    expect(err.message).toBe(FALLBACK_MSG);
    expect(err.message).not.toMatch(UNLINKED_RX);
  });
});
