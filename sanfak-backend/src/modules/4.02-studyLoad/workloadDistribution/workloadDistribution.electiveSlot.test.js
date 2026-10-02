const mongoose = require("mongoose");
const WorkloadDistribution = require("./workloadDistribution.model");
const {
  isElectiveBlock,
} = require("#modules/4.02-studyLoad/_shared/electiveBlock");

const base = () => ({
  workload: new mongoose.Types.ObjectId(),
  academicYear: new mongoose.Types.ObjectId(),
  date: "2026",
});

describe("workloadDistribution.model — electiveSlot (ADR-016 3-bosqich)", () => {
  test("maydon berilmasa `null` — mavjud hujjatlar buzilmaydi (migratsiya yo'q)", () => {
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ totalHour: 120 }] }],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(doc.teachers[0].blocks[0].electiveSlot).toBeNull();
  });

  test("ObjectId qiymat qabul qilinadi (ref: science)", () => {
    const sci = new mongoose.Types.ObjectId();
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ electiveSlot: sci }] }],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(String(doc.teachers[0].blocks[0].electiveSlot)).toBe(String(sci));
  });

  test("`science` va `electiveSlot` — ALOHIDA maydonlar (biri ikkinchisini bosmaydi)", () => {
    const main = new mongoose.Types.ObjectId();
    const chosen = new mongoose.Types.ObjectId();
    const doc = new WorkloadDistribution({
      ...base(),
      teachers: [{ blocks: [{ science: chosen, electiveSlot: main }] }],
    });

    expect(doc.validateSync()).toBeUndefined();
    expect(String(doc.teachers[0].blocks[0].science)).toBe(String(chosen));
    expect(String(doc.teachers[0].blocks[0].electiveSlot)).toBe(String(main));
  });

  test("`electiveSlot` schema'da ObjectId + ref=science", () => {
    const blocksPath = WorkloadDistribution.schema
      .path("teachers")
      .schema.path("blocks");
    const path = blocksPath.schema.path("electiveSlot");

    expect(path).toBeDefined();
    expect(path.instance).toBe("ObjectId");
    expect(path.options.ref).toBe("science");
    expect(path.options.default).toBeNull();
  });
});

describe("isElectiveBlock — `section` ni title'ga berish TUZOG'I", () => {
  test("faqat `title: \"TF2\"` berilsa — JIMGINA false (noto'g'ri yo'l)", () => {
    expect(isElectiveBlock({ title: "TF2" })).toBe(false);
  });

  test("haqiqiy reja bloki `{ blockCode: \"TF2\", title: null }` — true (to'g'ri yo'l)", () => {
    expect(isElectiveBlock({ blockCode: "TF2", title: null })).toBe(true);
  });
});
