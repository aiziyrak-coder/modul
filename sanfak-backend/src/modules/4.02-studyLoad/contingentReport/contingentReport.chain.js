"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["dean"];

const STEP_ROLES = {
  dean: ROLES.DEKAN,
};

const SUBMITTER_ROLES = [ROLES.DEKAN, ROLES.FAKULTET_KENGASH_KOTIBI];

const buildChainSteps = () => STEP_ORDER.map((step) => ({ step }));

module.exports = { STEP_ORDER, STEP_ROLES, SUBMITTER_ROLES, buildChainSteps };
