const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./educationForm.controller");
const {
  createEducationFormSchema,
  updateEducationFormSchema,
} = require("./educationForm.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createEducationFormSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateEducationFormSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.EDUCATION_FORM, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
