const mongoose = require("mongoose");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");

const oid = () => new mongoose.Types.ObjectId();

const baseDoc = () => ({
  science: oid(),
  user: oid(),
});

describe("scienceProgram verify.token — unikal qisman indeks (ADR-020 Invariant #4, WP-B Faza 2)", () => {
  beforeEach(async () => {
    await ScienceProgramModel.init();
  });

  test("indeks unikal + partialFilterExpression bilan e'lon qilingan", async () => {
    const idx = await ScienceProgramModel.collection.indexes();
    const tokenIdx = idx.find((i) => i.key && i.key["verify.token"] === 1);
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx.unique).toBe(true);
    expect(tokenIdx.partialFilterExpression).toEqual({
      "verify.token": { $type: "string" },
    });
  });

  test("ikkita TOKENSIZ hujjat saqlanadi — E11000 CHIQMAYDI", async () => {
    await ScienceProgramModel.create(baseDoc());
    await expect(ScienceProgramModel.create(baseDoc())).resolves.toBeTruthy();
  });

  test("bir xil token bilan ikkinchi hujjat — E11000", async () => {
    const token = "a".repeat(32);
    await ScienceProgramModel.create({ ...baseDoc(), verify: { token } });
    await expect(
      ScienceProgramModel.create({ ...baseDoc(), verify: { token } }),
    ).rejects.toThrow(/E11000/);
  });

  test("turli tokenlar — ikkalasi ham saqlanadi", async () => {
    await ScienceProgramModel.create({
      ...baseDoc(),
      verify: { token: "a".repeat(32) },
    });
    await expect(
      ScienceProgramModel.create({
        ...baseDoc(),
        verify: { token: "b".repeat(32) },
      }),
    ).resolves.toBeTruthy();
  });
});
