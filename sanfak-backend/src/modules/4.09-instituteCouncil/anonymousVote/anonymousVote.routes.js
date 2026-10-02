const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./anonymousVote.controller");
const { voteSchema, myVoteParamsSchema } = require("./anonymousVote.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.ANONYMOUS_VOTE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.ANONYMOUS_VOTE, [ACTIONS.READ_ALL]);

router.route("/").post(permitAdd, validator.body(voteSchema), Controller.castVote);

router
  .route("/my/:sessionId")
  .get(permitAdd, validator.params(myVoteParamsSchema), Controller.myVote);

router
  .route("/session/:sessionId/participation")
  .get(permitReadAll, validator.params(myVoteParamsSchema), Controller.participation);

router.route("/session/:sessionId").get(permitReadAll, Controller.tally);

module.exports = router;
