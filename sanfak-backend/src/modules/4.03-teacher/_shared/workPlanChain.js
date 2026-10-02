"use strict";

const { ROLES } = require("#config/constants");

const GROUPS = [
  { key: "G0", label: "O'qituvchi (rejaning egasi)", steps: ["teacher"] },
  {
    key: "G1",
    label:
      "Kafedra bloki (o'quv-uslubiy, ilmiy-tadqiqot, \"Ustoz-shogird\" mas'ullari)",
    steps: ["kafedraUslubiy", "kafedraIlmiy", "kafedraUstozShogird"],
  },
  { key: "G2", label: "Kafedra mudiri", steps: ["kafedraMudiri"] },
  { key: "G3", label: "O'quv-uslubiy boshqarma", steps: ["oquvUslubiy"] },
  { key: "G4", label: "Fakultet dekani", steps: ["dekan"] },
  {
    key: "G5",
    label: "Ichki nazorat va monitoring bo'limi",
    steps: ["ichkiNazorat"],
  },
];

const ROLE_STEP = {
  [ROLES.OQITUVCHI]: "teacher",
  [ROLES.KAFEDRA_USLUBIY_MASUL]: "kafedraUslubiy",
  [ROLES.KAFEDRA_ILMIY_MASUL]: "kafedraIlmiy",
  [ROLES.KAFEDRA_USTOZ_SHOGIRD_MASUL]: "kafedraUstozShogird",
  [ROLES.KAFEDRA_MUDIRI]: "kafedraMudiri",
  [ROLES.OQUV_USLUBIY_BOSHQARMA]: "oquvUslubiy",
  [ROLES.DEKAN]: "dekan",
  [ROLES.ICHKI_NAZORAT]: "ichkiNazorat",
};

const VISIBILITY_BYPASS = [ROLES.SUPER_ADMIN, ROLES.MODERATOR];
const FAIL_CLOSED = { $expr: { $eq: [1, 0] } };

function stepGroupIndex(step) {
  return GROUPS.findIndex((g) => g.steps.includes(step));
}

function priorStepsForGroup(groupIndex) {
  return GROUPS.slice(0, groupIndex).flatMap((g) => g.steps);
}

function isGroupComplete(plan, groupIndex) {
  const steps = GROUPS[groupIndex].steps;
  return steps.every(
    (step) => plan.approvals.find((s) => s.step === step)?.status === "approved",
  );
}

function nextGroupFor(plan) {
  for (let i = 0; i < GROUPS.length; i += 1) {
    if (!isGroupComplete(plan, i)) return GROUPS[i];
  }
  return null;
}

function canApprove(plan, step) {
  const groupIndex = stepGroupIndex(step);
  if (groupIndex === -1) return false;
  for (let i = 0; i < groupIndex; i += 1) {
    if (!isGroupComplete(plan, i)) return false;
  }
  return true;
}

function buildGroupedVisibilityFilter(role) {
  if (VISIBILITY_BYPASS.includes(role)) return {};

  const step = ROLE_STEP[role];
  if (!step) return FAIL_CLOSED;

  const groupIndex = stepGroupIndex(step);
  const priorSteps = priorStepsForGroup(groupIndex);
  if (priorSteps.length === 0) return {};

  return {
    approvals: {
      $not: {
        $elemMatch: { step: { $in: priorSteps }, status: { $ne: "approved" } },
      },
    },
  };
}

function andFilters(...filters) {
  const nonEmpty = filters.filter((f) => f && Object.keys(f).length > 0);
  if (nonEmpty.length === 0) return {};
  if (nonEmpty.length === 1) return { ...nonEmpty[0] };

  const seenKeys = new Set();
  let hasCollision = false;
  for (const f of nonEmpty) {
    for (const key of Object.keys(f)) {
      if (seenKeys.has(key)) {
        hasCollision = true;
        break;
      }
      seenKeys.add(key);
    }
    if (hasCollision) break;
  }

  return hasCollision ? { $and: nonEmpty } : Object.assign({}, ...nonEmpty);
}

module.exports = {
  GROUPS,
  ROLE_STEP,
  VISIBILITY_BYPASS,
  FAIL_CLOSED,
  stepGroupIndex,
  priorStepsForGroup,
  isGroupComplete,
  nextGroupFor,
  canApprove,
  buildGroupedVisibilityFilter,
  andFilters,
};
