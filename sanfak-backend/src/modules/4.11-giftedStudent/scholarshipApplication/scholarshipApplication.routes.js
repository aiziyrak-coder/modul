const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const { scopeOrBypass } = require("../_services/moduleScope");
const { APPLICATION_REVIEWER } = require("../_services/moduleRoles");
const { MODULES, ACTIONS } = require("#config/constants");
const Controller = require("./scholarshipApplication.controller");
const {
  applySchema,
  reviewSchema,
  scoreSchema,
  findAll,
} = require("./scholarshipApplication.validation");

router.use(authenticate);

const pRead = permit(MODULES.SCHOLARSHIP_APPLICATION, [
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
]);
const pReview = permit(MODULES.SCHOLARSHIP_APPLICATION, [ACTIONS.UPDATE]);
const pStudent = permit(MODULES.SCHOLARSHIP_APPLICATION, [
  ACTIONS.CREATE,
  ACTIONS.READ,
]);
const pDelete = permit(MODULES.SCHOLARSHIP_APPLICATION, [ACTIONS.DELETE]);
const pScore  = permit(MODULES.SCHOLARSHIP_APPLICATION, [ACTIONS.SCORE]);
const scope   = scopeOrBypass("user", APPLICATION_REVIEWER);

router.post(
  "/apply",
  pStudent,
  validator.body(applySchema),
  Controller.applyForScholarship,
);
router.get("/my", pStudent, Controller.getMyApplications);

router.get("/by-student/:studentId", pRead, Controller.findByStudent);

router.get("/", pRead, validator.query(findAll), Controller.findAll);
router.get("/:id", pRead, Controller.findOne);
router.put(
  "/:id/review",
  pReview,
  validator.body(reviewSchema),
  Controller.reviewApplication,
);
router.put(
  "/:id/score",
  pScore,
  validator.body(scoreSchema),
  Controller.scoreApplication,
);
router.delete("/:id", pDelete, Controller.delete);

module.exports = router;
