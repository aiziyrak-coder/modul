const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualCourseType.controller");
const Validation = require("./qualCourseType.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.createSchema),
    Controller.addQualCourseType,
  )
  .get(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualCourseTypes,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualCourseTypes,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualCourseType,
  )
  .put(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.updateSchema),
    Controller.updateQualCourseType,
  )
  .delete(
    permit(MODULES.QUAL_COURSE_TYPE, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualCourseType,
  );

module.exports = router;
