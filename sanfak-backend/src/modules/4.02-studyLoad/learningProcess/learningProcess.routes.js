const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const learningProcessScope = require("./learningProcess.scope");
const eriGuard = require("../_shared/eriGuard");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./learningProcess.controller");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const { uploadLimiter } = require("#shared/rateLimiter");
const {
  updateLearningProcessSchema,
  updateSpecialPartsSchema,
  createLearningProcessSchema,
  monthWeeksSchema,
} = require("./learningProcess.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.LEARNING_PROCESS, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.LEARNING_PROCESS, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.LEARNING_PROCESS, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.LEARNING_PROCESS, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.LEARNING_PROCESS, [ACTIONS.DELETE]);
const scope = learningProcessScope();

router
  .route("/parse")
  .post(permitAdd, uploadLimiter, uploadImages, resizeImages, Controller.parseXlsx);

router
  .route("/upload-pdf")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createLearningProcessSchema),
    Controller.addFromPdf,
  );

router
  .route("/")
  .post(
    permit(MODULES.LEARNING_PROCESS, [ACTIONS.CREATE]),
    uploadLimiter,
    uploadImages,
    resizeImages,
    validator.body(createLearningProcessSchema),
    Controller.addFromXlsx,
  );

router.route("/").get(permitReadAll, scope, Controller.findAll);

router.route("/paginate").get(permitReadAll, scope, Controller.paginate);

router
  .route("/study-plan")
  .get(permitReadAll, scope, Controller.findAllStudyPlan);
router
  .route("/study-plan/:id")
  .put(permitUpdate, scope, Controller.updateStudyPlanScince);

router.route("/:id").get(permitFindOne, scope, Controller.findOne);

router
  .route("/special-part/:id")
  .put(
    permitUpdate,
    scope,
    validator.body(updateSpecialPartsSchema),
    Controller.updateSpecialParts,
  );

router
  .route("/fullupdate/:id")
  .put(
    permitUpdate,
    scope,
    uploadLimiter,
    uploadImages,
    resizeImages,
    validator.body(updateLearningProcessSchema),
    Controller.fullUpdate,
  );

router
  .route("/special-part/title/:id")
  .put(
    permitUpdate,
    scope,
    validator.body(updateSpecialPartsSchema),
    Controller.updateSpecialPartsTitle,
  );

router
  .route("/:id/month-weeks")
  .put(
    permitUpdate,
    scope,
    validator.body(monthWeeksSchema),
    Controller.updateMonthWeeks,
  );

router
  .route("/:id")
  .put(
    permitUpdate,
    scope,
    validator.body(updateLearningProcessSchema),
    Controller.update,
  );

router.route("/:id").delete(permitDelete, scope, Controller.delete);

router.route("/:id/archive").put(permitDelete, scope, Controller.archive);
router.route("/:id/restore").put(permitUpdate, scope, Controller.restore);

router
  .route("/:id/approve")
  .put(
    permit(MODULES.LEARNING_PROCESS, [ACTIONS.APPROVE]),
    scope,
    eriGuard(),
    Controller.approve,
  );

module.exports = router;
