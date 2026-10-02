"use strict";

const { ROLES } = require("#config/constants");

const workloadChain = require("#modules/4.02-studyLoad/workload/workload.chain");
const workingScheduleChain = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.chain");
const workloadDistributionChain = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.chain");
const syllabusChain = require("#modules/4.02-studyLoad/syllabus/syllabus.chain");
const scienceProgramChain = require("#modules/4.02-studyLoad/scienceProgram/scienceProgram.chain");
const workloadSummaryChain = require("#modules/4.02-studyLoad/workloadSummary/workloadSummary.chain");
const contingentReportChain = require("#modules/4.02-studyLoad/contingentReport/contingentReport.chain");

const CHAIN_REGISTRY = {
  workload: {
    stepsField: "approvalSteps",
    chains: { default: workloadChain.STEP_ORDER },
    stepRoles: workloadChain.STEP_ROLES,
    draftStatuses: ["draft", "new"],
    observerRoles: [],
  },
  workingSchedule: {
    stepsField: "approvalHistory",
    chains: { default: workingScheduleChain.STEP_ORDER },
    stepRoles: workingScheduleChain.STEP_ROLES,
    draftStatuses: ["draft"],
    observerRoles: [ROLES.KAFEDRA_MUDIRI],
  },
  workloadDistribution: {
    stepsField: "approvalSteps",
    chains: { default: workloadDistributionChain.STEP_ORDER },
    stepRoles: workloadDistributionChain.STEP_ROLES,
    draftStatuses: ["draft", "new"],
    observerRoles: [ROLES.KADRLAR, ROLES.OQITUVCHI, ROLES.REKTOR],
  },
  syllabus: {
    stepsField: "approvalSteps",
    chains: { default: syllabusChain.STEP_ORDER },
    stepRoles: syllabusChain.STEP_ROLES,
    draftStatuses: ["draft", "new"],
    observerRoles: [ROLES.REKTOR],
    ownerRoles: { [ROLES.OQITUVCHI]: "author.teacher" },
  },
  scienceProgram: {
    stepsField: "approvalSteps",
    chains: scienceProgramChain.CHAINS,
    variantField: scienceProgramChain.VARIANT_FIELD,
    defaultVariant: "v259",
    stepRoles: scienceProgramChain.STEP_ROLES,
    draftStatuses: ["draft"],
    observerRoles: [ROLES.REKTOR, ROLES.PROREKTOR],
  },
  workloadSummary: {
    stepsField: "approvalSteps",
    chains: { default: workloadSummaryChain.STEP_ORDER },
    stepRoles: workloadSummaryChain.STEP_ROLES,
    draftStatuses: ["draft"],
    observerRoles: [],
  },
  contingentReport: {
    stepsField: "approvalSteps",
    chains: { default: contingentReportChain.STEP_ORDER },
    stepRoles: contingentReportChain.STEP_ROLES,
    draftStatuses: ["draft"],
    observerRoles: [
      ROLES.OQUV_USLUBIY_BOSHQARMA,
      ROLES.REKTOR,
      ROLES.PROREKTOR,
    ],
    submitterRoles: [ROLES.FAKULTET_KENGASH_KOTIBI],
  },
};

module.exports = { CHAIN_REGISTRY };
