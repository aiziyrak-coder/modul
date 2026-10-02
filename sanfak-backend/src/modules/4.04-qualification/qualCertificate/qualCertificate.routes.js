const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualCertificate.controller");
const Validation = require("./qualCertificate.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/pending-count")
  .get(permit(MODULES.QUAL_CERTIFICATE, [ACTIONS.READ_ALL]), Controller.pendingCount);

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_CERTIFICATE, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginate,
  );

router
  .route("/approve")
  .post(
    permit(MODULES.QUAL_CERTIFICATE, [ACTIONS.UPDATE]),
    validator.body(Validation.idsSchema),
    Controller.approve,
  );

router
  .route("/reject")
  .post(
    permit(MODULES.QUAL_CERTIFICATE, [ACTIONS.UPDATE]),
    validator.body(Validation.rejectSchema),
    Controller.reject,
  );

module.exports = router;
