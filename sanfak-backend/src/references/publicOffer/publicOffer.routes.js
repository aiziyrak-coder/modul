const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./publicOffer.controller");
const {
  createPublicOfferSchema,
  updatePublicOfferSchema,
} = require("./publicOffer.validation");
const { readSchema, deleteSchema } = require("#validators/common");

router.use(authenticate);

const permitRead = permit(MODULES.PUBLIC_OFFER, [ACTIONS.READ]);
const permitReadAll = permit(MODULES.PUBLIC_OFFER, [ACTIONS.READ_ALL]);
const permitCreate = permit(MODULES.PUBLIC_OFFER, [ACTIONS.CREATE]);
const permitUpdate = permit(MODULES.PUBLIC_OFFER, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.PUBLIC_OFFER, [ACTIONS.DELETE]);

router
  .route("/")
  .post(permitCreate, validator.body(createPublicOfferSchema), Controller.create);

router.route("/").get(permitRead, Controller.findAll);

router
  .route("/")
  .put(permitUpdate, validator.body(updatePublicOfferSchema), Controller.update);

router.route("/paginate").get(permitReadAll, Controller.paginate);

router.route("/:id").get(permitRead, validator.params(readSchema), Controller.findOne);

router
  .route("/:id")
  .put(
    permitUpdate,
    validator.params(readSchema),
    validator.body(updatePublicOfferSchema),
    Controller.updateById,
  );

router
  .route("/:id")
  .delete(permitDelete, validator.params(deleteSchema), Controller.delete);

module.exports = router;
