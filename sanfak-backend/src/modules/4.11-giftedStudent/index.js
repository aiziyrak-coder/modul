const router = require("express").Router();

router.use("/gifted-students", require("./giftedStudent/giftedStudent.routes"));
router.use("/evaluation-criterias", require("./evaluationCriteria/evaluationCriteria.routes"));
router.use("/student-achievements", require("./studentAchievement/studentAchievement.routes"));
router.use("/scholarship-applications", require("./scholarshipApplication/scholarshipApplication.routes"));
router.use("/scholarships", require("./scholarship/scholarship.routes"));
router.use("/document-types", require("./documentType/documentType.routes"));
router.use("/gifted-statistics", require("./giftedStatistics/giftedStatistics.routes"));

module.exports = router;
