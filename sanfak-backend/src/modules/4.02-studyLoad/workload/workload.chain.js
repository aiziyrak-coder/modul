"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["methodical", "kafedra", "financial", "prorektor", "rektor"];

const STEP_ROLES = {
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  kafedra: ROLES.KAFEDRA_MUDIRI,
  financial: ROLES.REJA_MOLIYA,
  prorektor: ROLES.PROREKTOR,
  rektor: ROLES.REKTOR,
};

module.exports = { STEP_ORDER, STEP_ROLES };
