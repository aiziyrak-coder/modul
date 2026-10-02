const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./indicator.controller");
const {
  indicatorSchema,
  indicatorUpdateSchema,
} = require("./indicator.validation");
const {
  findAll,
  paginate,
  readSchema,
  deleteSchema,
} = require("#validators/common");

router.use(authenticate);

const permitAdd = permit(MODULES.INDICATOR, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.INDICATOR, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.INDICATOR, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.INDICATOR, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.INDICATOR, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitAdd, validator.body(indicatorSchema), Controller.addIndicator)
  .get(permitReadAll, validator.query(findAll), Controller.findAllIndicators);

router
  .route("/paginate")
  .get(permitReadAll, validator.query(paginate), Controller.paginateIndicators);

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneIndicator)
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(indicatorUpdateSchema),
    Controller.updateIndicator,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteIndicator,
  );

module.exports = router;
