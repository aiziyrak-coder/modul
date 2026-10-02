const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./studyPlan.controller");
const {
  createStudyPlanSchema,
  updateStudyPlanScienceSchema,
  linkStudyPlanScienceSchema,
  addElectiveRowSchema,
  electiveRowParamsSchema,
} = require("./studyPlan.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");
const parentDirectionScope = require("#modules/4.02-studyLoad/_shared/parentDirectionScope");
const LearningProcess = require("#modules/4.02-studyLoad/learningProcess/learningProcess.model");

router.use(authenticate);

const permitAdd = permit(MODULES.STUDY_PLAN, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.STUDY_PLAN, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.STUDY_PLAN, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.STUDY_PLAN, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STUDY_PLAN, [ACTIONS.DELETE]);
const permitExport = permit(MODULES.STUDY_PLAN, [ACTIONS.EXPORT]);
const scope = parentDirectionScope({
  parentModel: LearningProcess,
  parentRefField: "learningProcess",
});

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createStudyPlanSchema),
    Controller.addStudyPlan,
  );

router
  .route("/")
  .get(
    permitReadAll,
    validator.query(findAll),
    scope,
    Controller.findAllStudyPlans,
  );
router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(paginate),
    scope,
    Controller.paginateStudyPlans,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneStudyPlan,
  );

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.body(updateStudyPlanScienceSchema),
    scope,
    Controller.updateStudyPlan,
  );

router
  .route("/:id")
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteStudyPlan,
  );

router.route("/:id/pdf").get(permitExport, scope, Controller.generatePdf);

router
  .route("/:id/by-semester/:n")
  .get(permitFindOne, scope, Controller.getBySemester);

router.route("/:id/by-blocks").get(permitFindOne, scope, Controller.getByBlocks);

router
  .route("/:id/link-science")
  .patch(
    permitUpdate,
    validator.body(linkStudyPlanScienceSchema),
    scope,
    Controller.linkStudyPlanScience,
  );

router
  .route("/:id/elective-row")
  .post(
    permitUpdate,
    validator.params(readSchema),
    validator.body(addElectiveRowSchema),
    scope,
    Controller.addElectiveRow,
  );

router
  .route("/:id/elective-row/:rowId")
  .delete(
    permitUpdate,
    validator.params(electiveRowParamsSchema),
    scope,
    Controller.removeElectiveRow,
  );

module.exports = router;
