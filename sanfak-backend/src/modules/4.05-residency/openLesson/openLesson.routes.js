const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./openLesson.controller");
const V = require("./openLesson.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_OPEN_LESSON;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addOpenLesson)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAll);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.paginate);

router
  .route("/resident/:residentId")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.params(V.residentIdSchema),
    C.findByResident,
  );

router
  .route("/:id")
  .get(permit(M, [ACTIONS.READ]), validator.params(V.idSchema), C.findOne)
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateOpenLesson,
  )
  .delete(
    permit(M, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    C.deleteOpenLesson,
  );

module.exports = router;
