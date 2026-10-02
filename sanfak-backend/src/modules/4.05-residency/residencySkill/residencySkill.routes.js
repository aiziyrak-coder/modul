const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencySkill.controller");
const V = require("./residencySkill.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_SKILL;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addSkill)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllSkills);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.paginateQuery), C.paginateSkills);

router
  .route("/progress")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.progressQuery), C.progress);

router
  .route("/:id")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateSkill,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteSkill);

module.exports = router;
