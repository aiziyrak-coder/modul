const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualPayment.controller");
const Validation = require("./qualPayment.validation");
const UploadMiddleware = require("#shared/uploadFiles");

router.use(authenticate);

router
  .route("/my")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ]),
    validator.query(Validation.myQuery),
    Controller.getMyPayment,
  );

router
  .route("/bank")
  .post(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.CREATE]),
    UploadMiddleware.uploadImages,
    UploadMiddleware.resizeImages,
    validator.body(Validation.bankSchema),
    Controller.submitBankPayment,
  );

router
  .route("/")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ_ALL]),
    Controller.findAllQualPayments,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ_ALL]),
    Controller.paginateQualPayments,
  );

router
  .route("/detail")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ_ALL]),
    Controller.findOneQualPayment,
  );

router
  .route("/payments-monitoring")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ_ALL]),
    Controller.paymentsMonitoring,
  );

router
  .route("/payments-monitoring/:contract")
  .get(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.READ_ALL]),
    Controller.paymentHistory,
  );

router
  .route("/payment/:id")
  .put(
    permit(MODULES.QUAL_PAYMENT, [ACTIONS.UPDATE]),
    Controller.updatePayment,
  );

module.exports = router;
