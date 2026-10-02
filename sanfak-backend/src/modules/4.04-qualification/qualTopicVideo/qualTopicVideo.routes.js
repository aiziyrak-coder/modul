const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicVideo.controller");
const Validation = require("./qualTopicVideo.validation");
const ValidationCommon = require("#validators/common");
const { uploadVideo, saveVideo } = require("./uploadVideo");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_TOPIC_VIDEO, [ACTIONS.READ_ALL]),
    validator.query(Validation.findSchema),
    Controller.findAllQualTopicVideos,
  )
  .post(
    permit(MODULES.QUAL_TOPIC_VIDEO, [ACTIONS.CREATE]),
    uploadVideo,
    saveVideo,
    validator.body(Validation.createSchema),
    Controller.addQualTopicVideo,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.QUAL_TOPIC_VIDEO, [ACTIONS.UPDATE]),
    uploadVideo,
    saveVideo,
    validator.params(ValidationCommon.readSchema),
    validator.body(Validation.updateSchema),
    Controller.updateQualTopicVideo,
  )
  .delete(
    permit(MODULES.QUAL_TOPIC_VIDEO, [ACTIONS.DELETE]),
    validator.params(ValidationCommon.deleteSchema),
    Controller.deleteQualTopicVideo,
  );

module.exports = router;
