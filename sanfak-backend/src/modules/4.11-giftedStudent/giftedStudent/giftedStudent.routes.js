const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { scopeOrBypass } = require("../_services/moduleScope");
const { REGISTRY_OWNER } = require("../_services/moduleRoles");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./giftedStudent.controller");
const {
  studentSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
  importQuery,
  templateQuery,
} = require("./giftedStudent.validation");
const { receiveRoster, inspectRoster } = require("./giftedStudent.import");

router.use(authenticate);

const permitAdd = permit(MODULES.GIFTED_STUDENT, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.GIFTED_STUDENT, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.GIFTED_STUDENT, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.GIFTED_STUDENT, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.GIFTED_STUDENT, [ACTIONS.DELETE]);
const scope        = scopeOrBypass("faculty", REGISTRY_OWNER);

router
  .route("/students")
  .post(permitAdd, validator.body(studentSchema), Controller.addStudent)
  .get(permitReadAll, scope, validator.query(findAll), Controller.findAllStudents);

router
  .route("/students/paginate")
  .get(permitReadAll, scope, validator.query(paginate), Controller.paginateStudents);

router.route("/students/ranking").get(permitReadAll, scope, Controller.getRanking);

router.route("/students/export").get(permitReadAll, scope, Controller.exportRanking);

router.route("/students/my").get(permitFindOne, Controller.findMyStudent);

router.route("/students/my/advisor").get(permitFindOne, Controller.findMyAdvisor);

router.route("/students/my-advisees").get(permitReadAll, Controller.findMyAdvisees);

router
  .route("/students/import")
  .post(
    permitAdd,
    receiveRoster,
    inspectRoster,
    validator.query(importQuery),
    Controller.importStudents,
  );

router
  .route("/students/import-template")
  .get(permitAdd, validator.query(templateQuery), Controller.importTemplate);

router.route("/students/advisor-candidates").get(permitReadAll, Controller.advisorCandidates);
router.route("/students/account-candidates").get(permitAdd, Controller.accountCandidates);

router
  .route("/students/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneStudent)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateStudent,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteStudent,
  );

module.exports = router;
