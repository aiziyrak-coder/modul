const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workingPlan.controller");
const {
  createWorkingPlanSchema,
  swapElectiveScienceSchema,
  electiveUsageQuerySchema,
  setElectiveAlternativesSchema,
  updateWorkingPlanScienceSchema,
} = require("./workingPlan.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");
const parentDirectionScope = require("#modules/4.02-studyLoad/_shared/parentDirectionScope");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const workingScheduleScope = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.scope");

router.use(authenticate);

const permitAdd = permit(MODULES.WORKING_PLAN, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.WORKING_PLAN, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.WORKING_PLAN, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.WORKING_PLAN, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.WORKING_PLAN, [ACTIONS.DELETE]);
const permitStudyPlanUpdate = permit(MODULES.STUDY_PLAN, [ACTIONS.UPDATE]);
const scope = parentDirectionScope({
  parentModel: WorkingScheduleModel,
  parentRefField: "workingSchedule",
});
const scheduleScope = workingScheduleScope();

router.route("/plan").get(
  permitReadAll,
  scope,
  Controller.findAllWorkingPlansSchedule,
);

router
  .route("/study-plan/:id")
  .put(
    permitUpdate,
    validator.body(updateWorkingPlanScienceSchema),
    scope,
    Controller.updateStudyPlanScince,
  );

router.route("/science").get(
  permitReadAll,
  scope,
  Controller.findAllFanlarRoyxati,
);

router
  .route("/science-info")
  .get(permitReadAll, scope, Controller.getScienceInfo);

router
  .route("/science-department")
  .patch(permitUpdate, scope, Controller.updateScienceDepartmentByCode);

router
  .route("/science/:id")
  .put(
    permitUpdate,
    validator.body(updateWorkingPlanScienceSchema),
    scope,
    Controller.updateStudyPlanScince,
  );

router
  .route("/:id/elective-usage")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    validator.query(electiveUsageQuerySchema),
    Controller.getElectiveUsage,
  );

router
  .route("/:id/elective-science")
  .put(
    permitUpdate,
    permitStudyPlanUpdate,
    scope,
    validator.params(readSchema),
    validator.body(swapElectiveScienceSchema),
    Controller.swapElectiveScience,
  );

router
  .route("/:id/elective-alternatives")
  .put(
    permitUpdate,
    permitStudyPlanUpdate,
    scope,
    validator.params(readSchema),
    validator.body(setElectiveAlternativesSchema),
    Controller.setElectiveAlternatives,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scheduleScope,
    validator.params(readSchema),
    Controller.findOneWorkingPlan,
  );
router
  .route("/:id")
  .put(permitUpdate, scheduleScope, Controller.updateWorkingPlan);
router
  .route("/:id")
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteWorkingPlan,
  );

router.route("/:id/pdf").get(permitFindOne, scope, Controller.generatePdf);

module.exports = router;
