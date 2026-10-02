"use strict";

const {
  runModuleSeed,
  CRUD_ACTIONS,
  APPROVAL_ACTIONS,
  APPROVAL_WITH_STATUS,
} = require("./_module-permission-lib");
const { MODULES, ACTIONS } = require("../src/config/constants");

const SECTIONS = [
  MODULES.COUNCIL_MEMBER,
  MODULES.COUNCIL_TASK,
  MODULES.RANK_APPLICATION,
  MODULES.VOTING_SESSION,
  MODULES.ANONYMOUS_VOTE,
];

const ACTIONS_OVERRIDE = {
  [MODULES.COUNCIL_MEMBER]: CRUD_ACTIONS,
  [MODULES.COUNCIL_TASK]: [
    ...CRUD_ACTIONS,
    ACTIONS.APPROVE,
    ACTIONS.REJECT,
    ACTIONS.CHANGE_STATUS,
  ],
  [MODULES.RANK_APPLICATION]: APPROVAL_ACTIONS,
  [MODULES.VOTING_SESSION]: APPROVAL_WITH_STATUS,
  [MODULES.ANONYMOUS_VOTE]: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.READ_ALL],
};

const TITLES = {
  [MODULES.COUNCIL_MEMBER]: "Kengash a'zolari",
  [MODULES.COUNCIL_TASK]: "Kengash topshiriqlari",
  [MODULES.RANK_APPLICATION]: "Unvon arizalari",
  [MODULES.VOTING_SESSION]: "Ovoz berish",
  [MODULES.ANONYMOUS_VOTE]: "Anonim ovozlar",
};

runModuleSeed({
  label: "4.9 Institut ilmiy kengashi",
  groupCode: "4.9",
  sections: SECTIONS,
  actionsOverride: ACTIONS_OVERRIDE,
  titles: TITLES,
});
