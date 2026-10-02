const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./startupType.controller");
const {
  createStartupTypeSchema,
  updateStartupTypeSchema,
  startupTypeQuerySchema,
  startupTypePaginateSchema,
} = require("./startupType.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.STARTUP_TYPE, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.STARTUP_TYPE, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.STARTUP_TYPE, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.STARTUP_TYPE, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STARTUP_TYPE, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(createStartupTypeSchema), Controller.addStartupType)
  .get(permitReadAll, validator.query(startupTypeQuerySchema), Controller.findAllStartupTypes);

router
  .route("/paginate")
  .get(
    permitReadAll,
    validator.query(startupTypePaginateSchema),
    Controller.paginateStartupTypes,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneStartupType)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updateStartupTypeSchema),
    Controller.updateStartupType,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteStartupType);

module.exports = router;
