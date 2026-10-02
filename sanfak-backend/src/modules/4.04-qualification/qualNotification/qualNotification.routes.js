const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualNotification.controller");
const Validation = require("./qualNotification.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.CREATE]),
    validator.body(Validation.createSchema),
    Controller.addQualNotification,
  )
  .get(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualNotifications,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualNotifications,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualNotification,
  )
  .put(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.UPDATE]),
    validator.body(Validation.updateSchema),
    Controller.updateQualNotification,
  )
  .delete(
    permit(MODULES.QUAL_NOTIFICATION, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualNotification,
  );

module.exports = router;
