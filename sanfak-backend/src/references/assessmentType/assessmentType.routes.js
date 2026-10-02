const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const common = require("#validators/common");
const validator = require("#shared/validator");
const Controller = require("./assessmentType.controller");
const {
  createAssessmentTypeSchema,
  updateAssessmentTypeSchema,
} = require("./assessmentType.validation");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.CREATE]),
  validator.body(createAssessmentTypeSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.READ_ALL]),
  validator.query(common.findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.READ_ALL]),
  validator.query(common.paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.READ]),
  validator.params(common.readSchema),
  validator.query(common.readSchemaQuery),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.UPDATE]),
  validator.params(common.readSchema),
  validator.body(updateAssessmentTypeSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.ASSESSMENT_TYPE, [ACTIONS.DELETE]),
  validator.params(common.deleteSchema),
  Controller.delete,
);

module.exports = router;
