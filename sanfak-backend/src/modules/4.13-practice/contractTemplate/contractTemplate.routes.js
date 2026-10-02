const router = require("express").Router();
const validator = require("#shared/validator");
const Joi = require("joi");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./contractTemplate.controller");

const saveSchema = Joi.object({
  body: Joi.string().min(1).required(),
});

router.use(authenticate);

router.get("/", permit(MODULES.PRACTICE, [ACTIONS.READ]), Controller.getTemplate);

router.put(
  "/",
  permit(MODULES.PRACTICE, [ACTIONS.UPDATE]),
  validator.body(saveSchema),
  Controller.saveTemplate,
);

module.exports = router;
