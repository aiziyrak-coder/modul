const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTestConfig.controller");
const Validation = require("./qualTestConfig.validation");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TEST_CONFIG, [ACTIONS.READ]),
    validator.query(Validation.findSchema),
    Controller.findQualTestConfig,
  )
  .put(
    permit(MODULES.QUAL_TEST_CONFIG, [ACTIONS.UPDATE]),
    validator.body(Validation.upsertSchema),
    Controller.upsertQualTestConfig,
  );

module.exports = router;
