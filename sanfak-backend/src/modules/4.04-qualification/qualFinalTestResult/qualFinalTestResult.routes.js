const router = require("express").Router();
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualFinalTestResult.controller");

router.use(authenticate);

router
  .route("/start")
  .post(
    permit(MODULES.QUAL_FINAL_TEST_RESULT, [ACTIONS.CREATE]),
    Controller.qualFinalTestResultStart,
  );

router
  .route("/select-option")
  .post(
    permit(MODULES.QUAL_FINAL_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualFinalTestResultSelectOption,
  );

router
  .route("/finish")
  .post(
    permit(MODULES.QUAL_FINAL_TEST_RESULT, [ACTIONS.UPDATE]),
    Controller.qualFinalTestResultFinish,
  );

router
  .route("/:course/:topic")
  .get(
    permit(MODULES.QUAL_FINAL_TEST_RESULT, [ACTIONS.READ]),
    Controller.qualFinalTestResultGetMy,
  );

module.exports = router;
