"use strict";

const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./residencySetting.controller");
const { updateSettingsSchema } = require("./residencySetting.validation");

router.use(authenticate);

const permitRead = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.RESIDENCY_LESSON, [ACTIONS.UPDATE]);

router
  .route("/")
  .get(permitRead, Controller.getSettings)
  .put(permitUpdate, validator.body(updateSettingsSchema), Controller.updateSettings);

module.exports = router;
