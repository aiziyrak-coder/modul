const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencyReport.controller");
const V = require("./residencyReport.validation");

router.use(authenticate);

const M = MODULES.RESIDENCY_REPORT;
const pRead = permit(M, [ACTIONS.READ_ALL]);
const q = validator.query(V.reportQuery);

router.route("/").get(pRead, q, C.getFullReport);

router.route("/summary").get(pRead, q, C.getSummary);
router.route("/attendance").get(pRead, q, C.getAttendance);
router.route("/scores").get(pRead, q, C.getScores);
router.route("/contingent").get(pRead, q, C.getContingent);

module.exports = router;
