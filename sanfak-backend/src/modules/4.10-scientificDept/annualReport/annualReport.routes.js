const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./annualReport.controller");
const {
  createReportSchema,
  updateReportSchema,
  rejectReportSchema,
  reportQuerySchema,
  reportPaginateSchema,
} = require("./annualReport.validation");
const { readSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.ANNUAL_REPORT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.ANNUAL_REPORT, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.ANNUAL_REPORT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.ANNUAL_REPORT, [ACTIONS.UPDATE]);
const permitApprove = permit(MODULES.ANNUAL_REPORT, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.ANNUAL_REPORT, [ACTIONS.REJECT]);
const scope = scopeFilter("department", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createReportSchema),
    Controller.addAnnualReport,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(reportQuerySchema),
    Controller.findAllAnnualReports,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(reportPaginateSchema),
    Controller.paginateAnnualReports,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneAnnualReport,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateReportSchema),
    Controller.updateAnnualReport,
  );

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveAnnualReport);

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectReportSchema),
    Controller.rejectAnnualReport,
  );

module.exports = router;
