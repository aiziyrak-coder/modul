const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const requireEri = require("#shared/requireEri");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./methodicalRecommendation.controller");
const {
  createMethodicalSchema,
  updateMethodicalSchema,
  signMethodicalSchema,
  rejectMethodicalSchema,
  methodicalQuerySchema,
  methodicalPaginateSchema,
} = require("./methodicalRecommendation.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.METHODICAL_RECOMMENDATION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.METHODICAL_RECOMMENDATION, [
  ACTIONS.READ_ALL,
]);
const permitFindOne = permit(MODULES.METHODICAL_RECOMMENDATION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.METHODICAL_RECOMMENDATION, [
  ACTIONS.UPDATE,
]);
const permitApprove = permit(MODULES.METHODICAL_RECOMMENDATION, [
  ACTIONS.APPROVE,
]);
const permitSign = permit(MODULES.METHODICAL_RECOMMENDATION, [ACTIONS.SIGN]);
const permitReject = permit(MODULES.METHODICAL_RECOMMENDATION, [
  ACTIONS.REJECT,
]);
const permitDelete = permit(MODULES.METHODICAL_RECOMMENDATION, [
  ACTIONS.DELETE,
]);
const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createMethodicalSchema),
    Controller.addMethodical,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(methodicalQuerySchema),
    Controller.findAllMethodicals,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(methodicalPaginateSchema),
    Controller.paginateMethodicals,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneMethodical,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateMethodicalSchema),
    Controller.updateMethodical,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteMethodical,
  );

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveMethodical);

router
  .route("/:id/sign")
  .put(
    permitSign,
    validator.params(readSchema),
    validator.body(signMethodicalSchema),
    requireEri({ optional: true }),
    Controller.signMethodical,
  );

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectMethodicalSchema),
    Controller.rejectMethodical,
  );

module.exports = router;
