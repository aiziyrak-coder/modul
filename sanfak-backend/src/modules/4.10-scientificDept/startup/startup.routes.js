const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./startup.controller");
const {
  createStartupSchema,
  updateStartupSchema,
  startupQuerySchema,
  startupPaginateSchema,
} = require("./startup.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.STARTUP, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.STARTUP, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.STARTUP, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.STARTUP, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.STARTUP, [ACTIONS.DELETE]);

const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createStartupSchema),
    Controller.addStartup,
  )
  .get(permitReadAll, scope, validator.query(startupQuerySchema), Controller.findAllStartups);

router
  .route("/paginate")
  .get(permitReadAll, scope, validator.query(startupPaginateSchema), Controller.paginateStartups);

router
  .route("/:id/archive")
  .get(permitFindOne, scope, validator.params(readSchema), Controller.downloadStartupArchive);

router
  .route("/:id")
  .get(permitFindOne, scope, validator.params(readSchema), Controller.findOneStartup)
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateStartupSchema),
    Controller.updateStartup,
  )
  .delete(permitDelete, validator.params(deleteSchema), Controller.deleteStartup);

module.exports = router;
