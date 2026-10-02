const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./evaluationCriteria.controller");
const {
  criteriaSchema,
  updateSchema,
  findAll,
  readSchema,
  deleteSchema,
} = require("./evaluationCriteria.validation");

router.use(authenticate);

const permitAdd = permit(MODULES.EVALUATION_CRITERIA, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.EVALUATION_CRITERIA, [ACTIONS.READ_ALL]);
const permitUpdate = permit(MODULES.EVALUATION_CRITERIA, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.EVALUATION_CRITERIA, [ACTIONS.DELETE]);

router
  .route("/criteria")
  .post(permitAdd, validator.body(criteriaSchema), Controller.addCriteria)
  .get(permitReadAll, validator.query(findAll), Controller.findAllCriteria);

router
  .route("/criteria/:id")
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.updateCriteria,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteCriteria);

module.exports = router;
