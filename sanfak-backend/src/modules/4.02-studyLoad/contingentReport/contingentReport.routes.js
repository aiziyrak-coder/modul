const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { ErrorHandler } = require("#shared/error");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const eriGuard = require("../_shared/eriGuard");
const contingentReportScope = require("./contingentReport.scope");

const Controller = require("./contingentReport.controller");
const {
  createReportSchema,
  updateReportSchema,
  prefillSchema,
  paginateReportQuery,
  summaryQuery,
  approveReportSchema,
  rejectReportSchema,
  readSchema,
  deleteSchema,
} = require("./contingentReport.validation");

router.use(authenticate);

const scope = contingentReportScope();

const requireGlobalScope = (req, _res, next) => {
  const role = req.user?.role;
  if (role?.title === ROLES.SUPER_ADMIN || role?.scopeLevel === "global") {
    return next();
  }
  return next(
    new ErrorHandler(
      403,
      "Institut yig'masi faqat institut darajasidagi rollarga ochiq",
    ),
  );
};

router
  .route("/")
  .post(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.CREATE]),
    scope,
    validator.body(createReportSchema),
    Controller.addContingentReport,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.READ_ALL]),
    scope,
    validator.query(paginateReportQuery),
    Controller.paginateContingentReports,
  );

router
  .route("/summary")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.READ_ALL]),
    requireGlobalScope,
    validator.query(summaryQuery),
    Controller.getSummary,
  );
router
  .route("/summary/pdf")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.EXPORT]),
    requireGlobalScope,
    validator.query(summaryQuery),
    Controller.exportSummaryPdf,
  );
router
  .route("/summary/xlsx")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.EXPORT]),
    requireGlobalScope,
    validator.query(summaryQuery),
    Controller.exportSummaryXlsx,
  );

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    validator.params(readSchema),
    validator.body(approveReportSchema),
    Controller.approveContingentReport,
  );

router
  .route("/reject/:id")
  .patch(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.params(readSchema),
    validator.body(rejectReportSchema),
    Controller.rejectContingentReport,
  );

router
  .route("/:id/prefill")
  .post(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.UPDATE]),
    scope,
    validator.params(readSchema),
    validator.body(prefillSchema),
    Controller.prefillContingentReport,
  );

router
  .route("/:id/xlsx")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.EXPORT]),
    scope,
    validator.params(readSchema),
    Controller.exportReportXlsx,
  );
router
  .route("/:id/pdf")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.EXPORT]),
    scope,
    validator.params(readSchema),
    Controller.exportReportPdf,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.READ]),
    scope,
    validator.params(readSchema),
    Controller.findOneContingentReport,
  )
  .put(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.UPDATE]),
    scope,
    validator.params(readSchema),
    validator.body(updateReportSchema),
    Controller.updateContingentReport,
  )
  .delete(
    permit(MODULES.CONTINGENT_REPORT, [ACTIONS.DELETE]),
    scope,
    validator.params(deleteSchema),
    Controller.deleteContingentReport,
  );

module.exports = router;
