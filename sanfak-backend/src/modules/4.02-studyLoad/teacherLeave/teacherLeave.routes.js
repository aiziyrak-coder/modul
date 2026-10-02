const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const teacherLeaveScope = require("./teacherLeave.scope");
const eriGuard = require("../_shared/eriGuard");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./teacherLeave.controller");
const {
  createTeacherLeaveSchema,
  approveTeacherLeaveSchema,
} = require("./teacherLeave.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.TEACHER_LEAVE, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.TEACHER_LEAVE, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.TEACHER_LEAVE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.TEACHER_LEAVE, [ACTIONS.DELETE]);
const scope = teacherLeaveScope;

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createTeacherLeaveSchema),
    Controller.addTeacherLeave,
  )
  .get(permitRead, scope, validator.query(findAll), Controller.findAllTeacherLeaves);

router
  .route("/paginate")
  .get(permitRead, scope, validator.query(paginate), Controller.paginateTeacherLeaves);

router
  .route("/:id")
  .get(permitRead, scope, validator.params(readSchema), Controller.findOneTeacherLeave)
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteTeacherLeave,
  );

router
  .route("/:id/approve")
  .patch(
    permitUpdate,
    scope,
    eriGuard(),
    validator.body(approveTeacherLeaveSchema),
    Controller.approveTeacherLeave,
  );
router
  .route("/:id/reject")
  .patch(permitUpdate, scope, eriGuard(), Controller.rejectTeacherLeave);

router.route("/:id/pdf").get(permitRead, scope, Controller.generateBayonnoma);

router
  .route("/:id/suggestions")
  .get(permitUpdate, scope, Controller.getReassignmentSuggestions);
router
  .route("/:id/reassign")
  .post(permitUpdate, scope, Controller.reassignVacancy);

module.exports = router;
