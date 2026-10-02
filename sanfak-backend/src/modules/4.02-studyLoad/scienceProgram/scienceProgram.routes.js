const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scienceProgramScope = require("./scienceProgram.scope");
const eriGuard = require("../_shared/eriGuard");
const { rejectCommentSchema } = require("../_shared/rejectBody.schema");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scienceProgram.controller");
const {
  createscienceProgramSchema,
  updatescienceProgramSchema,
  approveScienceProgramSchema,
} = require("./scienceProgram.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.DELETE]);
const scope = scienceProgramScope();

router.get("/my-sciences", permitReadAll, Controller.getMyAssignedSciences);

router.get(
  "/working-plan-status",
  permitReadAll,
  Controller.getWorkingPlanStatus,
);

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createscienceProgramSchema),
    Controller.addScienceProgram,
  )

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    validator.body(approveScienceProgramSchema),
    Controller.approve,
  );
router
  .route("/reject/:id")
  .patch(
    permit(MODULES.SCIENCE_PROGRAM, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.body(rejectCommentSchema),
    Controller.reject,
  );
router.route("/").get(
  permitReadAll,
  scope,
  validator.query(findAll),
  Controller.findAllSciencePrograms,
);

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(paginate),
    Controller.paginateSciencePrograms,
);

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneScienceProgram,
  )

router
  .route("/:id")
  .put(
    permitUpdate,
    scope,
    validator.body(updatescienceProgramSchema),
    Controller.updateScienceProgram,
  )
router
  .route("/:id")
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteScienceProgram,
  );

router.route("/:id/archive").put(permitDelete, scope, Controller.archiveScienceProgram);
router.route("/:id/restore").put(permitUpdate, scope, Controller.restoreScienceProgram);

router
  .route("/topic/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneScienceProgramTopic,
  )

router
  .route("/independent/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneScienceProgramIndependentTask,
  )
router
  .route("/seminar/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneScienceProgramSeminarRecommendation,
  )


router.route("/:id/pdf").get(permitFindOne, scope, Controller.generatePdf);

module.exports = router;
