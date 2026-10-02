const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");
const Controller = require("./languageOfInstruction.controller");
const {
  createLanguageOfInstructionSchema,
  updateLanguageOfInstructionSchema,
} = require("./languageOfInstruction.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.CREATE]),
  uploadImages,
  resizeImages,
  validator.body(createLanguageOfInstructionSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  uploadImages,
  resizeImages,
  validator.body(updateLanguageOfInstructionSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.LANGUAGE_OF_INSTRUCTION, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
