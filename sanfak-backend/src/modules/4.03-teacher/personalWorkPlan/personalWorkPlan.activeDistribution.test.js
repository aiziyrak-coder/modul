"use strict";

jest.mock("./personalWorkPlan.model");
jest.mock("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
jest.mock("#references/science/science.model");
jest.mock("#references/academicYear/academicYear.model");

const PersonalWorkPlanModel = require("./personalWorkPlan.model");
const WorkloadDistribution = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const AcademicYearModel = require("#references/academicYear/academicYear.model");
const Controller = require("./personalWorkPlan.controller");

test("taqsimot so'rovi `active: true` bilan (superseded versiya chiqariladi)", async () => {
  PersonalWorkPlanModel.findOne = jest.fn().mockResolvedValue(null);
  WorkloadDistribution.find = jest.fn().mockResolvedValue([]);
  AcademicYearModel.findById = jest.fn().mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ title: "2026/2027" }) }),
  });
  const res = { status: jest.fn(), json: jest.fn() };
  res.status.mockReturnValue(res);

  await Controller.generateFromWorkload(
    { user: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa" }, body: { teacher: "aaaaaaaaaaaaaaaaaaaaaaaa", academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb" } },
    res,
    jest.fn(),
  );

  expect(WorkloadDistribution.find.mock.calls[0][0]).toMatchObject({
    academicYear: "bbbbbbbbbbbbbbbbbbbbbbbb",
    active: true,
  });
  expect(res.status).toHaveBeenCalledWith(404);
});
