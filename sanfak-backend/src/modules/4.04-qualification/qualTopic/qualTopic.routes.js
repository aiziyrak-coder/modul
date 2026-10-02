const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopic.controller");
const Validation = require("./qualTopic.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualTopic,
  )
  .get(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualTopics,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualTopics,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualTopic,
  )
  .put(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.UPDATE]),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopic,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopic,
  );

module.exports = router;
