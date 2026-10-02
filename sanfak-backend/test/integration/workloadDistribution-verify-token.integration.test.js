const mongoose = require("mongoose");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");

const oid = () => new mongoose.Types.ObjectId();

const baseDoc = () => ({
  workload: oid(),
  academicYear: oid(),
  date: "2026",
});

describe("workloadDistribution verify.token — unikal qisman indeks (ADR-020 Invariant #4, WP-B Faza 2)", () => {
  beforeEach(async () => {
    await WorkloadDistributionModel.init();
  });

  test("indeks unikal + partialFilterExpression bilan e'lon qilingan", async () => {
    const idx = await WorkloadDistributionModel.collection.indexes();
    const tokenIdx = idx.find((i) => i.key && i.key["verify.token"] === 1);
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx.unique).toBe(true);
    expect(tokenIdx.partialFilterExpression).toEqual({
      "verify.token": { $type: "string" },
    });
  });

  test("ikkita TOKENSIZ hujjat saqlanadi — E11000 CHIQMAYDI", async () => {
    await WorkloadDistributionModel.create(baseDoc());
    await expect(
      WorkloadDistributionModel.create(baseDoc()),
    ).resolves.toBeTruthy();
  });

  test("bir xil token bilan ikkinchi hujjat — E11000", async () => {
    const token = "a".repeat(32);
    await WorkloadDistributionModel.create({ ...baseDoc(), verify: { token } });
    await expect(
      WorkloadDistributionModel.create({ ...baseDoc(), verify: { token } }),
    ).rejects.toThrow(/E11000/);
  });

  test("turli tokenlar — ikkalasi ham saqlanadi", async () => {
    await WorkloadDistributionModel.create({
      ...baseDoc(),
      verify: { token: "a".repeat(32) },
    });
    await expect(
      WorkloadDistributionModel.create({
        ...baseDoc(),
        verify: { token: "b".repeat(32) },
      }),
    ).resolves.toBeTruthy();
  });
});
