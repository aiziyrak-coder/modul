const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { ErrorHandler } = require("#shared/error");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const departmentContingentScope = require("./departmentContingent.scope");

const Controller = require("./departmentContingent.controller");
const {
  createContingentSchema,
  updateContingentSchema,
  paginateContingentQuery,
  summaryQuery,
  prefillQuery,
  readSchema,
  deleteSchema,
} = require("./departmentContingent.validation");

router.use(authenticate);

const scope = departmentContingentScope();

const requireGlobalScope = (req, _res, next) => {
  const role = req.user?.role;
  if (role?.title === ROLES.SUPER_ADMIN || role?.scopeLevel === "global") return next();
  return next(new ErrorHandler(403, "Kontingent yig'masi faqat institut darajasidagi rollarga ochiq"));
};

router
  .route("/")
  .post(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.CREATE]),
    scope,
    validator.body(createContingentSchema),
    Controller.addContingent,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.READ_ALL]),
    scope,
    validator.query(paginateContingentQuery),
    Controller.paginateContingents,
  );

router
  .route("/summary")
  .get(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.READ_ALL]),
    requireGlobalScope,
    validator.query(summaryQuery),
    Controller.summary,
  );

router
  .route("/prefill")
  .get(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.CREATE]),
    scope,
    validator.query(prefillQuery),
    Controller.prefill,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.READ]),
    scope,
    validator.params(readSchema),
    Controller.getContingent,
  )
  .put(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.UPDATE]),
    scope,
    validator.params(readSchema),
    validator.body(updateContingentSchema),
    Controller.updateContingent,
  )
  .delete(
    permit(MODULES.DEPARTMENT_CONTINGENT, [ACTIONS.DELETE]),
    scope,
    validator.params(deleteSchema),
    Controller.deleteContingent,
  );

module.exports = router;
