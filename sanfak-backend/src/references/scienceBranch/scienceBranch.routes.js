const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./scienceBranch.controller");
const {
  createScienceBranchSchema,
  updateScienceBranchSchema,
} = require("./scienceBranch.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createScienceBranchSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateScienceBranchSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.SCIENCE_BRANCH, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
