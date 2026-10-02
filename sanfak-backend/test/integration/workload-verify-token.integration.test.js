const mongoose = require("mongoose");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");

const oid = () => new mongoose.Types.ObjectId();

const baseDoc = () => ({
  academicYear: oid(),
  date: "2026",
});

describe("workload verify.token — unikal qisman indeks (ADR-020 Invariant #4)", () => {
  beforeEach(async () => {
    await WorkloadModel.init();
  });

  test("indeks unikal + partialFilterExpression bilan e'lon qilingan", async () => {
    const idx = await WorkloadModel.collection.indexes();
    const tokenIdx = idx.find((i) => i.key && i.key["verify.token"] === 1);
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx.unique).toBe(true);
    expect(tokenIdx.partialFilterExpression).toEqual({
      "verify.token": { $type: "string" },
    });
  });

  test("ikkita TOKENSIZ hujjat saqlanadi — E11000 CHIQMAYDI", async () => {
    await WorkloadModel.create(baseDoc());
    await expect(WorkloadModel.create(baseDoc())).resolves.toBeTruthy();
  });

  test("bir xil token bilan ikkinchi hujjat — E11000", async () => {
    const token = "a".repeat(32);
    await WorkloadModel.create({ ...baseDoc(), verify: { token } });
    await expect(
      WorkloadModel.create({ ...baseDoc(), verify: { token } }),
    ).rejects.toThrow(/E11000/);
  });

  test("turli tokenlar — ikkalasi ham saqlanadi", async () => {
    await WorkloadModel.create({ ...baseDoc(), verify: { token: "a".repeat(32) } });
    await expect(
      WorkloadModel.create({ ...baseDoc(), verify: { token: "b".repeat(32) } }),
    ).resolves.toBeTruthy();
  });
});
