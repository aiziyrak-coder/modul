const { Router } = require("express");
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { ACTIONS, ROLES } = require("#config/constants");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

function createAchievementRoutes({
  moduleKey,
  controller,
  createSchema,
  updateSchema,
  rejectSchema,
  querySchema,
  paginateSchema,
}) {
  const router = Router();
  router.use(authenticate);

  const permitAdd = permit(moduleKey, [ACTIONS.CREATE]);
  const permitReadAll = permit(moduleKey, [ACTIONS.READ_ALL]);
  const permitFindOne = permit(moduleKey, [ACTIONS.READ]);
  const permitUpdate = permit(moduleKey, [ACTIONS.UPDATE]);
  const permitApprove = permit(moduleKey, [ACTIONS.APPROVE]);
  const permitReject = permit(moduleKey, [ACTIONS.REJECT]);
  const permitDelete = permit(moduleKey, [ACTIONS.DELETE]);
  const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

  router
    .route("/")
    .post(
      permitAdd,
      uploadImages,
      resizeImages,
      validator.body(createSchema),
      controller.add,
    )
    .get(permitReadAll, scope, validator.query(querySchema), controller.findAll);

  router
    .route("/paginate")
    .get(permitReadAll, scope, validator.query(paginateSchema), controller.paginate);

  router
    .route("/:id")
    .get(permitFindOne, scope, validator.params(readSchema), controller.findOne)
    .put(
      permitUpdate,
      validator.params(readSchema),
      uploadImages,
      resizeImages,
      validator.body(updateSchema),
      controller.update,
    )
    .delete(permitDelete, validator.params(deleteSchema), controller.remove);

  router
    .route("/:id/approve")
    .put(permitApprove, validator.params(readSchema), controller.approve);

  router
    .route("/:id/reject")
    .put(
      permitReject,
      validator.params(readSchema),
      validator.body(rejectSchema),
      controller.reject,
    );

  return router;
}

module.exports = { createAchievementRoutes };
