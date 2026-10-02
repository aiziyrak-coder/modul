const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyTheoryTopic.controller");
const V = require("./residencyTheoryTopic.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_THEORY_TOPIC;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addTopic)
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.listQuery), C.findAllTopics);

router
  .route("/paginate")
  .get(permit(M, [ACTIONS.READ_ALL]), validator.query(V.paginateQuery), C.paginateTopics);

router
  .route("/:id")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateTopic,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteTopic);

module.exports = router;
