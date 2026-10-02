const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./academicTitle.controller");
const {
  createAcademicTitleSchema,
  updateAcademicTitleSchema,
} = require("./academicTitle.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createAcademicTitleSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateAcademicTitleSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.ACADEMIC_TITLE, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
