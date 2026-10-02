const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./specialization.controller");
const {
  createSpecializationSchema,
  updateSpecializationSchema,
} = require("./specialization.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.SPECIALIZATION, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createSpecializationSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.SPECIALIZATION, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.SPECIALIZATION, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.SPECIALIZATION, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.SPECIALIZATION, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateSpecializationSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.SPECIALIZATION, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
