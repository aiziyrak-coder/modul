"use strict";
const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const validator = require("#shared/validator");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./studyLoadStatistics.controller");
const { oubQuery } = require("./studyLoadStatistics.validation");

router.use(authenticate);

router
  .route("/overview")
  .get(permit(MODULES.WORKLOAD, [ACTIONS.READ_ALL]), Controller.overview);

const oubGate = [permit(MODULES.STATISTICS, [ACTIONS.READ]), scopeFilter("faculty")];

router
  .route("/oub-overview")
  .get(...oubGate, validator.query(oubQuery), Controller.oubOverview);
router
  .route("/oub-faculties")
  .get(...oubGate, validator.query(oubQuery), Controller.oubFaculties);
router
  .route("/oub-teachers")
  .get(...oubGate, validator.query(oubQuery), Controller.oubTeachers);

module.exports = router;
