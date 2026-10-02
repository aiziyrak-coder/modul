const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./residencySpecialty.controller");
const V = require("./residencySpecialty.validation");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.CREATE]),
    validator.body(V.createSchema),
    Controller.addSpecialty,
  )
  .get(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.READ_ALL]),
    validator.query(V.findAll),
    Controller.findAllSpecialties,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.READ_ALL]),
    validator.query(V.paginate),
    Controller.paginateSpecialties,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.READ]),
    validator.params(V.idSchema),
    Controller.findOneSpecialty,
  )
  .put(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    Controller.updateSpecialty,
  )
  .delete(
    permit(MODULES.RESIDENCY_SPECIALTY, [ACTIONS.DELETE]),
    validator.params(V.idSchema),
    Controller.deleteSpecialty,
  );

module.exports = router;
