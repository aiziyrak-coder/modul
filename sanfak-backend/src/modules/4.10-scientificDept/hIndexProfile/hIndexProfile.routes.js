const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./hIndexProfile.controller");
const {
  upsertHIndexSchema,
  hIndexQuerySchema,
  hIndexPaginateSchema,
} = require("./hIndexProfile.validation");
const { readSchema } = require("#validators/common");

router.use(authenticate);

const permitReadAll = permit(MODULES.H_INDEX, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.H_INDEX, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.H_INDEX, [ACTIONS.UPDATE]);

const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/mine")
  .get(permitFindOne, Controller.findMine)
  .put(permitUpdate, validator.body(upsertHIndexSchema), Controller.upsertMine);

router.route("/mine/refresh").put(permitUpdate, Controller.refreshMine);

router
  .route("/export")
  .get(
    permitReadAll,
    scope,
    validator.query(hIndexQuerySchema),
    Controller.exportProfiles,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(hIndexPaginateSchema),
    Controller.paginateProfiles,
  );

router
  .route("/")
  .get(
    permitReadAll,
    scope,
    validator.query(hIndexQuerySchema),
    Controller.findAllProfiles,
  );

router
  .route("/:id/refresh")
  .put(
    permitUpdate,
    scope,
    validator.params(readSchema),
    Controller.refreshProfile,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneProfile,
  );

module.exports = router;
