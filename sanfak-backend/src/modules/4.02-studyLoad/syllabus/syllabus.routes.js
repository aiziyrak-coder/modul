const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const syllabusScope = require("./syllabus.scope");
const eriGuard = require("../_shared/eriGuard");
const { rejectCommentSchema } = require("../_shared/rejectBody.schema");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./syllabus.controller");

const authenticate = require("#shared/authenticate");

const {
  approveSyllabusSchema,
  createSyllabusSchema,
  updateSyllabusSchema,
} = require("./syllabus.validation");

const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

const permitAdd = permit(MODULES.SYLLABUS, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SYLLABUS, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SYLLABUS, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SYLLABUS, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SYLLABUS, [ACTIONS.DELETE]);
const scope = syllabusScope();

router.use(authenticate);

router.get("/my-sciences", permitReadAll, Controller.getMyAssignedSciences);

router
  .route("/")
  .post(permitAdd, validator.body(createSyllabusSchema), Controller.addSyllabus)

router
  .route("/approve/:id")
  .patch(
    permit(MODULES.SYLLABUS, [ACTIONS.APPROVE, ACTIONS.UPDATE]),
    scope,
    eriGuard(),
    validator.body(approveSyllabusSchema),
    Controller.approve,
  );
router
  .route("/reject/:id")
  .patch(
    permit(MODULES.SYLLABUS, [ACTIONS.REJECT]),
    scope,
    eriGuard(),
    validator.body(rejectCommentSchema),
    Controller.reject,
  );

router
  .route("/")
  .get(permitReadAll, scope, validator.query(findAll), Controller.findAllSyllabuses);

router
  .route("/paginate")
  .get(permitReadAll, scope, validator.query(paginate), Controller.paginateSyllabuses);

router
  .route("/:id")
  .get(permitFindOne, scope, validator.params(readSchema), Controller.findOneSyllabus)
router.route("/:id")
.put(permitUpdate, scope, validator.body(updateSyllabusSchema), Controller.updateSyllabus)
router.route("/:id")
  .delete(
    permitDelete,
    scope,
    validator.params(deleteSchema),
    Controller.deleteSyllabus,
  );

router.route("/:id/archive").put(permitDelete, scope, Controller.archiveSyllabus);
router.route("/:id/restore").put(permitUpdate, scope, Controller.restoreSyllabus);

router.route("/:id/pdf").get(permitFindOne, scope, Controller.generatePdf);

module.exports = router;
