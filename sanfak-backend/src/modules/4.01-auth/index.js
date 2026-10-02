const router = require("express").Router();

router.use("/users", require("./user/user.routes"));
router.use("/audit-logs", require("./auditLog/auditLog.routes"));
router.use("/permission-groups", require("./permissionGroup/permissionGroup.routes"));
router.use("/permissions", require("./permission/permission.routes"));
router.use("/roles", require("./role/role.routes"));

module.exports = router;
