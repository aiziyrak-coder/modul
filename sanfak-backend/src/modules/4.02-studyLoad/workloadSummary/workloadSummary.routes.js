const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const eriGuard = require("../_shared/eriGuard");

const Controller = require("./workloadSummary.controller");
const {
  createSummarySchema,
  paginateSummaryQuery,
  approveSummarySchema,
  rejectSummarySchema,
  readSchema,
  deleteSchema,
} = require("./workloadSummary.validation");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.CREATE]),
    validator.body(createSummarySchema),
    Controller.addWorkloadSummary,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.READ_ALL]),
    validator.query(paginateSummaryQuery),
    Controller.paginateWorkloadSummaries,
  );

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    eriGuard(),
    validator.params(readSchema),
    validator.body(approveSummarySchema),
    Controller.approveWorkloadSummary,
  );

router
  .route("/reject/:id")
  .patch(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.REJECT]),
    eriGuard(),
    validator.params(readSchema),
    validator.body(rejectSummarySchema),
    Controller.rejectWorkloadSummary,
  );

router
  .route("/:id/xlsx")
  .get(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.READ]),
    validator.params(readSchema),
    Controller.exportSummaryXlsx,
  );

router
  .route("/:id/pdf")
  .get(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.READ]),
    validator.params(readSchema),
    Controller.exportSummaryPdf,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.READ]),
    validator.params(readSchema),
    Controller.findOneWorkloadSummary,
  )
  .delete(
    permit(MODULES.WORKLOAD_SUMMARY, [ACTIONS.DELETE]),
    validator.params(deleteSchema),
    Controller.deleteWorkloadSummary,
  );

module.exports = router;
