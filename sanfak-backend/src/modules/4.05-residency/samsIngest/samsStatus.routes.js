"use strict";

const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./samsStatus.controller");
const V = require("./samsStatus.validation");

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

router.use(authenticate, noStore);

const P = permit(MODULES.RESIDENCY_LESSON, [ACTIONS.UPDATE]);
const permitResidentRead = permit(MODULES.RESIDENT_ATTENDANCE, [ACTIONS.READ_ALL]);

router.route("/overview").get(P, validator.query(V.overviewQuery), C.overview);
router.route("/days").get(P, validator.query(V.daysQuery), C.days);
router.route("/warnings").get(P, validator.query(V.warningsQuery), C.warnings);
router
  .route("/clinics/:dbname/days/:day")
  .get(P, validator.params(V.clinicDayParams), validator.query(V.pageQuery), C.clinicDay);
router
  .route("/residents/:resident/baseline")
  .get(permitResidentRead, validator.params(V.residentParams), validator.query(V.baselineQuery), C.residentBaseline);

module.exports = router;
