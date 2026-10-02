const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualAccessTest.controller");
const Validation = require("./qualAccessTest.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualAccessTests,
  )
  .post(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualAccessTest,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualAccessTests,
  );

router
  .route("/reorder")
  .put(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.UPDATE]),
    validator.body(Validation.reorderSchema),
    Controller.reorderQualAccessTests,
  );

router
  .route("/bulk")
  .post(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.bulkCreateSchema),
    Controller.bulkAddQualAccessTests,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.UPDATE]),
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualAccessTest,
  )
  .delete(
    permit(MODULES.QUAL_ACCESS_TEST, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualAccessTest,
  );

module.exports = router;
