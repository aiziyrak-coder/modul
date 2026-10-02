const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./departmentWorkPlan.controller");
const {
  createPlanSchema,
  updatePlanSchema,
  rejectPlanSchema,
  planQuerySchema,
  planPaginateSchema,
} = require("./departmentWorkPlan.validation");
const { readSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.UPDATE]);
const permitApprove = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.DEPARTMENT_WORK_PLAN, [ACTIONS.REJECT]);
const scope = scopeFilter("department", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createPlanSchema),
    Controller.addDepartmentWorkPlan,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(planQuerySchema),
    Controller.findAllDepartmentWorkPlans,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(planPaginateSchema),
    Controller.paginateDepartmentWorkPlans,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneDepartmentWorkPlan,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updatePlanSchema),
    Controller.updateDepartmentWorkPlan,
  );

router
  .route("/:id/approve")
  .put(
    permitApprove,
    validator.params(readSchema),
    Controller.approveDepartmentWorkPlan,
  );

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectPlanSchema),
    Controller.rejectDepartmentWorkPlan,
  );

module.exports = router;
