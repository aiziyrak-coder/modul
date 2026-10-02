jest.mock("./workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.service", () => ({
  loadSummaryWorkloads: jest.fn(),
}));
jest.mock("#references/department/department.model", () => ({
  find: jest.fn(),
}));

const WorkloadSummary = require("./workloadSummary.model");
const workloadService = require("#modules/4.02-studyLoad/workload/workload.service");
const DepartmentModel = require("#references/department/department.model");
const service = require("./workloadSummary.service");

const DEP_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const DEP_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const AY = "6a8bdb6c5b767d415c184735";

const wl = ({ id, dep, title, hours }) => ({
  _id: id,
  updatedAt: new Date("2026-09-23"),
  department: { _id: dep, title, head: null },
  directions: [{ blocks: [{ totalHour: hours }] }],
  staffPositions: { items: [], totalPositions: 0, hourly: hours },
  approvalSteps: [],
});

const create = () =>
  service.createSummary({ academicYearId: AY, academicYearTitle: "2024/2025", userId: "u1" });

beforeEach(() => {
  jest.clearAllMocks();
  DepartmentModel.find.mockReturnValue({
    lean: () => ({ exec: async () => [{ _id: DEP_A, title: "Normal anatomiya kafedrasi" }] }),
  });
});

describe("createSummary — bir kafedrada bir nechta approved yuklama (F-03)", () => {
  test("ikki approved yuklama bir kafedrada → 409 duplicate_approved_workloads, hujjat yaratilmaydi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w-old", dep: DEP_A, title: "Normal anatomiya kafedrasi", hours: 121 }),
      wl({ id: "w-new", dep: DEP_A, title: "Normal anatomiya kafedrasi", hours: 121 }),
    ]);

    await expect(create()).rejects.toMatchObject({
      statusCode: 409,
      meta: {
        reason: "duplicate_approved_workloads",
        departments: [
          { department: DEP_A, title: "Normal anatomiya kafedrasi", workloads: ["w-old", "w-new"] },
        ],
      },
    });
    expect(WorkloadSummary).not.toHaveBeenCalled();
  });

  test("har kafedrada bittadan yuklama — hujjat tuziladi (darvoza oddiy holatni to'smaydi)", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w-a", dep: DEP_A, title: "Normal anatomiya kafedrasi", hours: 121 }),
      wl({ id: "w-b", dep: DEP_B, title: "Gistologiya kafedrasi", hours: 90 }),
    ]);

    await create();
    expect(WorkloadSummary).toHaveBeenCalledTimes(1);
    expect(WorkloadSummary.mock.calls[0][0].snapshot.totals.total).toBe(211);
  });

  test("buildSnapshot dublikat kafedralarni ro'yxatlaydi (surat o'zi o'zgarmaydi)", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      wl({ id: "w1", dep: DEP_A, title: "Normal anatomiya kafedrasi", hours: 121 }),
      wl({ id: "w2", dep: DEP_A, title: "Normal anatomiya kafedrasi", hours: 121 }),
      wl({ id: "w3", dep: DEP_B, title: "Gistologiya kafedrasi", hours: 90 }),
    ]);

    const out = await service.buildSnapshot(AY);

    expect(out.duplicateDepartments).toEqual([
      { department: DEP_A, title: "Normal anatomiya kafedrasi", workloads: ["w1", "w2"] },
    ]);
    expect(out.workloadCount).toBe(3);
  });
});
