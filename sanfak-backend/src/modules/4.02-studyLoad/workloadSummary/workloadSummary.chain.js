"use strict";

const { ROLES } = require("#config/constants");

const STEP_ORDER = ["methodical", "financial", "prorektor", "rektor"];

const STEP_ROLES = {
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  financial: ROLES.REJA_MOLIYA,
  prorektor: ROLES.PROREKTOR,
  rektor: ROLES.REKTOR,
};

const REVOCABLE_STATUSES = ["approved", "superseded"];

const DELETABLE_STATUSES = ["draft", "rejected"];

module.exports = { STEP_ORDER, STEP_ROLES, REVOCABLE_STATUSES, DELETABLE_STATUSES };
