jest.mock("./workloadSummary.model");
jest.mock("#modules/4.02-studyLoad/workload/workload.service", () => ({
  loadSummaryWorkloads: jest.fn(),
}));

const workloadService = require("#modules/4.02-studyLoad/workload/workload.service");
const service = require("./workloadSummary.service");

const T0 = new Date("2026-09-20T10:00:00Z");
const T1 = new Date("2026-09-24T10:00:00Z");

const summaryDoc = () => ({
  academicYear: "ay1",
  includedWorkloads: [{ workload: "w1", updatedAt: T0 }],
});

describe("assertFreshForFinalApproval (D-16)", () => {
  beforeEach(() => jest.clearAllMocks());

  test("surat yangi — o'tadi", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([{ _id: "w1", updatedAt: T0 }]);
    await expect(service.assertFreshForFinalApproval(summaryDoc())).resolves.toBeUndefined();
  });

  test("yuklama o'zgargan / yangisi qo'shilgan — 409, sabab soni bilan", async () => {
    workloadService.loadSummaryWorkloads.mockResolvedValue([
      { _id: "w1", updatedAt: T1 },
      { _id: "w2", updatedAt: T1 },
    ]);
    await expect(service.assertFreshForFinalApproval(summaryDoc())).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("yangi: 1, o'zgargan: 1"),
    });
  });
});
