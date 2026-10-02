"use strict";
const router = require("express").Router();
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./giftedStatistics.controller");

router.use(authenticate);

router
  .route("/overview")
  .get(permit(MODULES.GIFTED_STUDENT, [ACTIONS.READ_ALL]), Controller.overview);

module.exports = router;
