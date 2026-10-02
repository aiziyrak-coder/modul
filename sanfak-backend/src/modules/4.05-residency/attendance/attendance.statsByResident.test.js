const path = require("path");

const CONTROLLER = path.join(__dirname, "attendance.controller.js");

let captured;
let controller;

beforeEach(() => {
  jest.resetModules();
  captured = null;

  jest.doMock("#modules/4.05-residency/attendance/attendance.model.js", () => ({
    aggregate: (pipeline) => ({ __pipeline: pipeline }),
    aggregatePaginate: (agg, options) => {
      captured = { pipeline: agg.__pipeline, options };
      return Promise.resolve({ docs: [], totalDocs: 0, page: 1, totalPages: 0 });
    },
  }));

  jest.doMock("#modules/4.05-residency/_services/attendanceFilter.js", () => ({
    buildAttendanceFilter: async () => ({ filter: { active: true }, denied: false }),
  }), { virtual: true });

  controller = require(CONTROLLER);
});

const run = async () => {
  const req = { query: { page: 1, limit: 10 }, user: { _id: "u1" } };
  const res = { status: () => res, json: () => res };
  await controller.getJournalStatsByResident(req, res, (e) => {
    throw e;
  });
  return captured;
};
const stage = (c, name) => c.pipeline.find((s) => Object.keys(s)[0] === name)[name];

describe("getJournalStatsByResident — sahifalash sanog'i", () => {
  it("`useFacet: false` uzatiladi — aks holda sanoq `$group` dan OLDIN olinadi", async () => {
    const c = await run();
    expect(c).not.toBeNull();
    expect(c.options.useFacet).toBe(false);
  });

  it("quvurda `$group` bor — 1-band aynan shuning uchun kerak", async () => {
    const c = await run();
    const stages = c.pipeline.map((s) => Object.keys(s)[0]);
    expect(stages).toContain("$group");
  });
});

describe("getJournalStatsByResident — «O'rtacha ball» (LSC-Q6=A)", () => {
  const SCORED_PRESENT = {
    $and: [{ $eq: ["$status", "present"] }, { $ne: [{ $ifNull: ["$score", null] }, null] }],
  };

  it("`$group` — scoreAvg/scoredCount faqat ballangan `present` bo'yicha, scoreSum saqlanadi", async () => {
    const group = stage(await run(), "$group");
    expect(group.scoredCount).toEqual({ $sum: { $cond: [SCORED_PRESENT, 1, 0] } });
    expect(group.scoreAvg).toEqual({ $avg: { $cond: [SCORED_PRESENT, "$score", null] } });
    expect(group.scoreSum).toEqual({ $sum: { $ifNull: ["$score", 0] } });
  });

  it("`$project` — scoreAvg, scoredCount VA scoreSum chiqadi (additiv)", async () => {
    const project = stage(await run(), "$project");
    expect(project).toMatchObject({ scoreAvg: 1, scoredCount: 1, scoreSum: 1 });
  });
});
