const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES } = require("#config/constants");
const Controller = require("./permission.controller");
const {
  permissionSchema,
  readSchema,
  updatedSchema,
  deleteSchema,
} = require("./permission.validation");
const { findAll, paginate } = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.PERMISSION),
    validator.body(permissionSchema),
    Controller.addPermission,
  );

router
  .route("/")
  .get(
    permit(MODULES.PERMISSION),
    validator.query(findAll),
    Controller.findAllPermissions,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.PERMISSION),
    validator.query(paginate),
    Controller.paginatePermissions,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.PERMISSION),
    validator.params(readSchema),
    Controller.findOnePermission,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.PERMISSION),
    validator.params(readSchema),
    validator.body(updatedSchema),
    Controller.updatePermission,
  );

router
  .route("/:id")
  .delete(
    permit(MODULES.PERMISSION),
    validator.params(deleteSchema),
    Controller.deletePermission,
  );

module.exports = router;
