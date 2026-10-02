const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./auditLog.controller");
const { listQuerySchema, exportQuerySchema } = require("./auditLog.validation");

router.use(authenticate);

const permitRead = permit(MODULES.AUDIT_LOG, [ACTIONS.READ, ACTIONS.READ_ALL]);
const permitExport = permit(MODULES.AUDIT_LOG, [ACTIONS.EXPORT]);

router
  .route("/paginate")
  .get(permitRead, validator.query(listQuerySchema), Controller.paginate);

router.route("/modules").get(permitRead, Controller.modules);

router
  .route("/export")
  .get(permitExport, validator.query(exportQuerySchema), Controller.exportExcel);

router
  .route("/export/pdf")
  .get(permitExport, validator.query(exportQuerySchema), Controller.exportPdf);

router.route("/:id").get(permitRead, Controller.findOne);

module.exports = router;
