const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scientificTemplate.controller");
const {
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  templatePaginateSchema,
} = require("./scientificTemplate.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.SCIENTIFIC_TEMPLATE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.SCIENTIFIC_TEMPLATE, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.SCIENTIFIC_TEMPLATE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.SCIENTIFIC_TEMPLATE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.SCIENTIFIC_TEMPLATE, [ACTIONS.DELETE]);

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createTemplateSchema),
    Controller.addTemplate,
  )
  .get(
    permitReadAll,
    validator.query(templateQuerySchema),
    Controller.findAllTemplates,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(templatePaginateSchema),
    Controller.paginateTemplates,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneTemplate)
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateTemplateSchema),
    Controller.updateTemplate,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteTemplate,
  );

module.exports = router;
