const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const workloadScope = require("./workload.scope");
const eriGuard = require("../_shared/eriGuard");
const { rejectCommentSchema } = require("../_shared/rejectBody.schema");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workload.controller");
const {
  createWorkloadSchema,
  updateWorkloadSchema,
  updateBlockContentSchema,
  updateBlockContentParamsSchema,
  updateStaffPositionsSchema,
  summaryXlsxQuery,
} = require("./workload.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

router.use(authenticate);

const scope = workloadScope();

router.route("/").post(permit(MODULES.WORKLOAD), Controller.addWorkload);

router
  .route("/")
  .get(
    permit(MODULES.WORKLOAD),
    scope,
    validator.query(findAll),
    Controller.findAllWorkloads,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.WORKLOAD),
    scope,
    validator.query(paginate),
    Controller.paginateWorkloads,
  );

router
  .route("/summary.xlsx")
  .get(
    permit(MODULES.WORKLOAD, [ACTIONS.EXPORT]),
    scope,
    validator.query(summaryXlsxQuery),
    Controller.exportSummaryXlsx,
  );

router
  .route("/detail/:id")
  .get(
    permit(MODULES.WORKLOAD),
    scope,
    validator.params(readSchema),
    Controller.findOneWorkload,
  );

router
  .route("/summary/:id")
  .get(
    permit(MODULES.WORKLOAD),
    scope,
    validator.params(readSchema),
    Controller.findOneWorkload,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.WORKLOAD),
    scope,
    validator.params(readSchema),
    Controller.findOneWorkload,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.WORKLOAD),
    scope,
    validator.body(updateWorkloadSchema),
    Controller.updateWorkload,
  );

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.WORKLOAD, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    Controller.approve,
  );
router
  .route("/reject/:id")
  .patch(
    permit(MODULES.WORKLOAD, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.body(rejectCommentSchema),
    Controller.reject,
  );

router
  .route("/:id")
  .delete(
    permit(MODULES.WORKLOAD),
    scope,
    validator.params(deleteSchema),
    Controller.deleteWorkload,
  );

router
  .route("/:id/pdf")
  .get(permit(MODULES.WORKLOAD), scope, Controller.generatePdf);

router
  .route("/:id/blocks/:blockId")
  .patch(
    permit(MODULES.WORKLOAD, [ACTIONS.UPDATE]),
    scope,
    validator.params(updateBlockContentParamsSchema),
    validator.body(updateBlockContentSchema),
    Controller.updateBlockContent,
  );

router
  .route("/:id/staff-positions")
  .patch(
    permit(MODULES.WORKLOAD, [ACTIONS.UPDATE]),
    scope,
    validator.params(readSchema),
    validator.body(updateStaffPositionsSchema),
    Controller.updateStaffPositions,
  );

router
  .route("/recalculate")
  .post(
    permit(MODULES.WORKLOAD, [ACTIONS.UPDATE]),
    scope,
    Controller.recalculateBulk,
  );

module.exports = router;
