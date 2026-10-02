const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyLesson.controller");
const V = require("./residencyLesson.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_LESSON;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addLesson)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllLessons);

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateLessons,
  );

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findLesson)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateLesson,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteLesson);

module.exports = router;
