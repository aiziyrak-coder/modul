const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./permissionGroup.controller");
const {
  createPermissionGroupSchema,
  updatePermissionGroupSchema,
} = require("./permissionGroup.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.PERMISSION_GROUP, [ACTIONS.CREATE]);
const permitRead = permit(MODULES.PERMISSION_GROUP, [
  ACTIONS.READ,
  ACTIONS.READ_ALL,
]);
const permitUpdate = permit(MODULES.PERMISSION_GROUP, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.PERMISSION_GROUP, [ACTIONS.DELETE]);

router.route("/grouped").get(Controller.getGroupedTree);

router
  .route("/")
  .post(
    permitAdd,
    validator.body(createPermissionGroupSchema),
    Controller.addGroup,
  );

router.route("/").get(permitRead, Controller.findAllGroups);

router.route("/paginate").get(permitRead, Controller.paginateGroups);

router
  .route("/permissions/:id")
  .get(permitRead, Controller.getGroupPermissions);

router.route("/:id").get(permitRead, Controller.findOneGroup);

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.body(updatePermissionGroupSchema),
    Controller.updateGroup,
  );

router.route("/:id").delete(permitDelete, Controller.deleteGroup);

module.exports = router;
