"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["methodical", "dean", "prorektor", "rektor"];

const STEP_ROLES = {
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  dean: ROLES.DEKAN,
  prorektor: ROLES.PROREKTOR,
  rektor: ROLES.REKTOR,
};

module.exports = { STEP_ORDER, STEP_ROLES };
