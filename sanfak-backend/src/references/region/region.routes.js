const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./region.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./region.validation");

router.use(authenticate);

router.post(
  "/",
  permit(MODULES.REGION, [ACTIONS.CREATE]),
  validator.body(createSchema),
  Controller.create,
);
router.get(
  "/",
  permit(MODULES.REGION, [ACTIONS.READ_ALL]),
  validator.query(findAll),
  Controller.findAll,
);
router.get(
  "/paginate",
  permit(MODULES.REGION, [ACTIONS.READ_ALL]),
  validator.query(paginate),
  Controller.paginate,
);
router.get(
  "/:id",
  permit(MODULES.REGION, [ACTIONS.READ]),
  validator.params(readSchema),
  Controller.findOne,
);
router.put(
  "/:id",
  permit(MODULES.REGION, [ACTIONS.UPDATE]),
  validator.params(readSchema),
  validator.body(updateSchema),
  Controller.update,
);
router.delete(
  "/:id",
  permit(MODULES.REGION, [ACTIONS.DELETE]),
  validator.params(deleteSchema),
  Controller.delete,
);

module.exports = router;
