const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./documentType.controller");
const {
  docTypeSchema,
  updateSchema,
  findAll,
  readSchema,
  deleteSchema,
} = require("./documentType.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.DOCUMENT_TYPE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.DOCUMENT_TYPE, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.DOCUMENT_TYPE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.DOCUMENT_TYPE, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(docTypeSchema), Controller.addDocumentType)
  .get(permitReadAll, validator.query(findAll), Controller.findAllDocumentTypes);

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateDocumentType,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteDocumentType);

module.exports = router;
