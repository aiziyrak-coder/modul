"use strict";

jest.mock("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
jest.mock("#references/group/group.model");
jest.mock("#modules/4.02-studyLoad/_services/staffPositionsCalculator", () => ({
  buildStaffPositions: jest.fn().mockResolvedValue({ items: [], totalPositions: 0, hourly: 0 }),
}));
jest.mock("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model", () => ({
  findOne: jest.fn(),
}));

const ContingentModel = require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model");
const WorkloadModel = require("./workload.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const GroupModel = require("#references/group/group.model");
const Controller = require("./workload.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildWorkload = () => ({
  _id: "draft1",
  status: "draft",
  department: "dep1",
  academicYear: "ay1",
  needsRecalculation: false,
  directions: [
    {
      direction: "dir1",
      blocks: [
        {
          course: 1,
          student: 0,
          studyWork: {
            group: 0,
            stream: 0,
            classTypes: [
              { slug: "maruza", stream: 10, total: 0 },
              { slug: "amaliy", stream: 5, total: 0 },
            ],
            items: [],
          },
          otherWork: { items: [] },
          leadership: 0,
          totalHour: 0,
        },
      ],
    },
  ],
  save: jest.fn().mockResolvedValue(undefined),
});

const run = async () => {
  const res = createRes();
  await Controller.recalculateBulk({ body: { all: true }, scope: {}, user: { _id: "u1" } }, res, jest.fn());
  return res.json.mock.calls[0][0];
};

let wl;
beforeEach(() => {
  jest.clearAllMocks();
  wl = buildWorkload();
  jest.spyOn(WorkloadModel, "find").mockResolvedValue([wl]);
  WorkingScheduleModel.find = jest.fn().mockReturnValue({
    select: jest.fn().mockResolvedValue([
      { _id: "ws1", currentCourse: 1, direction: "dir1", courseRef: "c1", groups: ["g1", "g2"] },
    ]),
  });
  const groups = [{ studentNumber: 20, lang: "l1" }, { studentNumber: 10, lang: "l1" }];
  GroupModel.find = jest.fn(() =>
    Object.assign(Promise.resolve(groups), { distinct: () => Promise.resolve(["g1", "g2"]) }),
  );
});

const contingentRows = (streams) =>
  ContingentModel.findOne.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ rows: [{ direction: "dir1", course: "c1", streams }] }) }),
  });

describe("recalculateBulk — CONTINGENT_STALE (ADR-037 K2)", () => {
  test("eskirgan qator (g1+g9, jadvalda g1+g2) — hozirgi qoida + warnings[] da workloadId bilan", async () => {
    contingentRows([{ number: 1, groups: ["g1"] }, { number: 2, groups: ["g9"] }]);
    const body = await run();

    const block = wl.directions[0].blocks[0];
    expect(block).toMatchObject({ totalHour: 20, studyWork: { group: 2, stream: 1 } });
    expect(body.warnings).toEqual([
      expect.objectContaining({ code: "CONTINGENT_STALE", workloadId: "draft1", direction: "dir1", course: 1 }),
    ]);
    expect(body.warnings[0].message).toMatch(/1-kurs qatori/);
  });

  test("mos qator (g1 | g2) — 2 oqim olinadi, ogohlantirish YO'Q", async () => {
    contingentRows([{ number: 1, groups: ["g1"] }, { number: 2, groups: ["g2"] }]);
    const body = await run();

    expect(wl.directions[0].blocks[0]).toMatchObject({ totalHour: 30, studyWork: { stream: 2 } });
    expect(body.warnings).toEqual([]);
  });
});
