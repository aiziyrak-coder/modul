jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model", () => ({
  aggregate: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workload/workload.model", () => ({
  aggregate: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model", () => ({
  aggregate: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model", () => ({
  aggregate: jest.fn(),
}));
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model", () => ({
  aggregate: jest.fn(),
}));

const WorkingSchedule = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");

const service = require("./studyLoadStatistics.service");

beforeEach(() => {
  jest.clearAllMocks();

  WorkingSchedule.aggregate.mockResolvedValueOnce([
    { _id: "approved", n: 5 },
    { _id: "in_review", n: 2 },
  ]);
  Workload.aggregate.mockResolvedValueOnce([{ _id: "approved", n: 3 }]);
  Distribution.aggregate.mockResolvedValueOnce([
    { _id: "approved", n: 4 },
    { _id: "rejected", n: 1 },
  ]);
  ScienceProgram.aggregate.mockResolvedValueOnce([{ _id: "approved", n: 2 }]);
  Syllabus.aggregate.mockResolvedValueOnce([{ _id: "approved", n: 1 }]);

  WorkingSchedule.aggregate.mockResolvedValueOnce([{ _id: null, n: 2, oldest: null }]);
  Workload.aggregate.mockResolvedValueOnce([{ _id: null, n: 1, oldest: null }]);

  Distribution.aggregate.mockResolvedValueOnce([{ distributed: 1000, residue: 200 }]);

  Distribution.aggregate.mockResolvedValueOnce([
    { _id: "dept1", count: 3, hours: 120, d: { title: "Kafedra A" } },
    { _id: "dept2", count: 1, hours: 40, d: { title: "Kafedra B" } },
  ]);
});

describe("studyLoadStatistics.service.overview — regressiya (javob shakli o'zgarmagan)", () => {
  test("to'liq javob AVVALGI controller bilan bayt-bayt bir xil shaklda qaytadi", async () => {
    const result = await service.overview();

    expect(result).toEqual({
      rectorInbox: {
        workingSchedule: 2,
        workload: 1,
        total: 3,
        oldestWaitingDays: null,
      },
      documents: {
        workingSchedule: {
          total: 7,
          draft: 0,
          new: 0,
          in_review: 2,
          approved: 5,
          rejected: 0,
        },
        workload: { total: 3, draft: 0, new: 0, in_review: 0, approved: 3, rejected: 0 },
        distribution: { total: 5, draft: 0, new: 0, in_review: 0, approved: 4, rejected: 1 },
        scienceProgram: { total: 2, draft: 0, new: 0, in_review: 0, approved: 2, rejected: 0 },
        syllabus: { total: 1, draft: 0, new: 0, in_review: 0, approved: 1, rejected: 0 },
        readiness: 83.3,
      },
      hours: { distributed: 1000, residue: 200, coverage: 80 },
      vacancies: {
        count: 4,
        hours: 160,
        byDepartment: [
          { department: "Kafedra A", count: 3, hours: 120 },
          { department: "Kafedra B", count: 1, hours: 40 },
        ],
      },
    });
  });

  test("aggregate() chaqiruvlar tartibi AVVALGI kod bilan bir xil (holatlar×5 → rektorNavbati×2 → hours → vacancies)", async () => {
    await service.overview();

    expect(WorkingSchedule.aggregate).toHaveBeenCalledTimes(2);
    expect(Workload.aggregate).toHaveBeenCalledTimes(2);
    expect(Distribution.aggregate).toHaveBeenCalledTimes(3);
    expect(ScienceProgram.aggregate).toHaveBeenCalledTimes(1);
    expect(Syllabus.aggregate).toHaveBeenCalledTimes(1);
  });
});
