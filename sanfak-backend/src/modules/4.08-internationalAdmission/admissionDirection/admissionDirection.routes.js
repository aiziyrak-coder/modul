const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./admissionDirection.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./admissionDirection.validation");

router.use(authenticate);

const M = MODULES.ADMISSION_DIRECTION;

router.post("/", permit(M, [ACTIONS.CREATE]), validator.body(createSchema), Controller.add);
router.get("/", permit(M, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAll);

router.get("/paginate", permit(M, [ACTIONS.READ_ALL]), validator.query(paginate), Controller.paginate);

router.get("/:id", permit(M, [ACTIONS.READ]), validator.params(readSchema), Controller.findOne);
router.put("/:id", permit(M, [ACTIONS.UPDATE]), validator.body(updateSchema), Controller.update);
router.delete("/:id", permit(M, [ACTIONS.DELETE]), validator.params(deleteSchema), Controller.remove);

module.exports = router;
