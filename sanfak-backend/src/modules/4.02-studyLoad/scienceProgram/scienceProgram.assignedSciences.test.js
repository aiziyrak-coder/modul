jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model", () => ({
  aggregate: jest.fn(),
}));

const mongoose = require("mongoose");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const { resolveAssignedScienceIds } = require("./scienceProgram.assignedSciences");

const ME = "507f1f77bcf86cd799439011";

beforeEach(() => jest.clearAllMocks());

describe("resolveAssignedScienceIds", () => {
  test("biriktirilgan fan id'lari takrorsiz qaytadi; pipeline predikati to'g'ri", async () => {
    const s1 = new mongoose.Types.ObjectId();
    const s2 = new mongoose.Types.ObjectId();
    WorkloadDistModel.aggregate.mockResolvedValue([{ _id: null, ids: [s1, s2] }]);

    const ids = await resolveAssignedScienceIds(ME);

    expect(ids).toEqual([s1, s2]);
    const pipeline = WorkloadDistModel.aggregate.mock.calls[0][0];
    expect(String(pipeline[0].$match["teachers.teacher"])).toBe(ME);
    expect(pipeline[2].$match["teachers.acceptanceStatus"]).toEqual({
      $in: ["accepted", "pending"],
    });
    expect(pipeline[2].$match["teachers.isVacant"]).toEqual({ $ne: true });
    expect(pipeline[4].$match).toEqual({
      "teachers.blocks.type": "lesson",
      "teachers.blocks.science": { $ne: null },
    });
  });

  test("biriktirma yo'q (bo'sh aggregate) → []", async () => {
    WorkloadDistModel.aggregate.mockResolvedValue([]);
    expect(await resolveAssignedScienceIds(ME)).toEqual([]);
  });

  test("noto'g'ri/bo'sh userId → [] va DB so'rovi YO'Q", async () => {
    expect(await resolveAssignedScienceIds("u1")).toEqual([]);
    expect(await resolveAssignedScienceIds(null)).toEqual([]);
    expect(WorkloadDistModel.aggregate).not.toHaveBeenCalled();
  });
});
