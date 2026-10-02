const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const C = require("./assessment.controller");
const V = require("./assessment.validation");

router.use(authenticate);

const M = MODULES.RESIDENT_ASSESSMENT;

router
  .route("/")
  .post(permit(M, [ACTIONS.CREATE]), validator.body(V.createSchema), C.addAssessment)
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.listQuery),
    C.findAllAssessments,
  );

router
  .route("/paginate")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.query(V.paginateQuery),
    C.paginateAssessments,
  );

router
  .route("/grade")
  .post(permit(M, [ACTIONS.SCORE]), validator.body(V.gradeSchema), C.gradeAssessment);

router
  .route("/resident/:residentId")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.params(V.residentIdSchema),
    C.findAssessmentsByResident,
  );

router
  .route("/resident/:residentId/eligibility")
  .get(
    permit(M, [ACTIONS.READ_ALL]),
    validator.params(V.residentIdSchema),
    validator.query(V.eligibilityQuery),
    C.attestationEligibility,
  );

router
  .route("/:id")
  .put(
    permit(M, [ACTIONS.UPDATE]),
    validator.params(V.idSchema),
    validator.body(V.updateSchema),
    C.updateAssessment,
  )
  .delete(permit(M, [ACTIONS.DELETE]), validator.params(V.idSchema), C.deleteAssessment);

module.exports = router;
