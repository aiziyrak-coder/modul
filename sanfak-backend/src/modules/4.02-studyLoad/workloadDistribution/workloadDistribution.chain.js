"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["kafedra", "methodical", "financial", "dean", "prorektor"];

const STEP_ROLES = {
  kafedra: ROLES.KAFEDRA_MUDIRI,
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  financial: ROLES.REJA_MOLIYA,
  dean: ROLES.DEKAN,
  prorektor: ROLES.PROREKTOR,
};

module.exports = { STEP_ORDER, STEP_ROLES };
