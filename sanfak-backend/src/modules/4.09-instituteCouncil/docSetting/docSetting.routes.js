const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./docSetting.controller");
const { updateSettingsSchema } = require("./docSetting.validation");

router.use(authenticate);

const permitRead = permit(MODULES.RANK_APPLICATION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.VOTING_SESSION, [ACTIONS.UPDATE]);

router
  .route("/")
  .get(permitRead, Controller.getSettings)
  .put(permitUpdate, validator.body(updateSettingsSchema), Controller.updateSettings);

module.exports = router;
