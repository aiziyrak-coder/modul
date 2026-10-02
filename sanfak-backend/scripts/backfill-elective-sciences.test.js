"use strict";

jest.mock("#modules/4.02-studyLoad/studyPlan/studyPlan.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/workingPlan/workingPlan.model", () => ({ find: jest.fn() }));
jest.mock("#references/science/science.model", () => ({ find: jest.fn(), updateMany: jest.fn() }));

const fs = require("fs");
const StudyPlanModel = require("#modules/4.02-studyLoad/studyPlan/studyPlan.model");
const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const ScienceModel = require("#references/science/science.model");
const {
  collectElectiveScienceIds,
  semesterBlocks,
  backfill,
  revert,
} = require("./backfill-elective-sciences");

const SCI_A = "64b000000000000000000a01";
const SCI_B = "64b000000000000000000b02";
const SCI_C = "64b000000000000000000c03";
const SCI_MANDATORY = "64b000000000000000000d04";
const SCI_PRACTICE = "64b000000000000000000e05";

const electiveBlock = () => ({
  blockCode: "TF2",
  title: "Tanlov fanlar",
  sciences: [
    { science: SCI_A, code: "FA1", title: "Radiatsion gigiyena", alternatives: [{ science: SCI_B, code: "FB2", title: "Ekologiya" }] },
    { science: SCI_PRACTICE, code: "MM2-520", title: "Malakaviy amaliyot" },
    { science: null, code: null, title: "Tanlov fani (tanlanmagan)" },
  ],
});
const mandatoryBlock = () => ({
  blockCode: "MF1",
  title: "Majburiy fanlar",
  sciences: [{ science: SCI_MANDATORY, code: "IK1", title: "Ichki kasalliklar" }],
});

const chain = (docs) => ({ select: () => ({ lean: () => Promise.resolve(docs) }) });

beforeEach(() => jest.clearAllMocks());

describe("collectElectiveScienceIds — qaysi fanlar belgilanadi", () => {
  test("tanlov qatori fani va uning alternativi olinadi", () => {
    const ids = collectElectiveScienceIds([electiveBlock()]);
    expect([...ids.keys()].sort()).toEqual([SCI_A, SCI_B].sort());
  });

  test("amaliyot qatori, bo'sh slot va majburiy blok fanlari OLINMAYDI", () => {
    const ids = collectElectiveScienceIds([electiveBlock(), mandatoryBlock()]);
    expect(ids.has(SCI_PRACTICE)).toBe(false);
    expect(ids.has(SCI_MANDATORY)).toBe(false);
    expect(ids.size).toBe(2);
  });

  test("bir fan bir necha rejada uchrasa — soni yig'iladi", () => {
    const ids = collectElectiveScienceIds([electiveBlock(), electiveBlock()]);
    expect(ids.get(SCI_A)).toBe(2);
  });

  test("ishchi reja semestrlari: Map ham, lean obyekt ham", () => {
    const asObject = { 1: { blocks: [electiveBlock()] }, 2: { blocks: [mandatoryBlock()] } };
    const asMap = new Map(Object.entries(asObject));
    expect(semesterBlocks(asObject)).toHaveLength(2);
    expect(semesterBlocks(asMap)).toHaveLength(2);
    expect(semesterBlocks(null)).toEqual([]);
  });
});

describe("backfill — dry-run va --apply", () => {
  const setup = (catalog) => {
    StudyPlanModel.find.mockReturnValue(chain([{ blocks: [electiveBlock(), mandatoryBlock()] }]));
    WorkingPlanModel.find.mockReturnValue(
      chain([{ semesters: { 1: { blocks: [{ blockCode: "TF2", title: "Tanlov fanlar", sciences: [{ science: SCI_C, code: "FC3", title: "Nutritsiologiya" }] }] } } }]),
    );
    ScienceModel.find.mockReturnValue(chain(catalog));
    ScienceModel.updateMany.mockResolvedValue({ modifiedCount: 2 });
  };

  test("dry-run: hisobot bor, bazaga HECH NARSA yozilmaydi", async () => {
    setup([
      { _id: SCI_A, scienceCode: "FA1", title: "Radiatsion gigiyena", active: true },
      { _id: SCI_B, scienceCode: "FB2", title: "Ekologiya", active: true, isElective: true },
      { _id: SCI_C, scienceCode: "FC3", title: "Nutritsiologiya", active: true },
    ]);
    const r = await backfill({ apply: false });
    expect(r.referenced).toBe(3);
    expect(r.alreadyFlagged).toBe(1);
    expect(r.toFlag.map((d) => d.id).sort()).toEqual([SCI_A, SCI_C].sort());
    expect(ScienceModel.updateMany).not.toHaveBeenCalled();
  });

  test("--apply: faqat belgisiz fanlar, `$ne: true` filtri bilan (idempotent), faqat `true` yoziladi", async () => {
    setup([
      { _id: SCI_A, scienceCode: "FA1", title: "Radiatsion gigiyena", active: true },
      { _id: SCI_B, scienceCode: "FB2", title: "Ekologiya", active: true, isElective: true },
      { _id: SCI_C, scienceCode: "FC3", title: "Nutritsiologiya", active: true },
    ]);
    const r = await backfill({ apply: true, backup: false });
    expect(ScienceModel.updateMany).toHaveBeenCalledTimes(1);
    const [filter, update] = ScienceModel.updateMany.mock.calls[0];
    expect(filter.isElective).toEqual({ $ne: true });
    expect(filter._id.$in.map(String).sort()).toEqual([SCI_A, SCI_C].sort());
    expect(update).toEqual({ $set: { isElective: true } });
    expect(r.changed).toBe(2);
  });

  test("hammasi allaqachon belgili — yozuv yo'q", async () => {
    setup([
      { _id: SCI_A, isElective: true },
      { _id: SCI_B, isElective: true },
      { _id: SCI_C, isElective: true },
    ]);
    const r = await backfill({ apply: true, backup: false });
    expect(r.toFlag).toHaveLength(0);
    expect(ScienceModel.updateMany).not.toHaveBeenCalled();
  });
});

describe("revert — zaxiradagi id'larda belgi olib tashlanadi", () => {
  test("aynan zaxira ro'yxatidagi fanlarda `$unset`", async () => {
    jest.spyOn(fs, "readFileSync").mockReturnValueOnce(JSON.stringify({ ids: [SCI_A, SCI_C, "yaroqsiz"] }));
    ScienceModel.updateMany.mockResolvedValue({ modifiedCount: 2 });
    const r = await revert({ file: "zaxira.json" });
    const [filter, update] = ScienceModel.updateMany.mock.calls[0];
    expect(filter._id.$in).toEqual([SCI_A, SCI_C]);
    expect(update).toEqual({ $unset: { isElective: "" } });
    expect(r).toEqual({ ids: 2, changed: 2 });
  });
});
