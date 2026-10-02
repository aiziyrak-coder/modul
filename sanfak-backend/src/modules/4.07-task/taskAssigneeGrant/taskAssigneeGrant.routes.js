const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./taskAssigneeGrant.controller");
const V = require("./taskAssigneeGrant.validation");

router.use(authenticate);

const manage = permit(MODULES.TASK, [ACTIONS.MANAGE_MEMBERS]);

router.route("/users").get(manage, validator.query(V.listQuery), Controller.listAssigners);
router.route("/candidates").get(manage, validator.query(V.listQuery), Controller.listCandidates);
router.route("/roles").get(manage, Controller.listRoleOptions);

router
  .route("/:assignerId")
  .get(manage, validator.params(V.assignerParams), Controller.listGrants)
  .put(
    manage,
    validator.params(V.assignerParams),
    validator.body(V.replaceSchema),
    Controller.replaceGrants,
  )
  .post(
    manage,
    validator.params(V.assignerParams),
    validator.body(V.addSchema),
    Controller.addGrants,
  );

router
  .route("/:assignerId/:assigneeId")
  .delete(manage, validator.params(V.grantParams), Controller.removeGrant);

module.exports = router;
