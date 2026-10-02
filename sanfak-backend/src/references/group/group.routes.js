const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./group.controller");
const {
  createGroupSchema,
  updateGroupGroupSchema,
} = require("./group.validation");
const { findAllGroups, paginateGroups } = require("#validators/common");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.GROUP, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createGroupSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.GROUP, [ACTIONS.READ_ALL]),
  validator.query(findAllGroups),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.GROUP, [ACTIONS.READ_ALL]),
  validator.query(paginateGroups),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.GROUP, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.GROUP, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateGroupGroupSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.GROUP, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
