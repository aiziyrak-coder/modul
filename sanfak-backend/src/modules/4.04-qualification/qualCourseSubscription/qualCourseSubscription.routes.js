const router = require("express").Router();
const validator = require("#shared/validator");
const permit = require("#shared/permission");
const { MODULES, ACTIONS } = require("#config/constants");
const authenticate = require("#shared/authenticate");
const Controller = require("./qualCourseSubscription.controller");
const Validation = require("./qualCourseSubscription.validation");
const ValidationCommon = require("#validators/common");

router.use(authenticate);

router
  .route("/")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.findAll),
    Controller.findAllQualCourseSubscriptions,
  );

router
  .route("/paginate")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ_ALL]),
    validator.query(ValidationCommon.paginate),
    Controller.paginateQualCourseSubscriptions,
  );

router
  .route("/my")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ]),
    Controller.findMyCourses,
  );

router
  .route("/students-monitoring")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ_ALL]),
    validator.query(Validation.studentsMonitoringQuery),
    Controller.studentsMonitoring,
  );

router
  .route("/students-monitoring/:id")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ_ALL]),
    validator.params(ValidationCommon.readSchema),
    Controller.studentMonitoringDetail,
  );

router
  .route("/progress-report")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ_ALL]),
    validator.query(Validation.progressReportQuery),
    Controller.progressReport,
  );

router
  .route("/:id")
  .get(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.READ]),
    validator.params(ValidationCommon.readSchema),
    Controller.findOneQualCourseSubscription,
  )
  .put(
    permit(MODULES.QUAL_COURSE_SUBSCRIPTION, [ACTIONS.UPDATE]),
    validator.body(Validation.updateSchema),
    Controller.updateQualCourseSubscription,
  );

module.exports = router;
