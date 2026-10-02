const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicPractical.controller");
const Validation = require("./qualTopicPractical.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TOPIC_PRACTICAL, [ACTIONS.READ_ALL]),
    validator.query(Validation.findSchema),
    Controller.findAllQualTopicPracticals,
  )
  .post(
    permit(MODULES.QUAL_TOPIC_PRACTICAL, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.createSchema),
    Controller.addQualTopicPractical,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_TOPIC_PRACTICAL, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopicPractical,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC_PRACTICAL, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopicPractical,
  );

module.exports = router;
