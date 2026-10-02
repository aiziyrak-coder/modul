const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");
const {
  guardUploadContent,
} = require("#modules/4.05-residency/_services/uploadContentGuard");
const C = require("./activityPlan.controller");
const V = require("./activityPlan.validation");
const { mapProofFile } = require("#modules/4.05-residency/_services/planFiles");
const requireEri = require("#shared/requireEri");
const {
  guardFileUrl,
  guardLinkUrl,
} = require("#modules/4.05-residency/_services/fileUrlGuard");

router.use(authenticate);

const M = MODULES.RESIDENCY_ACTIVITY_PLAN;
const withProofFile = [
  uploadImages,
  guardUploadContent(),
  resizeImages,
  mapProofFile,
  guardFileUrl(),
  guardLinkUrl("url"),
];

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addPlan)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAll);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.paginate);

router.route("/stats").get(permit(M, [ACTIONS.READ_ALL]), C.stats);

router
  .route("/:id/submit")
  .put(permit(M, [ACTIONS.UPDATE]), validator.params(V.idSchema), C.submit);

router
  .route("/:id/approve")
  .put(
    permit(M, [ACTIONS.APPROVE]),
    validator.params(V.idSchema),
    validator.body(V.approveSchema),
    requireEri({ optional: true }),
    C.approve,
  );

router
  .route("/:id/reject")
  .put(
    permit(M, [ACTIONS.APPROVE]),
    validator.params(V.idSchema),
    validator.body(V.rejectSchema),
    C.reject,
  );

router
  .route("/:id/tasks/:taskIndex/proofs")
  .post(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.taskParam),
    ...withProofFile,
    validator.body(V.proofSchema),
    C.addProof,
  );

router
  .route("/:id/tasks/:taskIndex/proofs/:proofIndex/review")
  .put(
    permit(M, [ACTIONS.APPROVE]),
    validator.params(V.proofParam),
    validator.body(V.reviewProofSchema),
    C.reviewProof,
  );

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findOne)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updatePlan,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.remove);

module.exports = router;
