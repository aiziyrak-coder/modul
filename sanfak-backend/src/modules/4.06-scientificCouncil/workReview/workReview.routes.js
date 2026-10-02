const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const {
  requireWorkReadAccess,
  requireWorkReadAccessFromBody,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");
const {
  requireReviewWriteAccess,
  requireDocAssignment,
} = require("./workReview.access");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workReview.controller");
const {
  createReviewSchema,
  updateReviewSchema,
} = require("./workReview.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.WORK_REVIEW, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.WORK_REVIEW, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.WORK_REVIEW, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.WORK_REVIEW, [ACTIONS.DELETE]);

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createReviewSchema),
    requireWorkReadAccessFromBody("work"),
    requireDocAssignment,
    Controller.addReview,
  );

router
  .route("/work/:workId")
  .get(
    permitReadAll,
    requireWorkReadAccess("workId"),
    Controller.findReviewsByWork,
  );

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.body(updateReviewSchema),
    requireReviewWriteAccess,
    Controller.updateReview,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteReview,
  );

module.exports = router;
