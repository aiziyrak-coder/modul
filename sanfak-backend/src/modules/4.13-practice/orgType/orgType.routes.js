const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./orgType.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./orgType.validation");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.ORG_TYPE, [ACTIONS.CREATE]),
  validator.body(createSchema),
  Controller.create,
);

router.get(
  "/",
  permit(MODULES.ORG_TYPE, [ACTIONS.READ_ALL]),
  validator.query(findAll),
  Controller.findAll,
);

router.get(
  "/paginate",
  permit(MODULES.ORG_TYPE, [ACTIONS.READ_ALL]),
  validator.query(paginate),
  Controller.paginate,
);

router.get(
  "/:id",
  permit(MODULES.ORG_TYPE, [ACTIONS.READ]),
  validator.params(readSchema),
  Controller.findOne,
);

router.put(
  "/:id",
  permit(MODULES.ORG_TYPE, [ACTIONS.UPDATE]),
  validator.params(readSchema),
  validator.body(updateSchema),
  Controller.update,
);

router.delete(
  "/:id",
  permit(MODULES.ORG_TYPE, [ACTIONS.DELETE]),
  validator.params(deleteSchema),
  Controller.delete,
);

module.exports = router;
