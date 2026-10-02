"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["kafedra", "arm", "methodical", "dean", "prorektor"];

const STEP_ROLES = {
  kafedra: ROLES.KAFEDRA_MUDIRI,
  arm: ROLES.ARM,
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  dean: ROLES.DEKAN,
  prorektor: ROLES.PROREKTOR,
};

module.exports = { STEP_ORDER, STEP_ROLES };
