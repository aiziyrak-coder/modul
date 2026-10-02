const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./councilNumber.controller");
const {
  createNumberSchema,
  updateNumberSchema,
  listNumberQuery,
} = require("./councilNumber.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitRead = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.READ]);
const permitWrite = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.MANAGE_MEMBERS]);

router
  .route("/")
  .post(permitWrite, validator.body(createNumberSchema), Controller.addNumber)
  .get(permitRead, validator.query(listNumberQuery), Controller.findAllNumbers);

router
  .route("/paginate")
  .get(permitRead, validator.query(listNumberQuery), Controller.paginateNumbers);

router
  .route("/:id")
  .get(permitRead, validator.params(readSchema), Controller.findOneNumber)
  .put(permitWrite, validator.body(updateNumberSchema), Controller.updateNumber)
  .delete(permitWrite, validator.params(deleteSchema), Controller.deleteNumber);

module.exports = router;
