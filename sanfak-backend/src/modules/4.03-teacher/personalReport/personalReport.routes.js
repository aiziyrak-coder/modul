const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const personalReportScope = require("./personalReport.scope");
const Controller = require("./personalReport.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  exportQuery,
  idSchema,
  approveSchema,
  rejectSchema,
} = require("./personalReport.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.READ_ALL]);
const permitOne = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.PERSONAL_WORK_PLAN, [ACTIONS.REJECT]);

const scope = personalReportScope();

router
  .route("/")
  .post(permitAdd, validator.body(createSchema), Controller.addReport)
  .get(permitRead, scope, validator.query(findAll), Controller.findAllReports);

router
  .route("/paginate")
  .get(permitRead, scope, validator.query(paginate), Controller.paginateReports);

router
  .route("/export")
  .get(permitRead, scope, validator.query(exportQuery), Controller.exportReports);

router
  .route("/:id")
  .get(permitOne, scope, validator.params(idSchema), Controller.findOneReport)
  .put(
    permitUpdate,
    scope,
    validator.params(idSchema),
    validator.body(updateSchema),
    Controller.updateReport,
  )
  .delete(permitDelete, scope, validator.params(idSchema), Controller.deleteReport);

router
  .route("/:id/submit")
  .post(permitUpdate, scope, validator.params(idSchema), Controller.submitReport);

router
  .route("/:id/approve")
  .patch(
    permitApprove,
    scope,
    validator.params(idSchema),
    validator.body(approveSchema),
    Controller.approveReport,
  );
router
  .route("/:id/reject")
  .patch(
    permitReject,
    scope,
    validator.params(idSchema),
    validator.body(rejectSchema),
    Controller.rejectReport,
  );

module.exports = router;
