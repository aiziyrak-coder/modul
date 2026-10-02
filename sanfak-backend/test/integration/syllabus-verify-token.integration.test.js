const mongoose = require("mongoose");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");

const oid = () => new mongoose.Types.ObjectId();

const baseDoc = () => ({
  science: oid(),
  faculty: oid(),
});

describe("syllabus verify.token — unikal qisman indeks (ADR-020 Invariant #4, WP-B Faza 2)", () => {
  beforeEach(async () => {
    await SyllabusModel.init();
  });

  test("indeks unikal + partialFilterExpression bilan e'lon qilingan", async () => {
    const idx = await SyllabusModel.collection.indexes();
    const tokenIdx = idx.find((i) => i.key && i.key["verify.token"] === 1);
    expect(tokenIdx).toBeDefined();
    expect(tokenIdx.unique).toBe(true);
    expect(tokenIdx.partialFilterExpression).toEqual({
      "verify.token": { $type: "string" },
    });
  });

  test("ikkita TOKENSIZ hujjat saqlanadi — E11000 CHIQMAYDI", async () => {
    await SyllabusModel.create(baseDoc());
    await expect(SyllabusModel.create(baseDoc())).resolves.toBeTruthy();
  });

  test("bir xil token bilan ikkinchi hujjat — E11000", async () => {
    const token = "a".repeat(32);
    await SyllabusModel.create({ ...baseDoc(), verify: { token } });
    await expect(
      SyllabusModel.create({ ...baseDoc(), verify: { token } }),
    ).rejects.toThrow(/E11000/);
  });

  test("turli tokenlar — ikkalasi ham saqlanadi", async () => {
    await SyllabusModel.create({ ...baseDoc(), verify: { token: "a".repeat(32) } });
    await expect(
      SyllabusModel.create({ ...baseDoc(), verify: { token: "b".repeat(32) } }),
    ).resolves.toBeTruthy();
  });
});
