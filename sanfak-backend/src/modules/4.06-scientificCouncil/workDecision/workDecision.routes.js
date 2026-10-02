const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const {
  requireWorkReadAccess,
  requireWorkReadAccessFromBody,
} = require("#modules/4.06-scientificCouncil/_services/workAccess");
const { requireDecisionReadAccess } = require("./workDecision.access");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workDecision.controller");
const { createDecisionSchema } = require("./workDecision.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.WORK_DECISION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.WORK_DECISION, [ACTIONS.READ_ALL]);
const permitSign = permit(MODULES.WORK_DECISION, [ACTIONS.SIGN]);

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createDecisionSchema),
    requireWorkReadAccessFromBody("work"),
    Controller.addDecision,
  );

router
  .route("/work/:workId")
  .get(
    permitReadAll,
    requireWorkReadAccess("workId"),
    Controller.findDecisionsByWork,
  );

router.route("/:id/sign").put(permitSign, Controller.signDecision);

router
  .route("/:id/dalolatnoma")
  .get(permitReadAll, requireDecisionReadAccess, Controller.getDalolatnomaPdf);

module.exports = router;
