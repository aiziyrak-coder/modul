const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicFinalTest.controller");
const Validation = require("./qualTopicFinalTest.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.READ_ALL]),
    validator.query(Validation.findSchema),
    Controller.findAllQualTopicFinalTests,
  )
  .post(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualTopicFinalTest,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.READ_ALL]),
    validator.query(Validation.paginateSchema),
    Controller.paginateQualTopicFinalTests,
  );

router
  .route("/reorder")
  .put(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.UPDATE]),
    validator.body(Validation.reorderSchema),
    Controller.reorderQualTopicFinalTests,
  );

router
  .route("/bulk")
  .post(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.bulkCreateSchema),
    Controller.bulkAddQualTopicFinalTests,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.UPDATE]),
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopicFinalTest,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC_FINAL_TEST, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopicFinalTest,
  );

module.exports = router;
