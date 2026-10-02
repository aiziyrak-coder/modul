const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./dashboard.controller");

router.use(authenticate);

router
  .route("/stats")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ]), Controller.getStats);

router
  .route("/statistics")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ_ALL]), Controller.getStatistics);

router
  .route("/contracts-series")
  .get(permit(MODULES.SCIENTIFIC_PORTAL, [ACTIONS.READ_ALL]), Controller.getContractsSeries);

module.exports = router;
