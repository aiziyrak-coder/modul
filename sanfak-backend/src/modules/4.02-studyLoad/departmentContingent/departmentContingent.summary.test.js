"use strict";

jest.mock("#references/group/group.model", () => ({ aggregate: jest.fn() }));

const GroupModel = require("#references/group/group.model");
const { departmentBlock, loadCohorts } = require("./departmentContingent.summary");

const COURSE = "c".repeat(24);
const YEAR = "a".repeat(24);

describe("departmentBlock — kafedra qatori", () => {
  test("`courseId` = qatorning `course` ObjectId'si; eski maydonlar saqlanadi", () => {
    const doc = {
      department: { _id: "dep1", title: "Anatomiya" },
      updatedAt: "2026-09-23",
      rows: [{ direction: "d1", course: COURSE, courseNum: 2, streams: [{ number: 1, groups: ["g1", "g2"] }] }],
    };
    const groupsById = new Map([["g1", { studentNumber: 20 }], ["g2", { studentNumber: 10 }]]);

    expect(departmentBlock(doc, groupsById).rows[0]).toEqual({
      direction: "d1",
      courseNum: 2,
      courseId: COURSE,
      groupCount: 2,
      studentCount: 30,
      streamCount: 1,
    });
  });
});

describe("loadCohorts — kohorta", () => {
  test("$project `courseId` ni `course` bilan birga qaytaradi", async () => {
    GroupModel.aggregate.mockResolvedValue([]);
    await loadCohorts(YEAR);

    const pipeline = GroupModel.aggregate.mock.calls[0][0];
    const project = pipeline.find((stage) => stage.$project).$project;
    expect(project).toMatchObject({ course: "$_id.course", courseId: "$_id.course", courseTitle: expect.anything() });
  });
});
