"use strict";

const {
  runModuleSeed,
  CRUD_ACTIONS,
  APPROVAL_ACTIONS,
} = require("./_module-permission-lib");
const { MODULES, ACTIONS } = require("../src/config/constants");

const SECTIONS = [
  MODULES.GIFTED_STUDENT,
  MODULES.EVALUATION_CRITERIA,
  MODULES.STUDENT_ACHIEVEMENT,
  MODULES.SCHOLARSHIP_APPLICATION,
  MODULES.SCHOLARSHIP,
  MODULES.DOCUMENT_TYPE,
];

const ACTIONS_OVERRIDE = {
  [MODULES.GIFTED_STUDENT]: [...CRUD_ACTIONS, ACTIONS.EXPORT],
  [MODULES.SCHOLARSHIP]: [...CRUD_ACTIONS],
  [MODULES.SCHOLARSHIP_APPLICATION]: [...APPROVAL_ACTIONS, ACTIONS.SCORE],
  [MODULES.STUDENT_ACHIEVEMENT]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
  ],
  [MODULES.DOCUMENT_TYPE]: [...CRUD_ACTIONS],
};

const TITLES = {
  [MODULES.GIFTED_STUDENT]: "Iqtidorli talabalar",
  [MODULES.EVALUATION_CRITERIA]: "Baholash mezonlari",
  [MODULES.STUDENT_ACHIEVEMENT]: "Talaba yutuqlari",
  [MODULES.SCHOLARSHIP_APPLICATION]: "Stipendiya arizasi",
  [MODULES.SCHOLARSHIP]: "Stipendiyalar",
  [MODULES.DOCUMENT_TYPE]: "Faoliyat/hujjat turlari",
};

runModuleSeed({
  label: "4.11 Iqtidorli talabalar",
  groupCode: "4.11",
  sections: SECTIONS,
  actionsOverride: ACTIONS_OVERRIDE,
  titles: TITLES,
});
