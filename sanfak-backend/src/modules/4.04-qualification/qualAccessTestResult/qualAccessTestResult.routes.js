const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualAccessTestResult.controller");
const Validation = require("./qualAccessTestResult.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/start")
  .post(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.CREATE]),
    Controller.qualAccessTestResultStart,
  );

router
  .route("/select-option")
  .post(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualAccessTestResultSelectOption,
  );

router
  .route("/finish")
  .post(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualAccessTestResultFinish,
  );

router
  .route("/")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualAccessTestResults,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualAccessTestResults,
  );

router
  .route("/:course")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.READ]),
    Controller.qualAccessTestResultGetMy,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_ACCESS_TEST_RESULT, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualAccessTestResult,
  );

module.exports = router;
