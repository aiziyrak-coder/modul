const router = require("express").Router();
const validator = require("#shared/validator");
const authenticate = require("#shared/authenticate");
const permit = require("#shared/permission");
const scopeFilter = require("#shared/scopeFilter");
const { MODULES, ACTIONS, ROLES } = require("#config/constants");
const Controller = require("./indicatorSubmission.controller");
const {
  submissionSchema,
  updateSchema,
  reviewSchema,
  submissionQuery,
  submissionPaginateQuery,
} = require("./indicatorSubmission.validation");
const { readSchema } = require("#validators/common");
const {
  uploadSubmissionFiles,
  persistSubmissionFiles,
} = require("#modules/4.12-qualityAssurance/_shared/qualityUpload");

router.use(authenticate);

const permitAdd = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.CREATE]);
const permitReadAll = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.READ_ALL]);
const permitList = permit(MODULES.INDICATOR_SUBMISSION, [
  ACTIONS.READ_ALL,
  ACTIONS.READ,
]);
const permitFindOne = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.READ]);
const permitUpdate = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.UPDATE]);
const permitReview = permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.APPROVE]);
const scope        = scopeFilter("user", {
  bypassRoles: [ROLES.TALIM_SIFATI_NAZORATI, ROLES.SIFAT_BOLIMI],
});

router
  .route("/")
  .post(
    permitAdd,
    uploadSubmissionFiles,
    validator.body(submissionSchema),
    persistSubmissionFiles,
    Controller.addSubmission,
  )
  .get(permitList, scope, validator.query(submissionQuery), Controller.findAllSubmissions);

router
  .route("/paginate")
  .get(
    permitList,
    scope,
    validator.query(submissionPaginateQuery),
    Controller.paginateSubmissions,
  );

router
  .route("/4.03-teacher/:teacher/score")
  .get(permitReadAll, Controller.getTeacherScore);

router
  .route("/_system/report/faculty")
  .get(permitReadAll, Controller.getReportByFaculty);
router
  .route("/_system/report/department")
  .get(permitReadAll, Controller.getReportByDepartment);
router
  .route("/_system/report/teachers")
  .get(permitReadAll, Controller.getReportByTeachers);

router
  .route("/_system/files.zip")
  .get(
    permit(MODULES.INDICATOR_SUBMISSION, [ACTIONS.EXPORT, ACTIONS.READ_ALL]),
    Controller.getSubmissionFilesZip,
  );

router
  .route("/:id")
  .get(permitFindOne, validator.params(readSchema), Controller.findOneSubmission)
  .put(
    permitUpdate,
    uploadSubmissionFiles,
    validator.params(readSchema),
    validator.body(updateSchema),
    persistSubmissionFiles,
    Controller.updateSubmission,
  );

router
  .route("/:id/review")
  .put(
    permitReview,
    validator.params(readSchema),
    validator.body(reviewSchema),
    Controller.reviewSubmission,
  );

module.exports = router;
