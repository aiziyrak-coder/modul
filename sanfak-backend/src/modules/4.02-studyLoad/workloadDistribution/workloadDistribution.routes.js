const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const workloadDistributionScope = require("./workloadDistribution.scope");
const eriGuard = require("../_shared/eriGuard");
const { rejectCommentSchema } = require("../_shared/rejectBody.schema");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./workloadDistribution.controller");
const {
  createDistributionSchema,
  updateDistributionSchema,
  addBlockToTeacherSchema,
  updateBlockHoursSchema,
  addTeacherSchema,
  vacateTeacherSchema,
  fillVacancySchema,
  respondSchema,
  respondParamsSchema,
  electiveOptionsQuerySchema,
  electiveChoiceSchema,
} = require("./workloadDistribution.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

router.use(authenticate);

const permitDist = permit(MODULES.WORKLOAD_DISTRIBUTION);
const scope      = workloadDistributionScope({ bypassRoles: [ROLES.REJA_MOLIYA] });

router.route("/").post(
  permitDist,
  validator.body(createDistributionSchema),
  Controller.addWorkloadDistribution,
);

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    Controller.approve,
  );
router
  .route("/reject/:id")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.body(rejectCommentSchema),
    Controller.reject,
  );
router
  .route("/withdraw/:id")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.UPDATE]),
    scope,
    Controller.withdraw,
  );
router.route("/").get(
  permitDist, scope,
  validator.query(findAll),
  Controller.findAllWorkloadDistributions,
);

router
  .route("/paginate")
  .get(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.query(paginate),
    Controller.paginateWorkloadDistributions,
  );

router
  .route("/my")
  .get(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.READ]),
    Controller.getMyDistributions,
  );

router.route("/vacancies").get(
  permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.READ_ALL]),
  scope,
  Controller.getVacancies,
);

router
  .route("/:id")
  .get(permit(MODULES.WORKLOAD_DISTRIBUTION), scope, validator.params(readSchema), Controller.findOneWorkloadDistribution)
  .put(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.body(updateDistributionSchema),
    Controller.updateWorkloadDistribution,
  )
  .delete(permit(MODULES.WORKLOAD_DISTRIBUTION), scope, validator.params(deleteSchema), Controller.deleteWorkloadDistribution);

router
  .route("/:id/teachers")
  .post(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.body(addTeacherSchema),
    Controller.addTeacher,
  );

router
  .route("/:id/teachers/:teacherEntryId")
  .delete(permit(MODULES.WORKLOAD_DISTRIBUTION), scope, Controller.removeTeacher);

router
  .route("/:id/teachers/:teacherEntryId/blocks")
  .post(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.body(addBlockToTeacherSchema),
    Controller.addBlockToTeacher,
  );

router
  .route("/:id/teachers/:teacherEntryId/blocks/:blockId")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.UPDATE]),
    scope,
    validator.body(updateBlockHoursSchema),
    Controller.updateBlockHours,
  )
  .delete(permit(MODULES.WORKLOAD_DISTRIBUTION), scope, Controller.removeBlockFromTeacher);

router
  .route("/:id/teachers/:teacherEntryId/respond")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.CHANGE_STATUS]),
    validator.params(respondParamsSchema),
    validator.body(respondSchema),
    Controller.teacherRespond,
  );

router
  .route("/:id/vacate/:teacherEntryId")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.body(vacateTeacherSchema),
    Controller.vacateTeacher,
  );

router
  .route("/:id/teachers/:teacherEntryId/fill")
  .patch(
    permit(MODULES.WORKLOAD_DISTRIBUTION),
    scope,
    validator.body(fillVacancySchema),
    Controller.fillVacancy,
  );

router
  .route("/:id/elective-options")
  .get(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.READ]),
    scope,
    validator.params(readSchema),
    validator.query(electiveOptionsQuerySchema),
    Controller.getElectiveOptions,
  );

router
  .route("/:id/elective-choice")
  .put(
    permit(MODULES.WORKLOAD_DISTRIBUTION, [ACTIONS.UPDATE]),
    scope,
    validator.params(readSchema),
    validator.body(electiveChoiceSchema),
    Controller.setElectiveChoice,
  );

router
  .route("/:id/pdf")
  .get(permit(MODULES.WORKLOAD_DISTRIBUTION), scope, Controller.generatePdf);

module.exports = router;
