"use strict";

jest.mock("#modules/4.02-studyLoad/workload/workload.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
jest.mock("#modules/4.02-studyLoad/syllabus/syllabus.model");

const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const Distribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkingSchedule = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const ScienceProgram = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const Syllabus = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { onGroupStudentCountChange } = require("#modules/4.02-studyLoad/_services/workloadRecalculator");
const WorkloadController = require("#modules/4.02-studyLoad/workload/workload.controller");
const DistController = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.controller");
const contingentService = require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.service");
const statistics = require("#modules/4.02-studyLoad/studyLoadStatistics/studyLoadStatistics.service");
const { isLocked } = require("./editableStatus");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe("qulf va qayta hisoblash — superseded tegilmaydi", () => {
  test("isLocked(superseded) = true; draft/rejected — ochiq (o'zgarmagan)", () => {
    expect(isLocked("superseded")).toBe(true);
    expect(isLocked("draft")).toBe(false);
    expect(isLocked("rejected")).toBe(false);
  });

  test("guruh hook'i: Workload.find superseded'ni OLMAYDI", async () => {
    Workload.find = jest.fn().mockResolvedValue([]);
    Distribution.find = jest.fn().mockResolvedValue([]);
    await onGroupStudentCountChange({ groupId: "g", newCount: 5, oldCount: 4, direction: "d", course: 1 });
    expect(Workload.find.mock.calls[0][0]).toMatchObject({ status: { $ne: "superseded" }, active: true });
  });

  test("POST /recalculate: filtr superseded'ni chiqaradi (workloadIds berilsa ham)", async () => {
    Workload.find = jest.fn().mockResolvedValue([]);
    await WorkloadController.recalculateBulk({ body: { workloadIds: ["w1"] }, scope: {} }, createRes(), jest.fn());
    expect(Workload.find.mock.calls[0][0]).toEqual({ active: true, status: { $ne: "superseded" }, _id: { $in: ["w1"] } });
  });

  test("kafedra kontingenti o'zgarganda superseded yuklama belgilanmaydi", async () => {
    Workload.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
    await contingentService.markWorkloadsForRecalc({ department: "dep", academicYear: "ay" });
    expect(Workload.updateMany.mock.calls[0][0]).toEqual({ department: "dep", academicYear: "ay", status: { $ne: "superseded" } });
  });
});

describe("statistika — superseded jamiga kirmaydi", () => {
  test("overview holatlar(): har modelning $match'ida status ≠ superseded", async () => {
    for (const M of [WorkingSchedule, Workload, Distribution, ScienceProgram, Syllabus]) {
      M.aggregate = jest.fn().mockResolvedValue([]);
    }
    await statistics.overview();
    const firstMatch = (M) => M.aggregate.mock.calls[0][0][0].$match;
    expect(firstMatch(Workload)).toEqual({ active: true, status: { $ne: "superseded" } });
    expect(firstMatch(Distribution)).toMatchObject({ status: { $ne: "superseded" } });
  });
});

describe("GET /my — o'qituvchi: superseded taqsimot belgisi", () => {
  test("superseded: true + supersededAt; faol taqsimot superseded: false", async () => {
    const at = new Date("2026-09-20");
    const docs = [
      { _id: "old", status: "superseded", supersededAt: at, teachers: [] },
      { _id: "new", status: "approved", teachers: [] },
    ];
    const q = { populate: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(docs) };
    Distribution.find = jest.fn().mockReturnValue(q);
    const res = createRes();
    await DistController.getMyDistributions({ user: { _id: "t1" } }, res, jest.fn());
    const [oldRow, newRow] = res.json.mock.calls[0][0];
    expect(oldRow).toMatchObject({ superseded: true, supersededAt: at });
    expect(newRow).toMatchObject({ superseded: false, supersededAt: null });
  });
});
