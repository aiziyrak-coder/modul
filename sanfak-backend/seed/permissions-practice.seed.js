"use strict";

const {
  runModuleSeed,
  CRUD_ACTIONS,
  APPROVAL_WITH_STATUS,
} = require("./_module-permission-lib");
const { MODULES, ACTIONS } = require("../src/config/constants");

const SECTIONS = [
  MODULES.PRACTICE,
  MODULES.MEDICAL_ORGANIZATION,
  MODULES.ORG_TYPE,
  MODULES.PRACTICE_STUDENT,
];

const ACTIONS_OVERRIDE = {
  [MODULES.PRACTICE]: APPROVAL_WITH_STATUS,
  [MODULES.MEDICAL_ORGANIZATION]: CRUD_ACTIONS,
  [MODULES.PRACTICE_STUDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
};

const TITLES = {
  [MODULES.PRACTICE]: "Amaliyot",
  [MODULES.MEDICAL_ORGANIZATION]: "Tibbiyot tashkilotlari",
  [MODULES.ORG_TYPE]: "Tashkilot turlari",
  [MODULES.PRACTICE_STUDENT]: "Amaliyot talabalari",
};

runModuleSeed({
  label: "4.13 Amaliyot",
  groupCode: "4.13",
  sections: SECTIONS,
  actionsOverride: ACTIONS_OVERRIDE,
  titles: TITLES,
});
