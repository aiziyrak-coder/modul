const mongoose = require("mongoose");
const WorkloadDistribution = require("./workloadDistribution.model");

describe("workloadDistribution.model — stavka (ADR-006 SHART #1)", () => {
  const base = () => ({
    workload: new mongoose.Types.ObjectId(),
    academicYear: new mongoose.Types.ObjectId(),
    date: "2026",
  });

  test("stavka=1.25 (ro'yxatdan CHIQARILGAN eski qiymat) — doc.save() validatsiyasi YIQILMAYDI", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ stavka: 1.25, totalHour: 100 }],
    });
    const err = doc.validateSync();
    expect(err).toBeUndefined();
  });

  test("standart 4 qiymat (0.25/0.5/0.75/1.0) — hamon o'tadi", () => {
    for (const stavka of [0.25, 0.5, 0.75, 1.0]) {
      const doc = new WorkloadDistribution({
        ...base(),
        teachers: [{ stavka }],
      });
      expect(doc.validateSync()).toBeUndefined();
    }
  });

  test("chegaradan tashqari (min/max) — hamon RAD ETILADI", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ stavka: 3 }],
    });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(err.errors["teachers.0.stavka"]).toBeDefined();
  });
});

describe("workloadDistribution.model — AssignmentBlockSchema.acceptanceStatus (ADR-007)", () => {
  const base = () => ({
    workload: new mongoose.Types.ObjectId(),
    academicYear: new mongoose.Types.ObjectId(),
    date: "2026",
  });

  test("7) yangi blokda acceptanceStatus default \"pending\"", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ totalHour: 10 }] }],
    });
    expect(doc.teachers[0].blocks[0].acceptanceStatus).toBe("pending");
    expect(doc.validateSync()).toBeUndefined();
  });

  test("8) blokda noto'g'ri status (\"maybe\") → validateSync() xato beradi", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ totalHour: 10, acceptanceStatus: "maybe" }] }],
    });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(
      err.errors["teachers.0.blocks.0.acceptanceStatus"],
    ).toBeDefined();
  });

  test("9) regressiya qulfi — entry va blok enum'i BIR XIL ro'yxatdan (fork yo'q)", () => {
    const entryPath =
      WorkloadDistribution.schema.path("teachers").schema.path(
        "acceptanceStatus",
      );
    const blockPath = WorkloadDistribution.schema
      .path("teachers").schema.path("blocks").schema.path("acceptanceStatus");
    expect(entryPath.enumValues).toEqual(blockPath.enumValues);
    expect(entryPath.enumValues).toEqual(["pending", "accepted", "rejected"]);
  });
});

describe("workloadDistribution.model — AssignmentBlockSchema.justification (Faza 2)", () => {
  const base = () => ({
    workload: new mongoose.Types.ObjectId(),
    academicYear: new mongoose.Types.ObjectId(),
    date: "2026",
  });

  test("yangi blokda justification hamma maydoni default null (migratsiya yo'q)", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ totalHour: 10 }] }],
    });
    const j = doc.teachers[0].blocks[0].justification;
    expect(j.basis).toBeNull();
    expect(j.note).toBeNull();
    expect(j.declaredBy).toBeNull();
    expect(j.declaredAt).toBeNull();
    expect(doc.validateSync()).toBeUndefined();
  });

  test("ASSIGNMENT_BASES ro'yxatidagi har bir qiymat qabul qilinadi", () => {
    for (const basis of WorkloadDistribution.ASSIGNMENT_BASES) {
      const doc = new WorkloadDistribution({
        ...base(),
        teachers: [{ blocks: [{ totalHour: 10, justification: { basis } }] }],
      });
      expect(doc.validateSync()).toBeUndefined();
    }
  });

  test("ro'yxatdan tashqari basis (\"boshqa_narsa\") → validateSync() xato beradi", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [
        { blocks: [{ totalHour: 10, justification: { basis: "boshqa_narsa" } }] },
      ],
    });
    const err = doc.validateSync();
    expect(err).toBeDefined();
    expect(
      err.errors["teachers.0.blocks.0.justification.basis"],
    ).toBeDefined();
  });

  test("to'liq bayonnoma (basis+note+declaredBy+declaredAt) saqlanadi", () => {
    const userId = new mongoose.Types.ObjectId();
    const now = new Date();
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [
        {
          blocks: [
            {
              totalHour: 10,
              justification: {
                basis: "ish_tajribasi",
                note: "10 yillik amaliy tajriba",
                declaredBy: userId,
                declaredAt: now,
              },
            },
          ],
        },
      ],
    });
    expect(doc.validateSync()).toBeUndefined();
    const j = doc.teachers[0].blocks[0].justification;
    expect(j.basis).toBe("ish_tajribasi");
    expect(j.note).toBe("10 yillik amaliy tajriba");
    expect(String(j.declaredBy)).toBe(String(userId));
    expect(j.declaredAt).toEqual(now);
  });

  test("regressiya qulfi — Joi ASSIGNMENT_BASES va Mongoose ASSIGNMENT_BASES BIR XIL", () => {
    const { ASSIGNMENT_BASES: joiBases } = require("./workloadDistribution.validation");
    expect(joiBases).toEqual(WorkloadDistribution.ASSIGNMENT_BASES);
    expect(joiBases).toEqual([
      "kafedrada_mutaxassis_yoq",
      "ish_tajribasi",
      "oqigan_fani_yaqin",
      "sertifikat_malaka",
      "ilmiy_ishlar",
      "boshqa",
    ]);
  });
});

describe("workloadDistribution.model — AssignmentBlockSchema.classTypeSlugs (ADR-034)", () => {
  const base = () => ({
    workload: new mongoose.Types.ObjectId(),
    academicYear: new mongoose.Types.ObjectId(),
    date: "2026",
  });

  test("default `[]`; berilgan slug'lar saqlanadi va `toObject()` da qaytadi", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ totalHour: 10 }, { totalHour: 7, classTypeSlugs: ["maruza"] }] }],
    });
    expect(doc.validateSync()).toBeUndefined();
    const blocks = doc.toObject().teachers[0].blocks;
    expect(blocks[0].classTypeSlugs).toEqual([]);
    expect(blocks[1].classTypeSlugs).toEqual(["maruza"]);
  });
});
