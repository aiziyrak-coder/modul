const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./residencySessionGrade.controller");
const V = require("./residencySessionGrade.validation");

const M = MODULES.RESIDENT_ATTENDANCE;
const P_READ = permit(M, [ACTIONS.READ_ALL]);
const P_GRADE = permit(M, [ACTIONS.UPDATE]);

router
  .route("/residents/:resident/attendance-context")
  .get(P_READ, validator.params(V.residentParam), C.context);

router
  .route("/:id/entries/:resident/score")
  .put(P_GRADE, validator.params(V.gradeParams), validator.body(V.gradeBody), C.grade);

module.exports = router;
