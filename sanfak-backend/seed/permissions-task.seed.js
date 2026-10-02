"use strict";

const {
  runModuleSeed,
  CRUD_ACTIONS,
} = require("./_module-permission-lib");
const { MODULES, ACTIONS } = require("../src/config/constants");

const SECTIONS = [MODULES.TASK, MODULES.TASK_CATEGORY];

const ACTIONS_OVERRIDE = {
  [MODULES.TASK]: [
    ...CRUD_ACTIONS,
    ACTIONS.CHANGE_STATUS,
    ACTIONS.EXPORT,
    ACTIONS.MANAGE_MEMBERS,
  ],
  [MODULES.TASK_CATEGORY]: CRUD_ACTIONS,
};

const TITLES = {
  [MODULES.TASK]: "Topshiriqlar (4.7)",
  [MODULES.TASK_CATEGORY]: "Topshiriq kategoriyalari (4.7)",
};

runModuleSeed({
  label: "4.7 Topshiriqlar boshqaruvi",
  groupCode: "4.7",
  sections: SECTIONS,
  actionsOverride: ACTIONS_OVERRIDE,
  titles: TITLES,
  groupCodesOverride: { [MODULES.TASK]: ["4.7", "4.9"] },
});
