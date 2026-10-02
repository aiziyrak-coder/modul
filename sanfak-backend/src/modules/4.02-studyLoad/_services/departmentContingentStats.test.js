"use strict";

const fs = require("fs");
const path = require("path");

jest.mock("./groupStatsResolver", () => ({ getGroupStats: jest.fn() }));
jest.mock("./scheduleGroupsResolver", () => ({ resolveScheduleGroups: jest.fn() }));
jest.mock("#references/group/group.model", () => ({ find: jest.fn() }));
jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(),
}));

const { getGroupStats } = require("./groupStatsResolver");
const { resolveScheduleGroups } = require("./scheduleGroupsResolver");
const GroupModel = require("#references/group/group.model");
const ContingentModel = require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model");
const { createScheduleStatsResolver } = require("./departmentContingentStats");

const BASE = { studentCount: 90, groupCount: 4, streamCount: 1 };
const SCHEDULE = { direction: "d1", courseRef: "c2", currentCourse: 2 };
const CTX = { department: "dep1", academicYear: "y1" };

const contingentReturns = (doc) =>
  ContingentModel.findOne.mockReturnValue({ select: () => ({ lean: () => Promise.resolve(doc) }) });
const activeGroupsAre = (ids) =>
  GroupModel.find.mockReturnValue({ distinct: () => Promise.resolve(ids) });

beforeEach(() => {
  jest.clearAllMocks();
  resolveScheduleGroups.mockResolvedValue(["g1", "g2", "g3", "g4"]);
  getGroupStats.mockResolvedValue(BASE);
});

describe("createScheduleStatsResolver — xulq", () => {
  test("kontingent yo'q — getGroupStats natijasi o'zgarmaydi", async () => {
    contingentReturns(null);
    const stats = await createScheduleStatsResolver(CTX)(SCHEDULE);
    expect(stats).toEqual({ ...BASE, contingent: { source: "none" } });
    expect(GroupModel.find).not.toHaveBeenCalled();
  });

  test("shu yo'nalish+kurs qatori yo'q — o'zgarmaydi", async () => {
    contingentReturns({ rows: [{ direction: "d1", course: "c9", streams: [{ number: 1, groups: ["g1"] }] }] });
    const stats = await createScheduleStatsResolver(CTX)(SCHEDULE);
    expect(stats.streamCount).toBe(1);
    expect(stats.contingent.source).toBe("none");
  });

  test("mos qator — faqat streamCount (guruh/talaba soni jadvaldan)", async () => {
    contingentReturns({
      rows: [{ direction: "d1", course: "c2", streams: [{ number: 1, groups: ["g1", "g2"] }, { number: 2, groups: ["g3", "g4"] }] }],
    });
    activeGroupsAre(["g1", "g2", "g3", "g4"]);
    const stats = await createScheduleStatsResolver(CTX)(SCHEDULE);
    expect(stats).toEqual({ studentCount: 90, groupCount: 4, streamCount: 2, contingent: { source: "contingent" } });
  });

  test("eskirgan qator (jadvalda yangi guruh) — hozirgi qoida + stale", async () => {
    contingentReturns({ rows: [{ direction: "d1", course: "c2", streams: [{ number: 1, groups: ["g1"] }, { number: 2, groups: ["g2"] }] }] });
    activeGroupsAre(["g1", "g2", "g3", "g4"]);
    const stats = await createScheduleStatsResolver(CTX)(SCHEDULE);
    expect(stats.streamCount).toBe(1);
    expect(stats.contingent.source).toBe("stale");
  });

  test("kontingent hujjati bir yuklama uchun BIR MARTA o'qiladi", async () => {
    contingentReturns(null);
    const statsFor = createScheduleStatsResolver(CTX);
    await statsFor(SCHEDULE);
    await statsFor({ ...SCHEDULE, courseRef: "c3" });
    expect(ContingentModel.findOne).toHaveBeenCalledTimes(1);
  });

  test("kafedra yoki yil yo'q — DB so'rovsiz, o'zgarmaydi", async () => {
    const stats = await createScheduleStatsResolver({ department: null, academicYear: "y1" })(SCHEDULE);
    expect(stats.contingent.source).toBe("none");
    expect(ContingentModel.findOne).not.toHaveBeenCalled();
  });
});

describe("K1 manba-skaner — uchala yo'l yagona resolverdan", () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, rel), "utf8");
  const count = (src, re) => (src.match(re) || []).length;

  test("workload.controller.js — to'g'ridan getGroupStats YO'Q, resolver 2 joyda", () => {
    const src = read("../workload/workload.controller.js");
    expect(count(src, /getGroupStats\(/g)).toBe(0);
    expect(count(src, /createScheduleStatsResolver\(\{/g)).toBe(2);
  });

  test("workloadRecalculator.js — to'g'ridan getGroupStats YO'Q, resolver 1 joyda", () => {
    const src = read("./workloadRecalculator.js");
    expect(count(src, /getGroupStats\(/g)).toBe(0);
    expect(count(src, /createScheduleStatsResolver\(\{/g)).toBe(1);
  });
});
