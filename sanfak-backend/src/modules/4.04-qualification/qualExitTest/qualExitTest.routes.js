const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualExitTest.controller");
const Validation = require("./qualExitTest.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualExitTests,
  )
  .post(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualExitTest,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualExitTests,
  );

router
  .route("/reorder")
  .put(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.UPDATE]),
    validator.body(Validation.reorderSchema),
    Controller.reorderQualExitTests,
  );

router
  .route("/bulk")
  .post(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.CREATE]),
    validator.body(Validation.bulkCreateSchema),
    Controller.bulkAddQualExitTests,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.UPDATE]),
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualExitTest,
  )
  .delete(
    permit(MODULES.QUAL_EXIT_TEST, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualExitTest,
  );

module.exports = router;
