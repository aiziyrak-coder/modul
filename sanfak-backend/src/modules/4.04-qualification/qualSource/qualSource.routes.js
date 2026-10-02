const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualSource.controller");
const Validation = require("./qualSource.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.createSchema),
    Controller.addQualSource,
  )
  .get(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualSources,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualSources,
  );

router
  .route("/by-course-name")
  .get(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.READ]),
    validator.query(Validation.byCourseNameQuery),
    Controller.findSourcesByCourseName,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualSource,
  )
  .put(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.updateSchema),
    Controller.updateQualSource,
  )
  .delete(
    permit(MODULES.QUAL_SOURCE, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualSource,
  );

module.exports = router;
