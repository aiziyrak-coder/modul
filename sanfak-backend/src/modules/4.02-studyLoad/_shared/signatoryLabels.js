"use strict";

const WORKLOAD_STEP_LABELS = Object.freeze({
  methodical: "O'quv-uslubiy boshqarma boshlig'i",
  kafedra: "Kafedra mudiri",
  financial: "Reja moliya bo'limi boshlig'i",
  prorektor: "O'quv ishlari bo'yicha prorektor",
  rektor: "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
});

const WORKLOAD_DISTRIBUTION_STEP_LABELS = Object.freeze({
  kafedra: "Kafedra mudiri",
  methodical: "O'quv-uslubiy boshqarma boshlig'i",
  financial: "Reja-moliya bo'limi boshlig'i",
  dean: "Fakultet dekani",
  prorektor: "O'quv ishlari bo'yicha prorektor",
});

const SYLLABUS_STEP_LABELS = Object.freeze({
  kafedra: "Kafedra mudiri",
  arm: "Axborot-resurs markazi boshlig'i",
  methodical: "O'quv-uslubiy boshqarma boshlig'i",
  dean: "Fakultet dekani",
  prorektor: "O'quv ishlari bo'yicha prorektor",
  teacher: "Tuzuvchi",
});

const SCIENCE_PROGRAM_STEP_LABELS = Object.freeze({
  teacher: "Fan o'qituvchisi",
  kafedra: "Kafedra mudiri",
  arm: "Axborot-resurs markazi boshlig'i",
  methodical: "O'quv-uslubiy boshqarma boshlig'i",
  prorektor: "O'quv ishlari bo'yicha prorektor",
  rektor: "Rektor",
  dean: "Fakultet dekani",
});

const WORKING_SCHEDULE_STEP_LABELS = Object.freeze({
  methodical: "O'quv-uslubiy boshqarma boshlig'i",
  dean: "Fakultet dekani",
  prorektor: "O'quv ishlari bo'yicha prorektor",
  rektor: "Farg'ona jamoat salomatligi tibbiyot instituti rektori",
});

const CONTINGENT_REPORT_STEP_LABELS = Object.freeze({
  dean: "Fakultet dekani",
});

const TEACHER_LEAVE_STEP_LABELS = Object.freeze({
  kafedra: "Kafedra mudiri",
});

const LABELS_BY_KIND = Object.freeze({
  workload: WORKLOAD_STEP_LABELS,
  teacherLeave: TEACHER_LEAVE_STEP_LABELS,
  contingentReport: CONTINGENT_REPORT_STEP_LABELS,
  workloadSummary: WORKLOAD_STEP_LABELS,
  workloadDistribution: WORKLOAD_DISTRIBUTION_STEP_LABELS,
  syllabus: SYLLABUS_STEP_LABELS,
  scienceProgram: SCIENCE_PROGRAM_STEP_LABELS,
  workingSchedule: WORKING_SCHEDULE_STEP_LABELS,
});

function resolveStepLabel(kind, step) {
  const map = LABELS_BY_KIND[kind];
  if (!map || !step) return null;
  return map[step] || null;
}

module.exports = {
  WORKLOAD_STEP_LABELS,
  WORKLOAD_DISTRIBUTION_STEP_LABELS,
  SYLLABUS_STEP_LABELS,
  SCIENCE_PROGRAM_STEP_LABELS,
  WORKING_SCHEDULE_STEP_LABELS,
  CONTINGENT_REPORT_STEP_LABELS,
  TEACHER_LEAVE_STEP_LABELS,
  resolveStepLabel,
};
