const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES } = require("#config/constants");
const Controller = require("./role.controller");
const {
  roleSchema,
  readSchema,
  updateSchema,
  deleteSchema,
} = require("./role.validation");

router.use(authenticate);

const { ACTIONS } = require("#config/constants");

router
  .route("/")
  .post(permit(MODULES.ROLE, [ACTIONS.CREATE]), validator.body(roleSchema), Controller.addRole);

router.route("/").get(permit(MODULES.ROLE, [ACTIONS.READ_ALL]), Controller.findAllRoles);

router.route("/sections").get(Controller.getSectionsMetadata);

router.route("/sections-grouped").get(Controller.getSectionsGrouped);

router.route("/paginate").get(permit(MODULES.ROLE, [ACTIONS.READ_ALL]), Controller.paginateRoles);

router
  .route("/:id")
  .get(permit(MODULES.ROLE, [ACTIONS.READ]), validator.params(readSchema), Controller.findOneRole);

router
  .route("/:id")
  .put(
    permit(MODULES.ROLE, [ACTIONS.UPDATE]),
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateRole,
  );

router
  .route("/:id")
  .delete(
    permit(MODULES.ROLE, [ACTIONS.DELETE]),
    validator.params(deleteSchema),
    Controller.deleteRole,
  );

router
  .route("/user/:id")
  .get(
    permit(MODULES.ROLE, [ACTIONS.READ]),
    validator.params(readSchema),
    Controller.getUserPermissions,
  );

module.exports = router;
