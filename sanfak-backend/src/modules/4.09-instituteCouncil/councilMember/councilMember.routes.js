const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./councilMember.controller");
const {
  memberSchema,
  updateMemberSchema,
  toggleVoteSchema,
  findMembersSchema,
  paginateMembersSchema,
  userOptionsSchema,
} = require("./councilMember.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(memberSchema), Controller.addMember)
  .get(permitReadAll, validator.query(findMembersSchema), Controller.findAllMembers);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(paginateMembersSchema), Controller.paginateMembers);

router
  .route("/user-options")
  .get(permitReadAll, validator.query(userOptionsSchema), Controller.userOptions);

router
  .route("/:id/toggle-vote")
  .patch(permitUpdate, validator.body(toggleVoteSchema), Controller.toggleVote);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneMember)
  .put(permitUpdate, validator.body(updateMemberSchema), Controller.updateMember)
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteMember);

module.exports = router;
