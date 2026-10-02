"use strict";

const { ROLES } = require("#config/constants");
const { CHAIN_REGISTRY } = require("./chainRegistry");

const VISIBILITY_BYPASS = [ROLES.SUPER_ADMIN, ROLES.MODERATOR];
const FAIL_CLOSED = { $expr: { $eq: [1, 0] } };
const failClosed = () => ({ ...FAIL_CLOSED });

function priorStepsFilter(stepsField, chain, myStep) {
  const priorSteps = chain.slice(0, chain.indexOf(myStep));
  if (priorSteps.length === 0) return {};
  return {
    [stepsField]: {
      $not: {
        $elemMatch: { step: { $in: priorSteps }, status: { $ne: "approved" } },
      },
    },
  };
}

function flatRoleFilter(entry, userRole) {
  if (entry.observerRoles.includes(userRole)) {
    return { status: { $nin: [...entry.draftStatuses, "rejected"] } };
  }
  if (Array.isArray(entry.submitterRoles) && entry.submitterRoles.includes(userRole)) {
    return {};
  }
  return null;
}

function buildChainVisibilityFilter(entityKey, userRole, opts = {}) {
  const entry = CHAIN_REGISTRY[entityKey];
  if (!entry) {
    throw new Error(`chainVisibility: registrda yo'q entity — "${entityKey}"`);
  }

  if (VISIBILITY_BYPASS.includes(userRole)) return {};

  const flat = flatRoleFilter(entry, userRole);
  if (flat) return flat;

  const ownerField = entry.ownerRoles && entry.ownerRoles[userRole];
  if (ownerField) {
    if (!opts.userId) return failClosed();
    return { [ownerField]: opts.userId };
  }

  const { stepsField, chains, variantField } = entry;

  if (!variantField) {
    const chain = chains.default;
    const myStep = chain.find((step) => entry.stepRoles[step] === userRole);
    if (!myStep) return failClosed();
    return priorStepsFilter(stepsField, chain, myStep);
  }

  const branches = Object.keys(chains).map((variant) => {
    const chain = chains[variant];
    const selector =
      variant === entry.defaultVariant
        ? { [variantField]: { $in: [variant, null] } }
        : { [variantField]: variant };
    const myStep = chain.find((step) => entry.stepRoles[step] === userRole);
    if (!myStep) return { ...selector, ...FAIL_CLOSED };
    return {
      ...selector,
      ...priorStepsFilter(stepsField, chain, myStep),
    };
  });

  return { $or: branches };
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
  buildChainVisibilityFilter,
  andFilters,
  VISIBILITY_BYPASS,
  FAIL_CLOSED,
};
