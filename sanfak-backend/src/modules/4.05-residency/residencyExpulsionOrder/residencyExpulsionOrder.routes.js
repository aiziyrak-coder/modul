const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const requireEri = require("#shared/requireEri");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyExpulsionOrder.controller");
const V = require("./residencyExpulsionOrder.validation");
const { officeOnly, receiveScan } = require("./residencyExpulsionOrder.upload");

router.use(authenticate);

const P = permit(MODULES.RESIDENT, [ACTIONS.CHANGE_STATUS]);

router.route("/paginate").get(P, validator.query(V.paginateQuery), C.paginate);

router
  .route("/:id/scan")
  .get(P, validator.params(V.idSchema), officeOnly, C.downloadScan)
  .put(P, validator.params(V.idSchema), officeOnly, receiveScan, C.uploadScan);

router
  .route("/:id/draft-pdf")
  .head(C.draftPdfHead)
  .get(P, validator.params(V.idSchema), officeOnly, C.downloadDraftPdf);

router.route("/:id/sign").put(
  P,
  validator.params(V.idSchema),
  officeOnly,
  validator.body(V.signSchema),
  requireEri({ optional: true }),
  C.sign,
);

router
  .route("/:id/reject")
  .put(P, validator.params(V.idSchema), officeOnly, validator.body(V.rejectSchema), C.reject);

router.route("/:id").get(P, validator.params(V.idSchema), C.findOne);

module.exports = router;
