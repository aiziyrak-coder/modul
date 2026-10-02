const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./user.controller");
const {
  createSchema,
  updateSchema,
  deleteSchema,
  readSchema,
  findAll,
  paginate,
  lookupSchema,
  changeStatusSchema,
  readSchemaQuery,
  updateSchemaProfessor,
  deleteFileSchema,
  revokeSessionsSchema,
} = require("./user.validation");
const { resizeImages, uploadImages } = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/")
  .post(
    permit(MODULES.USER, [ACTIONS.CREATE]),
    uploadImages,
    resizeImages,
    validator.body(createSchema),
    Controller.addNew,
  );

router
  .route("/professor/delete-file")
  .post(
    permit(MODULES.USER, [ACTIONS.UPDATE]),
    validator.body(deleteFileSchema),
    Controller.deleteFile,
  );

router
  .route("/")
  .get(permit(MODULES.USER, [ACTIONS.READ_ALL]), validator.query(findAll), Controller.findAll);

router
  .route("/paginate")
  .get(permit(MODULES.USER, [ACTIONS.READ_ALL]), validator.query(paginate), Controller.paginate);

router
  .route("/lookup")
  .get(permit(MODULES.USER, [ACTIONS.SEARCH]), validator.query(lookupSchema), Controller.lookup);

router
  .route("/:id")
  .get(permit(MODULES.USER, [ACTIONS.READ]), validator.params(readSchema), validator.query(readSchemaQuery), Controller.findOne);

router
  .route("/professor/:id")
  .put(
    permit(MODULES.USER, [ACTIONS.UPDATE]),
    uploadImages,
    resizeImages,
    validator.params(readSchema),
    validator.body(updateSchemaProfessor),
    Controller.updateProfessor,
  );

router
  .route("/:id")
  .put(
    permit(MODULES.USER, [ACTIONS.UPDATE]),
    uploadImages,
    resizeImages,
    validator.params(readSchema),
    validator.body(updateSchema),
    Controller.update,
  );

router
  .route("/active/:id")
  .put(
    permit(MODULES.USER, [ACTIONS.CHANGE_STATUS]),
    validator.params(readSchema),
    validator.body(changeStatusSchema),
    Controller.changeStatus,
  );

router
  .route("/:id/revoke-sessions")
  .post(
    permit(MODULES.USER, [ACTIONS.UPDATE]),
    validator.params(revokeSessionsSchema),
    Controller.revokeSessions,
  );

router
  .route("/:id")
  .delete(permit(MODULES.USER, [ACTIONS.DELETE]), validator.params(deleteSchema), Controller.delete);

module.exports = router;
