const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const requireEri = require("#shared/requireEri");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./monograph.controller");
const {
  createMonographSchema,
  updateMonographSchema,
  signMonographSchema,
  rejectMonographSchema,
  ssvDecisionSchema,
  fillDataSchema,
  monographQuerySchema,
  monographPaginateSchema,
} = require("./monograph.validation");
const { readSchema, deleteSchema } = require("#validators/common");
const { uploadImages, resizeImages } = require("#shared/uploadFiles");

router.use(authenticate);

const permitAdd = permit(MODULES.MONOGRAPH, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.MONOGRAPH, [ACTIONS.READ_ALL]);
const permitFindOne = permit(MODULES.MONOGRAPH, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.MONOGRAPH, [ACTIONS.UPDATE]);
const permitApprove = permit(MODULES.MONOGRAPH, [ACTIONS.APPROVE]);
const permitSign = permit(MODULES.MONOGRAPH, [ACTIONS.SIGN]);
const permitReject = permit(MODULES.MONOGRAPH, [ACTIONS.REJECT]);
const permitDelete = permit(MODULES.MONOGRAPH, [ACTIONS.DELETE]);
const scope = scopeFilter("user", { bypassRoles: [ROLES.ILMIY_BOLIM] });

router
  .route("/")
  .post(
    permitAdd,
    uploadImages,
    resizeImages,
    validator.body(createMonographSchema),
    Controller.addMonograph,
  )
  .get(
    permitReadAll,
    scope,
    validator.query(monographQuerySchema),
    Controller.findAllMonographs,
  );

router
  .route("/paginate")
  .get(
    permitReadAll,
    scope,
    validator.query(monographPaginateSchema),
    Controller.paginateMonographs,
  );

router
  .route("/:id/archive")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.downloadMonographArchive,
  );

router
  .route("/:id")
  .get(
    permitFindOne,
    scope,
    validator.params(readSchema),
    Controller.findOneMonograph,
  )
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(updateMonographSchema),
    Controller.updateMonograph,
  )
  .delete(
    permitDelete,
    validator.params(deleteSchema),
    Controller.deleteMonograph,
  );

router
  .route("/:id/approve")
  .put(permitApprove, validator.params(readSchema), Controller.approveMonograph);

router
  .route("/:id/sign")
  .put(
    permitSign,
    validator.params(readSchema),
    validator.body(signMonographSchema),
    requireEri({ optional: true }),
    Controller.signMonograph,
  );

router
  .route("/:id/reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectMonographSchema),
    Controller.rejectMonograph,
  );

router
  .route("/:id/ssv-send")
  .put(permitApprove, validator.params(readSchema), Controller.ssvSendMonograph);

router
  .route("/:id/ssv-response")
  .put(
    permitApprove,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(ssvDecisionSchema),
    Controller.ssvDecisionMonograph,
  );

router
  .route("/:id/fill-data")
  .put(
    permitUpdate,
    validator.params(readSchema),
    uploadImages,
    resizeImages,
    validator.body(fillDataSchema),
    Controller.fillDataMonograph,
  );

router
  .route("/:id/data-approve")
  .put(
    permitApprove,
    validator.params(readSchema),
    Controller.dataApproveMonograph,
  );

router
  .route("/:id/data-reject")
  .put(
    permitReject,
    validator.params(readSchema),
    validator.body(rejectMonographSchema),
    Controller.dataRejectMonograph,
  );

module.exports = router;
