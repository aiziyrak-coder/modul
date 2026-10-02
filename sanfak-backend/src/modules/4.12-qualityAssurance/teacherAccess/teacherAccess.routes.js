const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const Joi = require("joi");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./teacherAccess.controller");
const { teacherAccessSchema } = require("./teacherAccess.validation");

router.use(authenticate);

const permitRead = permit(MODULES.INDICATOR_SUBMISSION, [
  ACTIONS.READ_ALL,
  ACTIONS.READ,
]);
const permitSet = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.UPDATE]);

const teacherParam = Joi.object({
  teacher: Joi.string().hex().length(24).required(),
});

router.route("/").get(permitRead, Controller.findAllAccess);

router
  .route("/:teacher")
  .get(permitRead, validator.params(teacherParam), Controller.findOneAccess)
  .put(
    permitSet,
    validator.params(teacherParam),
    validator.body(teacherAccessSchema),
    Controller.setAccess,
  );

module.exports = router;
