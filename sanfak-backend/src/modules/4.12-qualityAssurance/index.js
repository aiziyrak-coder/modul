const router = require("express").Router();

router.use("/indicators", require("./indicator/indicator.routes"));
router.use("/submissions", require("./indicatorSubmission/indicatorSubmission.routes"));
router.use("/eq-announcements", require("./announcement/announcement.routes"));
router.use("/eq-teacher-access", require("./teacherAccess/teacherAccess.routes"));
router.use("/quality-statistics", require("./qualityStatistics/qualityStatistics.routes"));

module.exports = router;
