"use strict";

const { ROLES } = require("#config/constants");
const ScienceProgramModel = require("./scienceProgram.model");

const { CHAINS, FORM_VERSIONS } = ScienceProgramModel;

const VARIANT_FIELD = "formVersion";

const STEP_ROLES = {
  teacher: ROLES.OQITUVCHI,
  kafedra: ROLES.KAFEDRA_MUDIRI,
  arm: ROLES.ARM,
  methodical: ROLES.OQUV_USLUBIY_BOSHQARMA,
  prorektor: ROLES.PROREKTOR,
  rektor: ROLES.REKTOR,
  dean: ROLES.DEKAN,
};

const PROTOCOL_STEPS = ["kafedra", "dean", "prorektor", "rektor"];

module.exports = { CHAINS, FORM_VERSIONS, VARIANT_FIELD, STEP_ROLES, PROTOCOL_STEPS };
