const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicLecture.controller");
const Validation = require("./qualTopicLecture.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TOPIC_LECTURE, [ACTIONS.READ_ALL]),
    validator.query(Validation.findSchema),
    Controller.findAllQualTopicLectures,
  )
  .post(
    permit(MODULES.QUAL_TOPIC_LECTURE, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.createSchema),
    Controller.addQualTopicLecture,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_TOPIC_LECTURE, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopicLecture,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC_LECTURE, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopicLecture,
  );

module.exports = router;
