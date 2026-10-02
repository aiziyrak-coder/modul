const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const personalWorkPlanScope = require("./personalWorkPlan.scope");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const checkProfileApproved = require("#modules/4.03-teacher/_services/checkProfileApproved");
const Controller = require("./personalWorkPlan.controller");
const {
  generatePersonalWorkPlanPdf,
} = require("#modules/4.03-teacher/_pdf/personalWorkPlan.pdf");
const {
  createWorkPlanSchema,
  generateWorkPlanSchema,
  updateWorkPlanSchema,
  findAll,
  paginate,
  monitoring,
  monitoringExportQuery,
  readSchema,
  deleteSchema,
  addActivitySchema,
  updateActivitySchema,
  completeActivitySchema,
  verifyActivitySchema,
  completedItemsQuery,
  approveWorkPlanSchema,
  rejectWorkPlanSchema,
  activityParamsSchema,
} = require("./personalWorkPlan.validation");

router.use(authenticate);

const permitAdd    = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.CREATE]);
const permitRead   = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.READ_ALL]);
const permitOne    = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.DELETE]);
const permitReview = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.REVIEW]);
const permitApprove = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.REJECT]);
const scope = personalWorkPlanScope();
const scopeVerify = personalWorkPlanScope({ bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/monitoring")
  .get(
    permitReview,
    scope,
    validator.query(monitoring),
    Controller.getMonitoring,
  );
router
  .route("/monitoring/export")
  .get(
    permitReview,
    scope,
    validator.query(monitoringExportQuery),
    Controller.monitoringExport,
  );

router
  .route("/")
  .post(permitAdd, checkProfileApproved, validator.body(createWorkPlanSchema), Controller.addWorkPlan)
  .get(permitRead, scope, validator.query(findAll), Controller.findAllWorkPlans);

router
  .route("/paginate")
  .get(permitRead, scope, validator.query(paginate), Controller.paginateWorkPlans);

router
  .route("/generate")
  .post(permitAdd, checkProfileApproved, validator.body(generateWorkPlanSchema), Controller.generateFromWorkload);

router
  .route("/completed-items")
  .get(permitRead, scopeVerify, validator.query(completedItemsQuery), Controller.completedItems);
router
  .route("/completed-items/export")
  .get(permitRead, scopeVerify, validator.query(completedItemsQuery), Controller.completedItemsExport);

router
  .route("/:id")
  .get(permitOne, scope, validator.params(readSchema), Controller.findOneWorkPlan)
  .put(permitUpdate, scope, checkProfileApproved, validator.params(readSchema), validator.body(updateWorkPlanSchema), Controller.updateWorkPlan)
  .delete(
    permitDelete,
    scope,
    checkProfileApproved,
    validator.params(deleteSchema),
    Controller.deleteWorkPlan,
  );

router
  .route("/:id/pdf")
  .get(permitOne, scope, validator.params(readSchema), generatePersonalWorkPlanPdf);

router
  .route("/:id/activity")
  .post(permitUpdate, scope, checkProfileApproved, validator.body(addActivitySchema), Controller.addActivity);
router
  .route("/:id/activity/:activityId")
  .put(permitUpdate, scope, checkProfileApproved, validator.body(updateActivitySchema), Controller.updateActivity)
  .delete(permitUpdate, scope, checkProfileApproved, Controller.deleteActivity);
router
  .route("/:id/activity/:activityId/complete")
  .patch(permitUpdate, scope, checkProfileApproved, validator.body(completeActivitySchema), Controller.completeActivity);

const permitVerify = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.APPROVE, ACTIONS.REJECT]);
router
  .route("/:id/activity/:activityId/verify")
  .patch(
    permitVerify,
    scopeVerify,
    validator.params(activityParamsSchema),
    validator.body(verifyActivitySchema),
    Controller.verifyActivity,
  );

router.route("/:id/submit").post(permitUpdate, scope, checkProfileApproved, Controller.submitWorkPlan);
router.route("/:id/approve").patch(permitApprove, scope, validator.body(approveWorkPlanSchema), Controller.approveWorkPlan);
router.route("/:id/reject").patch(permitReject, scope, validator.body(rejectWorkPlanSchema), Controller.rejectWorkPlan);
router.route("/:id/reopen").patch(permitUpdate, scope, checkProfileApproved, Controller.reopenWorkPlan);
router.route("/:id/complete").patch(permitApprove, scope, Controller.completeWorkPlan);

module.exports = router;
