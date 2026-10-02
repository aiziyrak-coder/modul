const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualCalendarPlan.controller");
const Validation = require("./qualCalendarPlan.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.createSchema),
    Controller.addQualCalendarPlan,
  )
  .get(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualCalendarPlans,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualCalendarPlans,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualCalendarPlan,
  )
  .put(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.updateSchema),
    Controller.updateQualCalendarPlan,
  )
  .delete(
    permit(MODULES.QUAL_CALENDAR_PLAN, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualCalendarPlan,
  );

module.exports = router;
