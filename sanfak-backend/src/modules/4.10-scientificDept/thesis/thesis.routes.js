const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./thesis.controller");
const {
  createThesisSchema,
  updateThesisSchema,
  rejectThesisSchema,
  thesisQuerySchema,
  thesisPaginateSchema,
} = require("./thesis.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.THESIS, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.THESIS, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.THESIS, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.THESIS, [ACTIONS.UPDATE]);
const permitDelete = permit(MODULES.THESIS, [ACTIONS.DELETE]);
const permitApprove = permit(MODULES.THESIS, [ACTIONS.APPROVE]);
const permitReject = permit(MODULES.THESIS, [ACTIONS.REJECT]);
const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createThesisSchema),
    Controller.addThesis,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(thesisQuerySchema),
    Controller.findAllTheses,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(thesisPaginateSchema),
    Controller.paginateTheses,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneThesis,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateThesisSchema),
    Controller.updateThesis,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteThesis,
  );

router
  .route("/:id/review")
  .put(permitApprove, validator.params(readSchema), Controller.reviewThesis);

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveThesis);

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectThesisSchema),
    Controller.rejectThesis,
  );

module.exports = router;
