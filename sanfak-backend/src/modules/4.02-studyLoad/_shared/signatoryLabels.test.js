"use strict";

const {
  WORKLOAD_STEP_LABELS,
  WORKLOAD_DISTRIBUTION_STEP_LABELS,
  SYLLABUS_STEP_LABELS,
  SCIENCE_PROGRAM_STEP_LABELS,
  WORKING_SCHEDULE_STEP_LABELS,
  CONTINGENT_REPORT_STEP_LABELS,
  resolveStepLabel,
} = require("./signatoryLabels");

const WorkloadModel = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistributionModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");
const SyllabusModel = require("#modules/4.02-studyLoad/syllabus/syllabus.model");
const ScienceProgramModel = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const ContingentReportModel = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");

const stepEnum = (Model, field = "approvalSteps") =>
  Model.schema.path(field).schema.path("step").enumValues;

describe("signatoryLabels — har kind zanjirining BARCHA step'lari xaritada bor", () => {
  test("workload — WORKLOAD_STEP_LABELS", () => {
    const enumValues = stepEnum(WorkloadModel);
    expect(enumValues.length).toBeGreaterThan(0);
    for (const step of enumValues) {
      expect(WORKLOAD_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });

  test("workloadDistribution — WORKLOAD_DISTRIBUTION_STEP_LABELS", () => {
    const enumValues = stepEnum(WorkloadDistributionModel);
    expect(enumValues.length).toBeGreaterThan(0);
    for (const step of enumValues) {
      expect(WORKLOAD_DISTRIBUTION_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });

  test("syllabus — SYLLABUS_STEP_LABELS", () => {
    const enumValues = stepEnum(SyllabusModel);
    expect(enumValues.length).toBeGreaterThan(0);
    for (const step of enumValues) {
      expect(SYLLABUS_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });

  test("scienceProgram — SCIENCE_PROGRAM_STEP_LABELS (v259 ∪ v142)", () => {
    const enumValues = stepEnum(ScienceProgramModel);
    expect(enumValues.length).toBeGreaterThan(0);
    for (const step of enumValues) {
      expect(SCIENCE_PROGRAM_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });

  test("workingSchedule — WORKING_SCHEDULE_STEP_LABELS", () => {
    const enumValues = stepEnum(WorkingScheduleModel, "approvalHistory");
    expect(enumValues.length).toBeGreaterThan(0);
    for (const step of enumValues) {
      expect(WORKING_SCHEDULE_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });

  test("contingentReport — CONTINGENT_REPORT_STEP_LABELS", () => {
    const enumValues = stepEnum(ContingentReportModel);
    expect(enumValues).toEqual(["dean"]);
    for (const step of enumValues) {
      expect(CONTINGENT_REPORT_STEP_LABELS[step]).toEqual(expect.any(String));
    }
  });
});

describe("resolveStepLabel — 5 kind", () => {
  test.each([
    ["workload", "kafedra", "Kafedra mudiri"],
    ["workloadDistribution", "kafedra", "Kafedra mudiri"],
    ["syllabus", "kafedra", "Kafedra mudiri"],
    ["scienceProgram", "kafedra", "Kafedra mudiri"],
    ["scienceProgram", "teacher", "Fan o'qituvchisi"],
    ["syllabus", "teacher", "Tuzuvchi"],
    ["workingSchedule", "methodical", "O'quv-uslubiy boshqarma boshlig'i"],
    ["workingSchedule", "dean", "Fakultet dekani"],
    ["contingentReport", "dean", "Fakultet dekani"],
    ["workingSchedule", "prorektor", "O'quv ishlari bo'yicha prorektor"],
    [
      "workingSchedule",
      "rektor",
      "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
    ],
  ])("resolveStepLabel(%s, %s) === %s", (kind, step, expected) => {
    expect(resolveStepLabel(kind, step)).toBe(expected);
  });

  test("noma'lum kind — null (throw yo'q)", () => {
    expect(resolveStepLabel("noExist", "kafedra")).toBeNull();
  });

  test("noma'lum step — null (throw yo'q)", () => {
    expect(resolveStepLabel("workload", "noExist")).toBeNull();
  });
});
