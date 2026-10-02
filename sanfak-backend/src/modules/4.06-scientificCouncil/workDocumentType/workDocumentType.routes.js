const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./workDocumentType.controller");
const {
  createWorkDocumentTypeSchema,
  updateWorkDocumentTypeSchema,
  listWorkDocumentTypeQuery,
} = require("./workDocumentType.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitRead = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.READ]);
const permitWrite = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.MANAGE_MEMBERS]);

router
  .route("/")
  .post(permitWrite, validator.body(createWorkDocumentTypeSchema), Controller.addType)
  .get(permitRead, validator.query(listWorkDocumentTypeQuery), Controller.findAllTypes);

router
  .route("/paginate")
  .get(permitRead, validator.query(listWorkDocumentTypeQuery), Controller.paginateTypes);

router
  .route("/:id")
  .get(permitRead, validator.params(readSchema), Controller.findOneType)
  .put(permitWrite, validator.body(updateWorkDocumentTypeSchema), Controller.updateType)
  .delete(permitWrite, validator.params(deleteSchema), Controller.deleteType);

module.exports = router;
