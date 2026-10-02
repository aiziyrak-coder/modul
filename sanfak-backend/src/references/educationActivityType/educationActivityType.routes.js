const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const Controller = require("./educationActivityType.controller");
const {
  createEducationActivityTypeSchema,
  updateEducationActivityTypeSchema,
} = require("./educationActivityType.validation");

const validator = require("#shared/validator");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.CREATE]),
  validator.body(createEducationActivityTypeSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.READ]),
  validator.params(common.readSchema),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  validator.body(updateEducationActivityTypeSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.EDUCATION_ACTIVITY_TYPE, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
