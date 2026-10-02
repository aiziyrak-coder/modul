const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./medicalOrganization.controller");
const {
  organizationSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./medicalOrganization.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.MEDICAL_ORGANIZATION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.MEDICAL_ORGANIZATION, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.MEDICAL_ORGANIZATION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.MEDICAL_ORGANIZATION, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.MEDICAL_ORGANIZATION, [ACTIONS.DELETE]);

router
  .route("/organizations")
  .post(
    permitAdd,
    validator.body(organizationSchema),
    Controller.addOrganization,
  )
  .get(
    permitReadAll,
    validator.query(findAll),
    Controller.findAllOrganizations,
  );

router
  .route("/organizations/paginate")
  .get(
    permitReadAll,
    validator.query(paginate),
    Controller.paginateOrganizations,
  );

router
  .route("/organizations/:id")
  .get(
    permitFindOne,
    validator.params(readSchema),
    Controller.findOneOrganization,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateOrganization,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteOrganization,
  );

module.exports = router;
