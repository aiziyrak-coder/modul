"use strict";

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const WorkloadSummaryModel = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const { ROLES } = require("#config/constants");
const {
  ACTIVE_STATUSES,
  findActiveDependents,
  markInactiveDependentsStale,
} = require("./finalStepRevoke.dependents");

const query = (rows) => ({
  select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(rows) }),
});

const spyFind = (Model, rows = []) => jest.spyOn(Model, "find").mockReturnValue(query(rows));
const spyUpdate = (Model, modifiedCount = 0) =>
  jest.spyOn(Model, "updateMany").mockResolvedValue({ modifiedCount });

afterEach(() => jest.restoreAllMocks());

const GLOBAL = { _id: "u-r", role: { title: ROLES.REKTOR, scopeLevel: "global" } };

describe("findActiveDependents", () => {
  test("workingSchedule → shu rejaning ishchi-rejalariga bog'langan FAOL yuklamalar", async () => {
    spyFind(WorkingPlanModel, [{ _id: "p1" }, { _id: "p2" }]);
    const wl = spyFind(WorkloadModel, [{ _id: "w1", title: "Anatomiya kafedrasi", status: "approved" }]);

    const out = await findActiveDependents("workingSchedule", { _id: "ws1" }, GLOBAL);

    expect(WorkingPlanModel.find).toHaveBeenCalledWith({ workingSchedule: "ws1" });
    expect(wl.mock.calls[0][0]).toEqual({
      "directions.workingPlan": { $in: ["p1", "p2"] },
      status: { $in: ACTIVE_STATUSES },
      active: { $ne: false },
    });
    expect(out).toEqual([{ type: "workload", id: "w1", title: "Anatomiya kafedrasi", status: "approved" }]);
  });

  test("workingSchedule — ishchi-reja yo'q → so'rov yo'q, bo'sh", async () => {
    spyFind(WorkingPlanModel, []);
    const wl = spyFind(WorkloadModel, []);
    expect(await findActiveDependents("workingSchedule", { _id: "ws1" }, GLOBAL)).toEqual([]);
    expect(wl).not.toHaveBeenCalled();
  });

  test("workload → faol taqsimot + faol hisobot (surat — `includedWorkloads`)", async () => {
    const wd = spyFind(WorkloadDistributionModel, [{ _id: "d1", title: null, status: "in_review" }]);
    const ws = spyFind(WorkloadSummaryModel, [{ _id: "s1", academicYearTitle: "2026/2027", status: "approved" }]);

    const out = await findActiveDependents("workload", { _id: "w1" }, GLOBAL);

    expect(wd.mock.calls[0][0]).toMatchObject({ workload: "w1" });
    expect(ws.mock.calls[0][0]).toMatchObject({ "includedWorkloads.workload": "w1" });
    expect(out).toEqual([
      { type: "workloadDistribution", id: "d1", title: null, status: "in_review" },
      { type: "workloadSummary", id: "s1", title: "2026/2027", status: "approved" },
    ]);
  });

  test("scienceProgram → shu fan dasturidan tuzilgan faol sillabuslar", async () => {
    const sy = spyFind(SyllabusModel, [{ _id: "y1", scienceLabel: "Anatomiya", status: "approved" }]);
    const out = await findActiveDependents("scienceProgram", { _id: "sp1" }, GLOBAL);
    expect(sy.mock.calls[0][0]).toMatchObject({ scienceProgram: "sp1" });
    expect(out[0]).toEqual({ type: "syllabus", id: "y1", title: "Anatomiya", status: "approved" });
  });

  test.each(["syllabus", "workloadDistribution", "workloadSummary", "contingentReport"])(
    "%s — saqlangan bog'liqlik yo'q → bo'sh",
    async (entity) => {
      expect(await findActiveDependents(entity, { _id: "x" }, GLOBAL)).toEqual([]);
    },
  );
});

describe("findActiveDependents — so'rovchi doirasi", () => {
  const FAC_A = "fa1";
  const DEKAN_A = { _id: "u-d", role: { title: ROLES.DEKAN, scopeLevel: "faculty" }, faculty: FAC_A };
  const rows = [
    { _id: "y1", scienceLabel: "Anatomiya", status: "approved" },
    { _id: "y2", scienceLabel: "Fiziologiya", status: "in_review" },
    { _id: "y3", scienceLabel: "Gistologiya", status: "approved" },
  ];

  test("dekan: o'z fakulteti — to'liq; begona fakultet — faqat soni (hidden)", async () => {
    const sy = jest
      .spyOn(SyllabusModel, "find")
      .mockReturnValueOnce(query(rows))
      .mockReturnValueOnce(query([{ _id: "y2" }]));

    const out = await findActiveDependents("scienceProgram", { _id: "sp1" }, DEKAN_A);

    expect(sy.mock.calls[1][0]).toEqual({
      $and: [{ _id: { $in: ["y1", "y2", "y3"] } }, { faculty: FAC_A }],
    });
    expect(out).toEqual([
      { type: "syllabus", id: "y2", title: "Fiziologiya", status: "in_review" },
      { type: "syllabus", count: 2, hidden: true },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/y1|y3|Anatomiya|Gistologiya/);
  });

  test("foydalanuvchi yo'q → hammasi yashirin, lekin ro'yxat bo'sh EMAS (to'sadi)", async () => {
    spyFind(SyllabusModel, rows);
    expect(await findActiveDependents("scienceProgram", { _id: "sp1" })).toEqual([
      { type: "syllabus", count: 3, hidden: true },
    ]);
  });

  test("scope aniqlanmadi (dekanda fakultet yo'q → 403) → yashirin", async () => {
    spyFind(SyllabusModel, rows.slice(0, 1));
    const noFaculty = { _id: "u-x", role: { title: ROLES.DEKAN, scopeLevel: "faculty" } };
    expect(await findActiveDependents("scienceProgram", { _id: "sp1" }, noFaculty)).toEqual([
      { type: "syllabus", count: 1, hidden: true },
    ]);
  });

  test("super_admin — to'liq, qo'shimcha so'rovsiz", async () => {
    const sy = spyFind(SyllabusModel, rows.slice(0, 1));
    const sa = { _id: "u-s", role: { title: ROLES.SUPER_ADMIN } };
    const out = await findActiveDependents("scienceProgram", { _id: "sp1" }, sa);
    expect(sy).toHaveBeenCalledTimes(1);
    expect(out).toEqual([{ type: "syllabus", id: "y1", title: "Anatomiya", status: "approved" }]);
  });
});

describe("markInactiveDependentsStale", () => {
  test("workload → faqat taqsimot belgilanadi (hisobotda maydon yo'q)", async () => {
    const wd = spyUpdate(WorkloadDistributionModel, 2);
    const ws = spyUpdate(WorkloadSummaryModel, 0);

    expect(await markInactiveDependentsStale("workload", { _id: "w1" })).toBe(2);
    expect(wd).toHaveBeenCalledWith(
      { workload: "w1", status: { $nin: [...ACTIVE_STATUSES, "superseded"] }, active: { $ne: false } },
      { $set: { needsRecalculation: true } },
    );
    expect(ws).not.toHaveBeenCalled();
  });

  test("workingSchedule → faol bo'lmagan yuklamalar belgilanadi", async () => {
    spyFind(WorkingPlanModel, [{ _id: "p1" }]);
    const wl = spyUpdate(WorkloadModel, 1);
    expect(await markInactiveDependentsStale("workingSchedule", { _id: "ws1" })).toBe(1);
    expect(wl.mock.calls[0][0]).toMatchObject({ "directions.workingPlan": { $in: ["p1"] } });
  });

  test.each(["workingSchedule", "workload"])(
    "%s → `superseded` bog'liq hujjat belgilanmaydi",
    async (entity) => {
      spyFind(WorkingPlanModel, [{ _id: "p1" }]);
      const wl = spyUpdate(WorkloadModel, 0);
      const wd = spyUpdate(WorkloadDistributionModel, 0);
      await markInactiveDependentsStale(entity, { _id: "x1" });
      const spy = entity === "workload" ? wd : wl;
      expect(spy.mock.calls[0][0].status.$nin).toEqual(expect.arrayContaining(["superseded", ...ACTIVE_STATUSES]));
    },
  );

  test("scienceProgram → sillabusda maydon yo'q, hech narsa yozilmaydi", async () => {
    const sy = spyUpdate(SyllabusModel, 0);
    expect(await markInactiveDependentsStale("scienceProgram", { _id: "sp1" })).toBe(0);
    expect(sy).not.toHaveBeenCalled();
  });
});
