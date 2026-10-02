const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./councilMember.controller");
const {
  createMemberSchema,
  updateMemberSchema,
} = require("./councilMember.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.COUNCIL_MEMBER, [ACTIONS.DELETE]);
const scope = scopeFilter("user", {
  bypassRoles: [ROLES.ILMIY_KENGASH_KOTIBI],
});

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createMemberSchema),
    Controller.addMember,
  )
  .get(permitReadAll, scope, Controller.findAllMembers);

router
  .route("/paginate")
  .get(permitReadAll, scope, Controller.paginateMembers);

router
  .route("/:id")
  .get(
    permitFindOne,
    validator.params(readSchema),
    Controller.findOneMember,
  )
  .put(
    permitUpdate,
    validator.body(updateMemberSchema),
    Controller.updateMember,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteMember,
  );

module.exports = router;
