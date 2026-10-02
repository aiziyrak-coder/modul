const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualTopicCompletion.controller");
const Validation = require("./qualTopicCompletion.validation");
const ValidationCommon = require("#validators/common");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/masteries")
  .get(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllMasteries,
  );

router
  .route("/masteries/paginate")
  .get(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateMasteries,
  );

router
  .route("/mastery-grid")
  .get(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.READ_ALL]),
    validator.query(Validation.masteryGridSchema),
    Controller.masteryGrid,
  );

router
  .route("/my")
  .get(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.READ]),
    validator.query(Validation.myProgressSchema),
    Controller.getMyProgress,
  );

router
  .route("/start")
  .post(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.CREATE]),
    validator.body(Validation.topicActionSchema),
    Controller.startTopic,
  );

router
  .route("/advance")
  .post(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.UPDATE]),
    validator.body(Validation.topicActionSchema),
    Controller.advanceTopic,
  );

router
  .route("/scenario")
  .post(
    permit(MODULES.QUAL_TOPIC_COMPLETION, [ACTIONS.UPDATE]),
    UploadMiddleware.uploadImages,
    validator.body(Validation.scenarioSubmitSchema),
    Controller.submitScenario,
  );

module.exports = router;
