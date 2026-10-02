const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualExitTestResult.controller");
const Validation = require("./qualExitTestResult.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/start")
  .post(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.CREATE]),
    Controller.qualExitTestResultStart,
  );

router
  .route("/select-option")
  .post(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualExitTestResultSelectOption,
  );

router
  .route("/finish")
  .post(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualExitTestResultFinish,
  );

router
  .route("/")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualExitTestResults,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualExitTestResults,
  );

router
  .route("/my-courses")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ]),
    Controller.getMyExitCourses,
  );

router
  .route("/my-certificates")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ]),
    Controller.getMyCertificates,
  );

router
  .route("/active")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ]),
    Controller.getMyActiveExitTest,
  );

router
  .route("/:course")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ]),
    Controller.qualExitTestResultGetMy,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_EXIT_TEST_RESULT, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualExitTestResult,
  );

module.exports = router;
