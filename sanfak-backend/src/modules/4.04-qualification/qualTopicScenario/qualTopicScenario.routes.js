const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicScenario.controller");
const Validation = require("./qualTopicScenario.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TOPIC_SCENARIO, [ACTIONS.READ_ALL]),
    validator.query(Validation.findSchema),
    Controller.findAllQualTopicScenarios,
  )
  .post(
    permit(MODULES.QUAL_TOPIC_SCENARIO, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualTopicScenario,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_TOPIC_SCENARIO, [ACTIONS.UPDATE]),
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopicScenario,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC_SCENARIO, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopicScenario,
  );

module.exports = router;
