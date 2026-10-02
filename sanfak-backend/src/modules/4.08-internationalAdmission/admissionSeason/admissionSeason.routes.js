const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./admissionSeason.controller");
const {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("./admissionSeason.validation");

router.use(authenticate);

const M = MODULES.ADMISSION_SEASON;

router.post("/", permit(M, [ACTIONS.CREATE]), validator.body(createSchema), Controller.add);
router.get("/", permit(M, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAll);

router.get("/paginate", permit(M, [ACTIONS.READ_ALL]), validator.query(paginate), Controller.paginate);
router.get("/open", permit(M, [ACTIONS.READ_ALL]), Controller.findOpen);
router.get("/academic-years", permit(M, [ACTIONS.READ_ALL]), Controller.academicYears);

router.get("/:id", permit(M, [ACTIONS.READ]), validator.params(readSchema), Controller.findOne);
router.put("/:id", permit(M, [ACTIONS.UPDATE]), validator.body(updateSchema), Controller.update);

router.put("/:id/close", permit(M, [ACTIONS.CHANGE_STATUS]), validator.params(readSchema), Controller.closeSeason);

router.delete("/:id", permit(M, [ACTIONS.DELETE]), validator.params(deleteSchema), Controller.remove);

module.exports = router;
