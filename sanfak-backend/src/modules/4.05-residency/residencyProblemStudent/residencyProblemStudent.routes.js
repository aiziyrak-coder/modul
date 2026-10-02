const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyProblemStudent.controller");
const V = require("./residencyProblemStudent.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_PROBLEM_STUDENT;

router
  .route("/")
  .post(
    permit(M, [ACTIONS.CREATE]),
    validator.body(V.createSchema),
    C.addProblemStudent,
  )
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.listQuery),
    C.findAllProblemStudents,
  );

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateProblemStudents,
  );

router
  .route("/:id")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateProblemStudent,
  )
  .delete(
    permit(M, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    C.deleteProblemStudent,
  );

module.exports = router;
