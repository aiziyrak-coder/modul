const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./councilSpecialty.controller");
const {
  createSpecialtySchema,
  updateSpecialtySchema,
  listSpecialtyQuery,
} = require("./councilSpecialty.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitRead = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.READ]);
const permitWrite = permit(MODULES.SCIENCE_COUNCIL, [ACTIONS.MANAGE_MEMBERS]);

router
  .route("/")
  .post(permitWrite, validator.body(createSpecialtySchema), Controller.addSpecialty)
  .get(permitRead, validator.query(listSpecialtyQuery), Controller.findAllSpecialties);

router
  .route("/paginate")
  .get(permitRead, validator.query(listSpecialtyQuery), Controller.paginateSpecialties);

router
  .route("/:id")
  .get(permitRead, validator.params(readSchema), Controller.findOneSpecialty)
  .put(permitWrite, validator.body(updateSpecialtySchema), Controller.updateSpecialty)
  .delete(permitWrite, validator.params(deleteSchema), Controller.deleteSpecialty);

module.exports = router;
