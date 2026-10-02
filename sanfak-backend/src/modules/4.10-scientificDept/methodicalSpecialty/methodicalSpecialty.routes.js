const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./methodicalSpecialty.controller");
const {
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyQuerySchema,
  specialtyPaginateSchema,
} = require("./methodicalSpecialty.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.METHODICAL_SPECIALTY, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.METHODICAL_SPECIALTY, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.METHODICAL_SPECIALTY, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.METHODICAL_SPECIALTY, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.METHODICAL_SPECIALTY, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createSpecialtySchema), Controller.addSpecialty)
  .get(permitReadAll, validator.query(specialtyQuerySchema), Controller.findAllSpecialties);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(specialtyPaginateSchema), Controller.paginateSpecialties);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneSpecialty)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSpecialtySchema),
    Controller.updateSpecialty,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteSpecialty);

module.exports = router;
